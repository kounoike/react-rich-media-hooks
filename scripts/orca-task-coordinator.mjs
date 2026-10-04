import { closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(process.cwd());
const policyPath = join(root, ".orca/task-pr-lifecycle.json");
const policy = JSON.parse(readFileSync(policyPath, "utf8")).lifecycle;
const coordinator = policy.coordinator;
const dispatchSelection = policy.dispatch_selection;
const completionModes = policy.completion_modes;
const automatic = completionModes.automatic;
const orphanReconciliation = coordinator.orphan_reconciliation || {};
const dryRun = process.argv.includes("--dry-run");
const once = process.argv.includes("--once") || !process.argv.includes("--loop");
const log = (message) => console.log(`[task-coordinator] ${message}`);
const reportStatePath = join(tmpdir(), "react-rich-media-hooks-task-coordinator-report-state.json");
let reportState = {};
let reportStateChanged = false;
try {
    reportState = JSON.parse(readFileSync(reportStatePath, "utf8"));
} catch {
    reportState = {};
}

function logState(key, fingerprint, message) {
    if (reportState[key] === fingerprint) return false;
    reportState[key] = fingerprint;
    reportStateChanged = true;
    log(message);
    return true;
}

function clearState(key) {
    if (!(key in reportState)) return;
    delete reportState[key];
    reportStateChanged = true;
}

function persistReportState() {
    if (!reportStateChanged) return;
    const temporaryPath = `${reportStatePath}.${process.pid}.tmp`;
    writeFileSync(temporaryPath, `${JSON.stringify(reportState, null, 2)}\n`, "utf8");
    renameSync(temporaryPath, reportStatePath);
}

const orca =
    process.env.ORCA_CLI_COMMAND ||
    (process.env.ORCA_DEV_REPO_ROOT ? "orca-dev" : "orca-ide");

function command(commandName, args, options = {}) {
    const result = spawnSync(commandName, args, {
        cwd: options.cwd || root,
        encoding: "utf8",
        maxBuffer: 4 * 1024 * 1024,
        stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout = (result.stdout || "").trim();
    const stderr = (result.stderr || "").trim();
    if (result.status !== 0 && !options.allowFailure) {
        throw new Error(`${commandName} ${args.join(" ")} failed (${result.status}): ${stderr || stdout}`);
    }
    return { stdout, stderr, status: result.status ?? 1 };
}

function jsonCommand(commandName, args, options = {}) {
    const result = command(commandName, args, options);
    if (!result.stdout) {
        if (options.allowFailure) return null;
        throw new Error(`${commandName} ${args.join(" ")} returned empty output`);
    }
    try {
        const parsed = JSON.parse(result.stdout);
        if (parsed.ok === false) {
            if (options.allowFailure) return null;
            throw new Error(parsed.error?.message || `${commandName} returned an error`);
        }
        return parsed.result ?? parsed;
    } catch (error) {
        if (options.allowFailure) return null;
        throw new Error(`Invalid JSON from ${commandName}: ${error.message}`);
    }
}

const orcaJson = (args, options = {}) => jsonCommand(orca, args.concat("--json"), options);
const ghJson = (args, fields, options = {}) =>
    jsonCommand("gh", args.concat(["--json", fields]), options);
const backlogJson = (args, options = {}) => jsonCommand("backlog", args.concat("--json"), options);

function runObjective() {
    return coordinator.run_objective || "Repository task lifecycle coordinator";
}

function recoveryObjective() {
    return `${runObjective()} [recovery ${Date.now()}]`;
}

function asPath(value) {
    if (!value) return null;
    let path = String(value).replaceAll("\\", "/");
    const uncPrefix = path.match(/^\/{2}wsl\.localhost\/[^/]+(\/.*)$/i);
    if (uncPrefix) path = uncPrefix[1];
    return path;
}

function slugify(value) {
    return String(value)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 48);
}

function runList() {
    return orcaJson(["orchestration", "run-list"]).runs || [];
}

function ensureRun() {
    const current = orcaJson(["orchestration", "run-current"], { allowFailure: true });
    if (current?.run?.objective?.startsWith(runObjective())) return current.run;

    const existing = runList().find(
        (run) => run.objective?.startsWith(runObjective()) && !run.coordinator_handle,
    );
    if (existing) {
        if (existing.coordinator_handle) {
            throw new Error(
                `coordinator Run ${existing.id} is already bound to ${existing.coordinator_handle}; refusing takeover`,
            );
        }
        const bound = orcaJson(["orchestration", "run-use", "--id", existing.id]);
        return bound.run;
    }

    if (dryRun) {
        return { id: "dry-run", objective: runObjective() };
    }
    return orcaJson(["orchestration", "run-create", "--objective", recoveryObjective()]).run;
}

function taskRows(runId) {
    return orcaJson(["orchestration", "task-list", "--run", runId]).tasks || [];
}

function workerDispatchMap(runId) {
    const result = orcaJson(
        ["orchestration", "worker-list", "--run", runId, "--include-remote"],
        { allowFailure: true },
    );
    const map = new Map();
    for (const worker of result?.workers || []) {
        const taskId = worker.taskId || worker.task_id || worker.task?.id || worker.projection?.taskId;
        const dispatchId =
            worker.dispatchId || worker.dispatch_id || worker.dispatch?.id || worker.projection?.dispatchId;
        if (taskId && dispatchId) map.set(taskId, dispatchId);
    }
    return map;
}

function allTaskRows() {
    const rows = [];
    for (const run of runList().filter((candidate) => !candidate.legacy)) {
        try {
            const dispatches = workerDispatchMap(run.id);
            for (const row of taskRows(run.id)) {
                const dispatchId = row.dispatch_id || row.dispatchId || dispatches.get(row.id) || null;
                rows.push({ ...row, runId: run.id, dispatch_id: dispatchId });
            }
        } catch (error) {
            log(`could not inspect Run ${run.id}: ${error.message}`);
        }
    }
    return rows;
}

function backlogTaskId(spec) {
    return String(spec || "").match(/\bTASK-\d+(?:\.\d+)?\b/)?.[0] || null;
}

function taskIdSet(rows) {
    return new Set(rows.map((row) => backlogTaskId(row.spec || row.task_title)).filter(Boolean));
}

const reservedDispatchStatuses = new Set(["dispatched", "completed", "failed", "blocked"]);

function getWorker(dispatchId) {
    return orcaJson(["orchestration", "worker-show", "--dispatch", dispatchId], {
        allowFailure: true,
    });
}

function workerWorktreeId(worker) {
    return worker?.worker?.worktreeId || worker?.worker?.worktree_id || null;
}

function getWorktree(worker) {
    const id = workerWorktreeId(worker);
    if (!id) return null;
    const shown = orcaJson(["worktree", "show", "--worktree", `id:${id}`], {
        allowFailure: true,
    });
    const worktree = shown?.worktree;
    if (!worktree) return null;
    return {
        id: worktree.id,
        path: asPath(worktree.path || worktree.git?.path),
        branch: String(worktree.branch || worktree.git?.branch || "").replace(/^refs\/heads\//, ""),
    };
}

function gitStatus(worktreePath) {
    return command("git", ["-C", worktreePath, "status", "--porcelain"]).stdout;
}

function changedFiles(worktreePath) {
    const output = command("git", ["-C", worktreePath, "diff", "--numstat", "origin/main...HEAD"]).stdout;
    let additions = 0;
    let deletions = 0;
    const files = [];
    for (const line of output.split("\n").filter(Boolean)) {
        const [added, removed, ...pathParts] = line.split("\t");
        const path = pathParts.join("\t");
        files.push(path);
        additions += Number(added) || 0;
        deletions += Number(removed) || 0;
    }
    return { files, additions, deletions, lines: additions + deletions };
}

function isProtected(path) {
    return automatic.protected_paths.some((pattern) => {
        if (pattern.endsWith("/**")) return path.startsWith(pattern.slice(0, -3));
        return path === pattern;
    });
}

function reportConfirmsNone(completion, fieldNames, report, label) {
    const values = fieldNames.map((name) => completion[name]);
    if (values.some((value) => value === false || (Array.isArray(value) && value.length === 0) ||
        (typeof value === "string" && /^(?:none|no|n\/a)$/i.test(value.trim())))) return true;
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(?:^|\\n)\\s*${escaped}\\s*:\\s*(?:none|no)\\s*(?:$|\\n)`, "i").test(report);
}

function validationStatus(result) {
    if (result === true || result?.passed === true) return "passed";
    if (result === false || result?.passed === false) return "failed";
    const value = typeof result === "string"
        ? result
        : result?.status || result?.conclusion || result?.result || result?.message || "";
    if (/\b(?:failed|failure|error)\b/i.test(String(value))) return "failed";
    if (/\b(?:passed|success|successful)\b/i.test(String(value))) return "passed";
    return "unreported";
}

function workerValidationPassed(completion, report) {
    const results = completion.validationResults || completion.validation_results;
    if (Array.isArray(results) && results.length > 0) {
        const statuses = results.map(validationStatus);
        if (statuses.includes("failed")) return false;
        if (statuses.every((status) => status === "passed")) return true;
    }
    const section = reportSection(report, "## Validation commands and results");
    const resultLines = section.split("\n")
        .map((line) => line.trim())
        .filter((line) => /^[-*]/.test(line) && /`[^`]+`/.test(line));
    return resultLines.length > 0 && resultLines.every((line) =>
        /\bpassed\b/i.test(line) && !/\bfailed\b/i.test(line),
    );
}

function automaticEligibility(task, diff, completion) {
    if (!automatic.enabled || !automatic.task_types.includes(task.type)) {
        return { eligible: false, reason: "task type is not in the automatic lane" };
    }
    if (task.status !== "Done") {
        return { eligible: false, reason: "Backlog acceptance criteria are still open" };
    }
    const report = String(completion.body || "");
    if (!reportConfirmsNone(
        completion,
        ["acceptanceCriteriaRemaining", "acceptance_criteria_remaining"],
        report,
        "Acceptance criteria remaining",
    )) {
        return { eligible: false, reason: "completion does not confirm that all acceptance criteria are satisfied" };
    }
    const noPendingDecision = reportConfirmsNone(
        completion,
        ["unresolvedUserDecision", "unresolved_user_decision"],
        report,
        "Unresolved user decision",
    );
    if (automatic.requires_no_user_decision && !noPendingDecision) {
        return { eligible: false, reason: "completion does not confirm that no user decision remains" };
    }
    const evidence = [
        [automatic.requires_no_decision_changes, ["decisionChanges", "decision_changes"], "Decision changes"],
        [automatic.requires_no_public_api_changes, ["publicApiChanges", "public_api_changes"], "Public API changes"],
        [automatic.requires_no_compatibility_changes, ["compatibilityChanges", "compatibility_changes"], "Compatibility changes"],
        [automatic.requires_no_distribution_changes, ["distributionChanges", "distribution_changes"], "Distribution changes"],
    ];
    for (const [required, fields, label] of evidence) {
        if (required && !reportConfirmsNone(completion, fields, report, label)) {
            return { eligible: false, reason: `completion does not confirm that ${label.toLowerCase()} are none` };
        }
    }
    if (automatic.requires_worker_validation_success && !workerValidationPassed(completion, report)) {
        return { eligible: false, reason: "worker-reported validation is not fully successful" };
    }
    if (diff.files.length > automatic.max_changed_files || diff.lines > automatic.max_changed_lines) {
        return { eligible: false, reason: "diff exceeds automatic lane limits" };
    }
    if (diff.files.some(isProtected)) {
        return { eligible: false, reason: "protected path changed" };
    }
    return { eligible: true, reason: "bounded change with no decision, API, compatibility, or distribution changes" };
}

function taskFromWorktree(worktreePath, taskId) {
    const result = backlogJson(["task", "view", taskId], { cwd: worktreePath });
    return result?.task || null;
}

function backlogTasks() {
    return backlogJson(["task", "list"], { allowFailure: true })?.tasks || [];
}

function worktreesForRepository() {
    const worktrees = orcaJson(["worktree", "list"], { allowFailure: true })?.worktrees || [];
    const main = worktrees.find((worktree) => worktree.isMainWorktree && asPath(worktree.path) === root);
    if (!main?.repoId) return [];
    return worktrees.filter((worktree) => worktree.repoId === main.repoId);
}

function ownedWorktreeIds() {
    const owned = new Set();
    for (const run of runList().filter((candidate) => !candidate.legacy)) {
        const result = orcaJson(
            ["orchestration", "worker-list", "--run", run.id, "--include-remote"],
            { allowFailure: true },
        );
        for (const worker of result?.workers || []) {
            const worktreeId =
                worker.resource?.worktreeId ||
                worker.worker?.worktreeId ||
                worker.worker?.worktree_id ||
                worker.worktreeId ||
                worker.worktree_id ||
                worker.projection?.workspace?.id;
            if (!worktreeId) continue;
            if (worker.resource?.ownershipState === "owned" || worker.dispatchStatus === "dispatched") {
                owned.add(worktreeId);
            }
        }
    }
    return owned;
}

function terminalsForWorktree(worktreeId) {
    const terminals = orcaJson(["terminal", "list"], { allowFailure: true })?.terminals || [];
    return terminals.filter((terminal) => terminal.worktreeId === worktreeId);
}

function deleteRemoteBranchVerified(branch) {
    if (!branch) return;
    const remote = command(
        "git",
        ["ls-remote", "--heads", "origin", `refs/heads/${branch}`],
        { cwd: root, allowFailure: true },
    );
    if (remote.status !== 0) throw new Error(`could not inspect remote branch ${branch}`);
    if (remote.stdout) {
        const deleted = command("git", ["push", "origin", "--delete", branch], {
            cwd: root,
            allowFailure: true,
        });
        if (deleted.status !== 0) throw new Error(`remote branch deletion was not confirmed for ${branch}`);
    }
    const afterDelete = command(
        "git",
        ["ls-remote", "--heads", "origin", `refs/heads/${branch}`],
        { cwd: root, allowFailure: true },
    );
    if (afterDelete.status !== 0 || afterDelete.stdout) {
        throw new Error(`remote branch deletion was not verified for ${branch}`);
    }
}

function deleteLocalBranchVerified(branch) {
    if (!branch) return;
    const localBranch = command("git", ["show-ref", "--verify", "--quiet", `refs/heads/${branch}`], {
        cwd: root,
        allowFailure: true,
    });
    if (localBranch.status === 0) {
        const deleted = command("git", ["branch", "-D", branch], { cwd: root, allowFailure: true });
        if (deleted.status !== 0) throw new Error(`local branch deletion was not confirmed for ${branch}`);
    } else if (localBranch.status !== 1) {
        throw new Error(`could not inspect local branch ${branch}`);
    }
    const afterDelete = command("git", ["show-ref", "--verify", "--quiet", `refs/heads/${branch}`], {
        cwd: root,
        allowFailure: true,
    });
    if (afterDelete.status !== 1) throw new Error(`local branch deletion was not verified for ${branch}`);
}

function taskForWorktree(tasks, worktree) {
    const values = [worktree.displayName, worktree.branch, worktree.path]
        .filter(Boolean)
        .map((value) => String(value).toLowerCase().replaceAll("\\", "/").replace(/^refs\/heads\//, ""));
    return tasks
        .filter((task) => {
            const slug = String(task.id).toLowerCase().replaceAll(".", "-");
            return values.some(
                (value) =>
                    value === slug ||
                    value.startsWith(`${slug}-`) ||
                    value.includes(`/${slug}-`),
            );
        })
        .sort((left, right) => right.id.length - left.id.length)[0] || null;
}

function mergedPrForBranch(branch) {
    const prs = ghJson(
        ["pr", "list", "--state", "all", "--head", branch, "--limit", "100"],
        "number,state,mergedAt,headRefName",
        { cwd: root, allowFailure: true },
    );
    if (!Array.isArray(prs)) return null;
    return prs.find((pr) => pr.headRefName === branch && pr.state === "MERGED" && pr.mergedAt) || null;
}

function removeOrphanWorktree(worktree, task, mergedPr) {
    const terminals = terminalsForWorktree(worktree.id);
    for (const terminal of terminals) {
        const closed = orcaJson(["terminal", "close", "--terminal", terminal.handle], {
            allowFailure: true,
        });
        if (!closed) {
            logState(`orphan:${worktree.id}`, `close-terminal:${terminal.handle}`, `retaining ${task.id}: could not close terminal ${terminal.handle}`);
            return false;
        }
    }
    if (terminalsForWorktree(worktree.id).length > 0) {
        logState(`orphan:${worktree.id}`, "terminals-remain", `retaining ${task.id}: terminals remain attached to the exact worktree`);
        return false;
    }
    deleteRemoteBranchVerified(worktree.branch);
    const removed = orcaJson(["worktree", "rm", "--worktree", `id:${worktree.id}`, "--force"], {
        allowFailure: true,
    });
    if (!removed) {
        logState(`orphan:${worktree.id}`, "worktree-remove-unconfirmed", `retaining ${task.id}: exact worktree removal was not confirmed`);
        return false;
    }
    if (existsSync(worktree.path) || worktreeIsRegistered(worktree.id)) {
        logState(`orphan:${worktree.id}`, "worktree-still-present", `retaining ${task.id}: exact worktree remains after removal`);
        return false;
    }
    const gitWorktrees = command("git", ["worktree", "list", "--porcelain"], { cwd: root }).stdout;
    const listedPaths = gitWorktrees
        .split("\n\n")
        .map((entry) => asPath(entry.match(/^worktree (.+)$/m)?.[1]))
        .filter(Boolean);
    if (listedPaths.includes(resolve(worktree.path))) {
        logState(`orphan:${worktree.id}`, "git-worktree-still-registered", `retaining ${task.id}: Git still registers the exact worktree`);
        return false;
    }
    deleteLocalBranchVerified(worktree.branch);
    clearState(`orphan:${worktree.id}`);
    log(`reclaimed orphan ${task.id}: PR #${mergedPr.number} is merged and exact terminals/worktree/branch are gone`);
    return true;
}

function reconcileMergedOrphans() {
    if (orphanReconciliation.enabled !== true) return;
    const tasks = backlogTasks();
    const owned = ownedWorktreeIds();
    for (const worktree of worktreesForRepository().filter((candidate) => !candidate.isMainWorktree)) {
        const task = taskForWorktree(tasks, worktree);
        if (!task) continue;
        if (owned.has(worktree.id)) {
            logState(`orphan:${worktree.id}`, "worker-owned", `retaining ${task.id}: exact worktree is still owned by a worker`);
            continue;
        }
        const worktreePath = asPath(worktree.path || worktree.git?.path);
        const branch = String(worktree.branch || worktree.git?.branch || "").replace(/^refs\/heads\//, "");
        if (!worktreePath || !branch || !existsSync(worktreePath)) {
            logState(`orphan:${worktree.id}`, "path-or-branch-unavailable", `retaining ${task.id}: worktree path or branch is unavailable`);
            continue;
        }
        let taskRecord;
        try {
            taskRecord = taskFromWorktree(worktreePath, task.id);
        } catch (error) {
            logState(`orphan:${worktree.id}`, `task-record-error:${error.message}`, `retaining ${task.id}: could not read the worktree task record (${error.message})`);
            continue;
        }
        if (!taskRecord || taskRecord.status !== "Done") {
            logState(`orphan:${worktree.id}`, `task-status:${taskRecord?.status || "unavailable"}`, `retaining ${task.id}: worktree task record is not Done`);
            continue;
        }
        let status;
        try {
            status = gitStatus(worktreePath);
        } catch (error) {
            logState(`orphan:${worktree.id}`, `status-error:${error.message}`, `retaining ${task.id}: could not inspect worktree status (${error.message})`);
            continue;
        }
        if (status) {
            logState(`orphan:${worktree.id}`, `dirty:${status}`, `retaining ${task.id}: worktree has uncommitted files`);
            continue;
        }
        const mergedPr = mergedPrForBranch(branch);
        if (!mergedPr) {
            logState(`orphan:${worktree.id}`, `not-merged:${branch}`, `retaining ${task.id}: no merged PR was proven for ${branch}`);
            continue;
        }
        if (dryRun) {
            logState(`orphan:${worktree.id}`, `dry-run:${mergedPr.number}`, `dry-run: would reclaim orphan ${task.id} after merged PR #${mergedPr.number}`);
            continue;
        }
        try {
            removeOrphanWorktree(
                { ...worktree, path: worktreePath, branch },
                task,
                mergedPr,
            );
        } catch (error) {
            logState(`orphan:${worktree.id}`, `cleanup-error:${error.message}`, `retaining ${task.id}: orphan cleanup failed (${error.message})`);
        }
    }
}

function localChecks(worktreePath) {
    const checks = [
        {
            command: "git diff --check origin/main...HEAD",
            args: ["-C", worktreePath, "diff", "--check", "origin/main...HEAD"],
            program: "git",
        },
        {
            command: "pnpm run validate:lifecycle",
            args: ["run", "validate:lifecycle"],
            program: "pnpm",
        },
    ];
    const results = checks.map((check) => {
        const result = command(check.program, check.args, {
            cwd: worktreePath,
            allowFailure: true,
        });
        return { command: check.command, passed: result.status === 0 };
    });
    return { passed: results.every((result) => result.passed), results };
}

function requiredChecks(pr, expectedHeadSha) {
    if (pr.headRefOid !== expectedHeadSha) {
        return { passed: false, reason: "PR head does not match the validated worktree HEAD" };
    }
    const checks = pr.statusCheckRollup;
    if (!Array.isArray(checks) || checks.length === 0) {
        return { passed: false, reason: "GitHub has not reported checks for this PR head" };
    }
    const allPassed = checks.every((check) => {
        if (check.__typename === "CheckRun") {
            return check.status === "COMPLETED" && check.conclusion === "SUCCESS";
        }
        if (check.__typename === "StatusContext") return check.state === "SUCCESS";
        return false;
    });
    const summary = checks
        .map((check) => `${check.name || check.context || check.__typename}:${check.conclusion || check.state || check.status}`)
        .join(", ");
    return {
        passed: allPassed,
        reason: allPassed ? "all reported GitHub checks passed" : `GitHub checks are pending or failing (${summary})`,
        fingerprint: `${pr.headRefOid}:${summary}`,
    };
}

function prList() {
    return ghJson(
        ["pr", "list", "--state", "all", "--limit", "100"],
        "number,title,body,headRefName,headRefOid,state,isDraft,mergedAt,reviewDecision",
        { allowFailure: true },
    ) || [];
}

function prFor(taskId, runId, branch) {
    const prs = prList();
    const marker = `<!-- lifecycle-task: ${taskId} run: ${runId} -->`;
    const taskLabel = `Backlog task: ${taskId}`;
    return prs.find((pr) => String(pr.body || "").includes(marker)) ||
        prs.find((pr) => pr.headRefName === branch) ||
        prs.find((pr) => String(pr.body || "").includes(taskLabel)) ||
        null;
}

function prBodyComplete(body, taskId, runId) {
    const text = String(body || "");
    return text.includes(`<!-- lifecycle-task: ${taskId} run: ${runId} -->`) &&
        text.includes(`Backlog task: ${taskId}`) &&
        text.includes(`Run: ${runId}`) &&
        text.includes("Dispatch:") &&
        text.includes("Worktree:") &&
        text.includes("Head SHA:") &&
        text.includes("Backlog status at report:") &&
        text.includes("## Summary") &&
        text.includes("## Task execution improvements") &&
        text.includes("## Acceptance criteria status") &&
        text.includes("## Files modified") &&
        text.includes("## Validation commands and results") &&
        text.includes("## Automatic lane evidence") &&
        text.includes("Unresolved user decision:") &&
        text.includes("Decision changes:") &&
        text.includes("Public API changes:") &&
        text.includes("Compatibility changes:") &&
        text.includes("Distribution changes:") &&
        text.includes("## Recovery state");
}

function completionValue(completion, report, fieldNames, label) {
    for (const name of fieldNames) {
        const value = completion[name];
        if (value === undefined || value === null) continue;
        if (value === false || (Array.isArray(value) && value.length === 0)) return "none";
        if (value === true) return "reported present";
        if (Array.isArray(value)) return value.map(String).join("; ");
        return String(value);
    }
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return report.match(new RegExp(`(?:^|\\n)\\s*${escaped}\\s*:\\s*([^\\n]+)`, "i"))?.[1]?.trim() || "not reported";
}

function writePrBody(task, taskId, runId, dispatchId, worktree, diff, completion, headSha, checks) {
    const marker = `<!-- lifecycle-task: ${taskId} run: ${runId} -->`;
    const report = String(completion.body || "Worker completion report did not include a summary.");
    const summary = completion.summary || reportSection(report, "## Summary") || report;
    const taskImprovements = reportSection(report, "## Task execution improvements");
    const workerValidation = reportSection(report, "## Validation commands and results");
    const validationCommands = completion.validationCommands || completion.validation_commands || [];
    const validationResults = completion.validationResults || completion.validation_results || [];
    const structuredValidationLines = Array.isArray(validationCommands)
        ? validationCommands.map((commandText, index) => {
            const result = validationResults[index];
            const resultText = validationStatus(result);
            return `- \`${typeof commandText === "string" ? commandText : commandText.command || JSON.stringify(commandText)}\` — ${resultText}`;
        })
        : [];
    const validationLines = [
        ...checks.results.map((result) => `- \`${result.command}\` — ${result.passed ? "passed" : "failed"}`),
        ...(workerValidation ? workerValidation.split("\n").map((line) => line.trim()).filter(Boolean) : structuredValidationLines),
    ];
    const remainingCriteria = completion.acceptanceCriteriaRemaining ??
        completion.acceptance_criteria_remaining ??
        (task.status === "Done" ? "none" : "see the Backlog task record");
    const remainingText = Array.isArray(remainingCriteria)
        ? (remainingCriteria.length ? remainingCriteria.join("; ") : "none")
        : String(remainingCriteria);
    const recovery = task.status === "Done"
        ? "Task acceptance criteria are complete. Keep this Draft PR and all worker resources until review, checks, merge, and exact cleanup are verified."
        : `Backlog status is ${task.status}. Remaining acceptance criteria are preserved; keep this Draft PR, branch, and worktree for explicit review or recovery.`;
    const lines = [
        marker,
        `<!-- lifecycle-head: ${taskId} sha: ${headSha} -->`,
        "",
        `Backlog task: ${taskId} — ${task.title}`,
        `Run: ${runId}`,
        `Dispatch: ${dispatchId}`,
        `Worktree: ${worktree.id}`,
        `Head SHA: ${headSha}`,
        `Backlog status at report: ${task.status}`,
        "",
        "## Summary",
        summary,
        "",
        "## Task execution improvements",
        taskImprovements,
        "",
        "## Acceptance criteria status",
        `- Backlog status: ${task.status}`,
        `- Remaining: ${remainingText}`,
        "",
        "## Files modified",
        ...diff.files.map((path) => `- ${path}`),
        "",
        "## Validation commands and results",
        ...validationLines,
        "",
        "## Automatic lane evidence",
        `- Unresolved user decision: ${completionValue(completion, report, ["unresolvedUserDecision", "unresolved_user_decision"], "Unresolved user decision")}`,
        `- Decision changes: ${completionValue(completion, report, ["decisionChanges", "decision_changes"], "Decision changes")}`,
        `- Public API changes: ${completionValue(completion, report, ["publicApiChanges", "public_api_changes"], "Public API changes")}`,
        `- Compatibility changes: ${completionValue(completion, report, ["compatibilityChanges", "compatibility_changes"], "Compatibility changes")}`,
        `- Distribution changes: ${completionValue(completion, report, ["distributionChanges", "distribution_changes"], "Distribution changes")}`,
        "",
        "## Recovery state",
        recovery,
    ];
    const directory = join(tmpdir(), "react-rich-media-hooks");
    mkdirSync(directory, { recursive: true });
    const path = join(directory, `${taskId.toLowerCase().replaceAll(".", "-")}-${runId}.md`);
    writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
    return path;
}

function ensureDraftPr(task, taskId, runId, dispatchId, worktree, diff, completion, headSha, checks) {
    let pr = prFor(taskId, runId, worktree.branch);
    if (pr && pr.headRefName !== worktree.branch) {
        return {
            blocked: true,
            number: pr.number,
            state: pr.state,
            reason: `PR #${pr.number} already exists for this Backlog task on branch ${pr.headRefName}; refusing to create a duplicate`,
        };
    }
    const bodyPath = writePrBody(task, taskId, runId, dispatchId, worktree, diff, completion, headSha, checks);
    const title = `${task.type}: ${task.title}`;
    if (!pr) {
        if (dryRun) {
            log(`dry-run: would create Draft PR for ${taskId} from ${worktree.branch}`);
            return { number: null, draft: true, state: "OPEN", dryRun: true, headRefOid: headSha };
        }
        const created = command("gh", [
            "pr", "create", "--draft", "--base", "main", "--head", worktree.branch,
            "--title", title, "--body-file", bodyPath,
        ], { cwd: worktree.path });
        const number = Number(created.stdout.match(/\/pull\/(\d+)/)?.[1]);
        if (!number) throw new Error(`Could not parse created PR number: ${created.stdout}`);
        pr = { number, body: readFileSync(bodyPath, "utf8"), isDraft: true, state: "OPEN", headRefOid: headSha };
    } else if (pr.state === "OPEN" && pr.isDraft &&
        (pr.headRefOid !== headSha || !prBodyComplete(pr.body, taskId, runId))) {
        if (!dryRun) command("gh", ["pr", "edit", String(pr.number), "--body-file", bodyPath], { cwd: worktree.path });
    }
    if (!dryRun) {
        const inspected = ghJson(
            ["pr", "view", String(pr.number)],
            "body,state,isDraft,headRefOid,headRefName,mergedAt,reviewDecision,statusCheckRollup",
            { cwd: worktree.path },
        );
        if (String(inspected.body || "").includes("\\n")) {
            throw new Error(`PR #${pr.number} contains literal backslash-n; refusing to continue`);
        }
        if (inspected.state === "OPEN" && !prBodyComplete(inspected.body, taskId, runId)) {
            throw new Error(`PR #${pr.number} is missing required lifecycle body fields`);
        }
        pr = { ...pr, ...inspected };
    }
    return pr;
}

function mergeAutomaticPr(pr, worktreePath, headSha) {
    if (dryRun) {
        log(`dry-run: would mark PR #${pr.number} ready and squash-merge it`);
        return { merged: true, pr };
    }
    if (pr.state === "MERGED") return { merged: Boolean(pr.mergedAt), pr };
    if (pr.state !== "OPEN") return { merged: false, reason: `PR state is ${pr.state}` };
    if (pr.isDraft) command("gh", ["pr", "ready", String(pr.number)], { cwd: worktreePath });
    const current = ghJson(
        ["pr", "view", String(pr.number)],
        "state,isDraft,headRefOid,mergedAt,reviewDecision,statusCheckRollup",
        { cwd: worktreePath },
    );
    const checkStatus = requiredChecks(current, headSha);
    if (current.state !== "OPEN" || current.isDraft || !checkStatus.passed) {
        return { merged: false, reason: checkStatus.reason || "PR is not open and ready", pr: current };
    }
    const merge = command("gh", ["pr", "merge", String(pr.number), "--squash"], {
        cwd: worktreePath,
        allowFailure: true,
    });
    const after = ghJson(
        ["pr", "view", String(pr.number)],
        "state,mergedAt,headRefOid,reviewDecision,statusCheckRollup",
        { cwd: worktreePath },
    );
    if (after.state === "MERGED" && after.mergedAt && after.headRefOid === headSha) {
        return { merged: true, pr: after };
    }
    if (merge.status !== 0) {
        throw new Error(`PR #${pr.number} merge failed or is unverified: ${merge.stderr || merge.stdout}`);
    }
    return { merged: false, reason: "GitHub did not confirm the merge", pr: after };
}

function worktreeIsRegistered(worktreeId) {
    return worktreesForRepository().some((candidate) => candidate.id === worktreeId);
}

function releaseExactWorker(dispatchId, worktree) {
    if (dryRun) {
        log(`dry-run: would release ${dispatchId} and remove ${worktree.id}`);
        return;
    }
    const before = getWorker(dispatchId);
    if (before?.dispatch?.id !== dispatchId || workerWorktreeId(before) !== worktree.id) {
        throw new Error(`Dispatch ${dispatchId} no longer proves ownership of exact worktree ${worktree.id}`);
    }
    deleteRemoteBranchVerified(worktree.branch);
    const beforeState = before?.projection?.resource?.state || before?.terminalResource?.ownershipState;
    if (beforeState !== "released") {
        const released = orcaJson(["orchestration", "worker-release", "--dispatch", dispatchId], {
            allowFailure: true,
        });
        if (!released) throw new Error(`worker-release did not settle ${dispatchId}; retaining artifacts`);
    }
    const after = getWorker(dispatchId);
    const afterState = after?.projection?.resource?.state || after?.terminalResource?.ownershipState;
    if (after?.dispatch?.id !== dispatchId || afterState !== "released") {
        throw new Error(`Dispatch ${dispatchId} release was not verified; retaining artifacts`);
    }
    for (const terminal of terminalsForWorktree(worktree.id)) {
        const closed = orcaJson(["terminal", "close", "--terminal", terminal.handle], {
            allowFailure: true,
        });
        if (!closed) throw new Error(`could not close exact worktree terminal ${terminal.handle}`);
    }
    if (terminalsForWorktree(worktree.id).length > 0) {
        throw new Error(`terminals remain attached to exact worktree ${worktree.id}`);
    }
    if (worktreeIsRegistered(worktree.id)) {
        const removed = orcaJson(["worktree", "rm", "--worktree", `id:${worktree.id}`, "--force"], {
            allowFailure: true,
        });
        if (!removed) throw new Error(`exact worktree removal was not confirmed for ${worktree.id}`);
    }
    if (existsSync(worktree.path) || worktreeIsRegistered(worktree.id)) {
        throw new Error(`exact worktree ${worktree.id} remains after removal`);
    }
    const gitWorktrees = command("git", ["worktree", "list", "--porcelain"], { cwd: root }).stdout;
    const listedPaths = gitWorktrees
        .split("\n\n")
        .map((entry) => asPath(entry.match(/^worktree (.+)$/m)?.[1]))
        .filter(Boolean);
    if (listedPaths.includes(resolve(worktree.path))) {
        throw new Error(`Git still registers exact worktree ${worktree.path}`);
    }
    deleteLocalBranchVerified(worktree.branch);
}

const completedRowsReleased = new Set();

function completionFor(row) {
    if (row.result && typeof row.result === "object") return row.result;
    try {
        return JSON.parse(row.result || "{}");
    } catch {
        return { body: String(row.result || "") };
    }
}

function reportSection(body, heading) {
    const start = body.indexOf(heading);
    if (start < 0) return "";
    const content = body.slice(start + heading.length);
    const nextHeading = content.search(/^##\s/m);
    return (nextHeading < 0 ? content : content.slice(0, nextHeading)).trim();
}

function completionEvidenceIssues(completion, diff) {
    const issues = [];
    const completionId = completion.completionId || completion.completion_id || completion.messageId || completion.message_id;
    if (!completionId) issues.push("completion id");

    const report = String(completion.body || "");
    if (!(completion.summary || reportSection(report, "## Summary"))) issues.push("summary");
    const improvements = reportSection(report, "## Task execution improvements");
    if (!improvements) {
        issues.push("task execution improvements (or explicit none)");
    } else if (!/^none\s*$/i.test(improvements)) {
        const entries = improvements.trim().split(/(?=^[ \t]*-[ \t]*Improvement:)/m);
        const completeEntries = entries.length > 0 && entries.every((entry) => {
            const lines = entry.split(/\r?\n/).map((line) => line.trim());
            return /^-\s*Improvement:\s*\S/.test(lines[0] || "") &&
                lines.some((line) => /^-\s*Reason:\s*\S/.test(line)) &&
                lines.some((line) => /^-\s*Changed paths:\s*\S/.test(line));
        });
        if (!completeEntries) issues.push("task execution improvement reasons and changed paths");
    }
    const files = completion.filesModified || completion.files_modified;
    const fileSection = reportSection(report, "## Files modified");
    const reportedFiles = Array.isArray(files)
        ? new Set(files.map((path) => String(path).replaceAll("\\", "/")))
        : null;
    const allFilesReported = diff.files.every((path) =>
        reportedFiles?.has(path) || fileSection.includes(path),
    );
    if (!allFilesReported) issues.push("all changed files");

    const commands = completion.validationCommands || completion.validation_commands;
    const results = completion.validationResults || completion.validation_results;
    const validationSection = reportSection(report, "## Validation commands and results");
    const structuredValidation = Array.isArray(commands) && commands.length > 0 &&
        Array.isArray(results) && results.length >= commands.length &&
        results.slice(0, commands.length).every((result) => validationStatus(result) !== "unreported");
    const reportedValidation = /`[^`]+`/.test(validationSection) &&
        /\b(?:passed|failed|success|failure)\b/i.test(validationSection);
    if (!structuredValidation && !reportedValidation) issues.push("validation commands and results");

    const acceptanceRemaining = completion.acceptanceCriteriaRemaining ?? completion.acceptance_criteria_remaining;
    if (acceptanceRemaining === undefined &&
        !/^\s*Acceptance criteria remaining\s*:\s*.+$/im.test(report)) {
        issues.push("remaining acceptance criteria");
    }
    const unresolvedDecision = completion.unresolvedUserDecision ?? completion.unresolved_user_decision;
    if (unresolvedDecision === undefined &&
        !/^\s*Unresolved user decision\s*:\s*.+$/im.test(report)) {
        issues.push("unresolved user decision status");
    }
    return issues;
}

function retainRow(row, taskId, reason, fingerprint = reason) {
    const key = `dispatch:${row.dispatch_id || row.id}`;
    logState(key, `${taskId}:${fingerprint}`, `retaining ${taskId}: ${reason}`);
}

function processCompleted(rows) {
    for (const row of rows) {
        if (completedRowsReleased.has(row.id)) continue;
        const taskId = backlogTaskId(row.spec || row.task_title) || row.id;
        if (row.status === "failed" || row.status === "blocked") {
            retainRow(row, taskId, `Dispatch is ${row.status}; explicit recovery is required`, row.status);
            continue;
        }
        if (row.status !== "completed") continue;
        if (!row.dispatch_id) {
            retainRow(row, taskId, "no active or settled Dispatch was found in worker-list");
            continue;
        }
        try {
            if (processCompletedRow(row.runId, row)) {
                completedRowsReleased.add(row.id);
                clearState(`dispatch:${row.dispatch_id}`);
            }
        } catch (error) {
            retainRow(row, taskId, error.message, `error:${error.message}`);
        }
    }
}

function processCompletedRow(runId, row) {
    const taskId = backlogTaskId(row.spec || row.task_title);
    if (!taskId) {
        retainRow(row, row.id, "no Backlog task id in spec");
        return false;
    }
    const worker = getWorker(row.dispatch_id);
    const worktree = getWorktree(worker);
    if (!worker?.worker || worker.worker.state !== "succeeded" || !worktree?.path || !worktree.branch) {
        retainRow(row, taskId, "settled successful worker or exact worktree is unavailable");
        return false;
    }
    const completion = completionFor(row);
    if (completion.outcome !== "succeeded") {
        retainRow(row, taskId, "worker completion did not report outcome succeeded", String(completion.outcome || "missing outcome"));
        return false;
    }
    const task = taskFromWorktree(worktree.path, taskId);
    if (!task || !["In Progress", "Done"].includes(task.status)) {
        retainRow(row, taskId, `task record status is ${task?.status || "unavailable"}; expected In Progress or Done`, task?.status || "unavailable");
        return false;
    }
    if (gitStatus(worktree.path)) {
        retainRow(row, taskId, `worker left uncommitted files in ${worktree.branch}`);
        return false;
    }
    command("git", ["-C", worktree.path, "fetch", "origin", "main", "--quiet"]);
    const headSha = command("git", ["-C", worktree.path, "rev-parse", "HEAD"]).stdout;
    const remoteHead = command(
        "git",
        ["ls-remote", "--heads", "origin", `refs/heads/${worktree.branch}`],
        { cwd: root, allowFailure: true },
    );
    if (remoteHead.status !== 0) {
        retainRow(row, taskId, `could not inspect remote branch ${worktree.branch}`);
        return false;
    }
    if (remoteHead.stdout.split(/\s+/)[0] !== headSha) {
        retainRow(row, taskId, `worker branch ${worktree.branch} is not already published at validated HEAD`, headSha);
        return false;
    }
    const diff = changedFiles(worktree.path);
    if (diff.files.length === 0) {
        retainRow(row, taskId, "worker branch contains no change to publish", headSha);
        return false;
    }
    const evidenceIssues = completionEvidenceIssues(completion, diff);
    if (evidenceIssues.length > 0) {
        retainRow(row, taskId, `completion report is missing ${evidenceIssues.join(", ")}`, `${headSha}:report:${evidenceIssues.join("|")}`);
        return false;
    }
    const checks = localChecks(worktree.path);
    if (!checks.passed) {
        const failures = checks.results.filter((result) => !result.passed).map((result) => result.command).join(", ");
        retainRow(row, taskId, `local validation failed: ${failures}`, `${headSha}:${failures}`);
        return false;
    }
    const eligibility = automaticEligibility(task, diff, completion);
    const pr = ensureDraftPr(task, taskId, runId, row.dispatch_id, worktree, diff, completion, headSha, checks);
    if (pr.blocked) {
        retainRow(row, taskId, pr.reason, `pr-conflict:${pr.number}:${pr.state}`);
        return false;
    }
    if (pr.dryRun) return false;
    if (pr.headRefName !== worktree.branch || pr.headRefOid !== headSha) {
        retainRow(row, taskId, `PR #${pr.number} head does not match ${worktree.branch}@${headSha}`, `${pr.number}:${pr.headRefOid}:${headSha}`);
        return false;
    }
    if (pr.state === "MERGED") {
        const checksState = requiredChecks(pr, headSha);
        const approvalSatisfied = eligibility.eligible || pr.reviewDecision === "APPROVED";
        if (!pr.mergedAt || !approvalSatisfied || !checksState.passed) {
            retainRow(row, taskId, `merged PR #${pr.number} lacks the required approval or current-head checks`, `${pr.reviewDecision}:${eligibility.eligible}:${checksState.reason}`);
            return false;
        }
        releaseExactWorker(row.dispatch_id, worktree);
        log(`verified PR #${pr.number} merge and exact cleanup for ${taskId}`);
        return true;
    }
    if (pr.state !== "OPEN") {
        retainRow(row, taskId, `PR #${pr.number} is ${pr.state}; artifacts retained`, `${pr.number}:${pr.state}`);
        return false;
    }
    if (!eligibility.eligible) {
        const checksState = requiredChecks(pr, headSha);
        const fingerprint = `${pr.number}:${pr.state}:${pr.isDraft}:${pr.headRefOid}:${eligibility.reason}:${checksState.fingerprint || checksState.reason}`;
        logState(
            `dispatch:${row.dispatch_id}`,
            fingerprint,
            `${taskId}: Draft PR #${pr.number}; manual review required (${eligibility.reason})`,
        );
        return false;
    }
    const checksState = requiredChecks(pr, headSha);
    if (!checksState.passed) {
        retainRow(row, taskId, `Draft PR #${pr.number} awaits current-head checks`, `${pr.number}:${checksState.fingerprint || checksState.reason}`);
        return false;
    }
    const mergeResult = mergeAutomaticPr(pr, worktree.path, headSha);
    if (!mergeResult.merged) {
        retainRow(row, taskId, `PR #${pr.number} is not merged: ${mergeResult.reason}`, `${pr.number}:${mergeResult.reason}`);
        return false;
    }
    releaseExactWorker(row.dispatch_id, worktree);
    log(`verified automatic merge and exact cleanup for ${taskId}`);
    return true;
}

function syncMain() {
    if (command("git", ["status", "--porcelain"]).stdout) {
        throw new Error("main worktree is not clean; refusing task-record or branch mutation");
    }
    if (dryRun) return;
    command("git", ["fetch", "origin", "main", "--quiet"]);
    command("git", ["merge", "--ff-only", "origin/main"]);
}

function workerSpec(task) {
    return [
        `Work only on Backlog task ${task.id}: ${task.title}.`,
        "Read AGENTS.md first, then run `backlog instructions overview` and read the task-execution guide plus the selected task.",
        "Inspect relevant Backlog decisions and docs before making recommendations or changes.",
        "Use the Backlog CLI for task status, assignee, plan, notes, acceptance criteria, and final summary; do not edit task markdown directly.",
        "Run the required repository checks. For research or small automatic-lane work, do not accept a significant product, API, compatibility, distribution, or architecture decision without user approval.",
        "When this task exposes a concrete repository friction or defect directly related to the assigned work, make a small, reversible fix in this same task branch and Draft PR; do not ask for advance approval just to prepare that PR. This includes narrowly scoped docs, scripts, or workflow-policy improvements in protected paths, which remain in the manual review lane for merge. Do not expand into unrelated cleanup or implement a significant product, scope, public API, compatibility, distribution, or architecture decision without explicit user approval.",
        "Verify every acceptance criterion. Mark this Backlog task Done only when every criterion is fully proven; otherwise keep it In Progress and list each remaining criterion. Do not mark Done just to trigger a PR.",
        "Before completion, record the task update and final summary through the Backlog CLI, commit all scoped work and the task record on this branch with an English Conventional Commit, and push it to origin so the coordinator can publish a Draft PR. A successful scoped result may be reported while the task remains In Progress if external or unverified acceptance criteria remain.",
        "The completion report must include a substantive `## Summary`; `## Task execution improvements` with exactly `none` or one block per improvement using `- Improvement: ...`, `  - Reason: ...`, and `  - Changed paths: ...`; a `## Files modified` section listing every changed path; a `## Validation commands and results` section with exact commands and passed/failed results; `Acceptance criteria remaining: none | <items>`; `Unresolved user decision: none | <decision>`; `Decision changes: none | <changes>`; `Public API changes: none | <changes>`; `Compatibility changes: none | <changes>`; and `Distribution changes: none | <changes>`. Use `none` only when verified.",
        "Send exactly one worker_done with outcome succeeded only when the scoped assigned work succeeded (even if explicitly listed acceptance criteria remain); use failed when it did not. Use the injected task and dispatch IDs, then stop. Do not start another Backlog task or keep working after worker_done.",
        `Selected task: ${task.id} — ${task.title}`,
    ].join("\n");
}

function responseFromCommand(result) {
    try {
        return JSON.parse(result.stdout);
    } catch {
        return null;
    }
}

function inspectStartEffects(task, name) {
    const taskToken = task.id.toLowerCase().replaceAll(".", "-");
    const matchesTarget = (value) => {
        const text = String(value || "").toLowerCase().replaceAll("\\", "/");
        return text.includes(taskToken) || text.includes(name.toLowerCase());
    };
    let orcaMatches = [];
    let taskRows = [];
    let gitMatches = [];
    const errors = [];
    try {
        orcaMatches = worktreesForRepository()
            .filter((worktree) => matchesTarget(worktree.displayName) || matchesTarget(worktree.branch) || matchesTarget(worktree.path))
            .map((worktree) => ({ id: worktree.id, path: asPath(worktree.path), branch: worktree.branch }));
        taskRows = allTaskRows()
            .filter((row) => backlogTaskId(row.spec || row.task_title) === task.id)
            .map((row) => ({ id: row.id, runId: row.runId, status: row.status, dispatchId: row.dispatch_id }));
    } catch (error) {
        errors.push(`Orca inspection: ${error.message}`);
    }
    try {
        const output = command("git", ["worktree", "list", "--porcelain"], { cwd: root }).stdout;
        gitMatches = output.split("\n\n").map((entry) => {
            const path = asPath(entry.match(/^worktree (.+)$/m)?.[1]);
            const branch = entry.match(/^branch refs\/heads\/(.+)$/m)?.[1] || null;
            return { path, branch };
        }).filter((entry) => matchesTarget(entry.path) || matchesTarget(entry.branch));
    } catch (error) {
        errors.push(`Git inspection: ${error.message}`);
    }
    return { orcaWorktrees: orcaMatches, orchestrationTasks: taskRows, gitWorktrees: gitMatches, errors };
}

function reserveFailedStart(task, run, orchestrationTaskId, name, stage, result) {
    const response = responseFromCommand(result);
    const receipt = response?.result ?? response ?? {};
    const inspection = inspectStartEffects(task, name);
    const failure = {
        runId: run.id,
        orchestrationTaskId: orchestrationTaskId || null,
        stage,
        exitCode: result.status,
        failedStage: receipt.failedStage || receipt.stage || null,
        outcome: receipt.outcome || receipt.status || null,
        error: receipt.error?.message || receipt.error || result.stderr || result.stdout || "no CLI error details",
        effects: receipt.effects || null,
        residualResources: receipt.residualResources || null,
        recoveryCommands: receipt.recoveryCommands || null,
        inspection,
    };
    const fingerprint = JSON.stringify(failure);
    const residual = failure.residualResources;
    const hasResidualResources = Array.isArray(residual)
        ? residual.length > 0
        : Boolean(residual && Object.keys(residual).length > 0);
    const terminalFailure = /^(failed|failure|blocked|rejected)$/i.test(String(failure.outcome || ""));
    const uncertain = /unknown|pending/i.test(String(failure.outcome || "")) ||
        !response ||
        (stage === "worker-start" && hasResidualResources) ||
        (result.status !== 0 && !terminalFailure);
    reportState[`start-reserved:${task.id}`] = { fingerprint, uncertain };
    reportStateChanged = true;
    logState(`start:${task.id}`, fingerprint, `${task.id}: ${stage} failed or is indeterminate; task remains reserved pending explicit recovery; local reservation: ${reportStatePath} (${JSON.stringify(failure)})`);
    return uncertain;
}

function dispatchNext(run, candidates) {
    for (const task of candidates) {
        const spec = workerSpec(task);
        if (dryRun) {
            log(`dry-run: would worker-start ${task.id}`);
            continue;
        }
        const name = `${task.id.toLowerCase().replaceAll(".", "-")}-${slugify(task.title)}`;
        const createdResult = command(orca, [
            "orchestration", "task-create", "--spec", spec,
            "--task-title", `${task.id} ${task.title}`,
            "--display-name", task.id,
            "--run", run.id,
            "--json",
        ], { allowFailure: true });
        const createdEnvelope = responseFromCommand(createdResult);
        const created = createdEnvelope?.result ?? createdEnvelope;
        if (createdResult.status !== 0 || createdEnvelope?.ok === false || !created?.task?.id) {
            const uncertain = reserveFailedStart(task, run, null, name, "task-create", createdResult);
            if (uncertain) break;
            continue;
        }
        const orchestrationTask = created.task;
        const startedResult = command(orca, [
            "orchestration", "worker-start", "--task", orchestrationTask.id,
            "--worktree", "new-child", "--name", name, "--agent", "codex",
            "--setup", "run", "--run", run.id, "--json",
        ], { allowFailure: true });
        const startedEnvelope = responseFromCommand(startedResult);
        const started = startedEnvelope?.result ?? startedEnvelope;
        if (startedResult.status !== 0 || !startedEnvelope || startedEnvelope.ok === false) {
            const uncertain = reserveFailedStart(task, run, orchestrationTask.id, name, "worker-start", startedResult);
            if (uncertain) break;
            continue;
        }
        clearState(`start:${task.id}`);
        log(`started ${task.id} as ${orchestrationTask.id}/${started?.dispatch?.id || "ready"}`);
    }
}

function dispatchableSelection() {
    const listed = command("pnpm", ["run", "backlog:dispatchable"], { cwd: root });
    const selectedTasks = JSON.parse(listed.stdout).selectedTasks || [];
    const rows = allTaskRows();
    const reservedRows = rows.filter((row) => reservedDispatchStatuses.has(row.status));
    const activeRows = rows.filter((row) => row.status === "dispatched");
    const failedStartReservations = Object.entries(reportState)
        .filter(([key]) => key.startsWith("start-reserved:"))
        .map(([key, value]) => ({ taskId: key.slice("start-reserved:".length), ...value }));
    const reservedIds = new Set([
        ...taskIdSet(reservedRows),
        ...failedStartReservations.map((reservation) => reservation.taskId),
    ]);
    const activeIds = taskIdSet(activeRows);
    const unknownStartCount = failedStartReservations.filter(
        (reservation) => reservation.uncertain && !activeIds.has(reservation.taskId),
    ).length;
    const activeCount = activeRows.length + unknownStartCount;
    return {
        selectedTasks,
        candidates: selectedTasks.filter((task) => !reservedIds.has(task.id)),
        reservedRows: [...reservedRows, ...failedStartReservations.map((reservation) => ({
            spec: reservation.taskId,
            status: reservation.uncertain ? "blocked" : "failed",
            id: reservation.taskId,
        }))],
        capacity: Math.max(0, dispatchSelection.max_tasks - activeCount),
    };
}

function acquireLock() {
    const lock = join(tmpdir(), "react-rich-media-hooks-task-coordinator.lock");
    try {
        const fd = openSync(lock, "wx");
        writeFileSync(fd, `${process.pid}\n`, "utf8");
        return { fd, lock };
    } catch (error) {
        if (error.code !== "EEXIST") throw error;
        try {
            const pid = Number(readFileSync(lock, "utf8").trim());
            process.kill(pid, 0);
            return null;
        } catch {
            unlinkSync(lock);
            const fd = openSync(lock, "wx");
            writeFileSync(fd, `${process.pid}\n`, "utf8");
            return { fd, lock };
        }
    }
}

function releaseLock(lockState) {
    if (!lockState) return;
    closeSync(lockState.fd);
    unlinkSync(lockState.lock);
}

function sweep() {
    processCompleted(allTaskRows());
    reconcileMergedOrphans();
    syncMain();
    const selection = dispatchableSelection();
    if (selection.selectedTasks.length === 0) {
        clearState("dispatch-reserved");
        logState("dispatch-selection", "no-leaf-candidate", "no dispatchable leaf task exists; no Run or Dispatch was created");
        return;
    }
    clearState("dispatch-selection");
    if (selection.capacity === 0) {
        clearState("dispatch-reserved");
        return;
    }
    if (selection.candidates.length === 0) {
        const fingerprint = selection.reservedRows
            .filter((row) => selection.selectedTasks.some((task) => task.id === backlogTaskId(row.spec || row.task_title)))
            .map((row) => `${backlogTaskId(row.spec || row.task_title)}:${row.status}:${row.dispatch_id || row.id}`)
            .sort()
            .join("|");
        logState("dispatch-reserved", fingerprint, "all selected leaf tasks are reserved across Runs; no duplicate Dispatch was created");
        return;
    }
    clearState("dispatch-reserved");
    const run = ensureRun();
    if (run.id === "dry-run") {
        log("dry-run: coordinator Run would be created");
        dispatchNext(run, selection.candidates.slice(0, selection.capacity));
        return;
    }
    dispatchNext(run, selection.candidates.slice(0, selection.capacity));
}

const lock = acquireLock();
if (!lock) {
    process.exit(0);
}

try {
    do {
        try {
            sweep();
            clearState("sweep-error");
        } catch (error) {
            logState("sweep-error", error.message, `sweep stopped safely: ${error.message}`);
        }
        if (!once) {
            const interval = Number(coordinator.poll_interval_seconds || 60);
            Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, interval * 1000);
        }
    } while (!once);
} finally {
    try {
        persistReportState();
    } finally {
        releaseLock(lock);
    }
}
