import { closeSync, existsSync, mkdirSync, openSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
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

function workerDispatchMap() {
    const result = orcaJson(["orchestration", "worker-list"], { allowFailure: true });
    const map = new Map();
    for (const worker of result?.workers || []) {
        const taskId = worker.taskId || worker.task_id || worker.task?.id;
        const dispatchId = worker.dispatchId || worker.dispatch_id || worker.dispatch?.id;
        if (taskId && dispatchId) map.set(taskId, dispatchId);
    }
    return map;
}

function allTaskRows() {
    const rows = [];
    const dispatches = workerDispatchMap();
    for (const run of runList().filter((candidate) => !candidate.legacy)) {
        try {
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

function getWorktree(worker) {
    const id = worker?.worker?.worktree_id;
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

function automaticEligibility(task, diff) {
    if (!automatic.enabled || !automatic.task_types.includes(task.type)) {
        return { eligible: false, reason: "task type is not in the automatic lane" };
    }
    if (diff.files.length > automatic.max_changed_files || diff.lines > automatic.max_changed_lines) {
        return { eligible: false, reason: "diff exceeds automatic lane limits" };
    }
    if (diff.files.some(isProtected)) {
        return { eligible: false, reason: "protected path changed" };
    }
    if (diff.files.some((path) => !path.startsWith("backlog/tasks/") && !path.startsWith("backlog/docs/"))) {
        return { eligible: false, reason: "change is not a task-record or research-document-only change" };
    }
    return { eligible: true, reason: "bounded non-decision task-record change" };
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
    const result = orcaJson(["orchestration", "worker-list"], { allowFailure: true });
    const owned = new Set();
    for (const worker of result?.workers || []) {
        const worktreeId =
            worker.resource?.worktreeId ||
            worker.worker?.worktree_id ||
            worker.worktreeId ||
            worker.worktree_id;
        if (!worktreeId) continue;
        if (worker.resource?.ownershipState === "owned" || worker.dispatchStatus === "dispatched") {
            owned.add(worktreeId);
        }
    }
    return owned;
}

function terminalsForWorktree(worktreeId) {
    const terminals = orcaJson(["terminal", "list"], { allowFailure: true })?.terminals || [];
    return terminals.filter((terminal) => terminal.worktreeId === worktreeId);
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
    if (worktree.branch) {
        const remote = command(
            "git",
            ["ls-remote", "--heads", "origin", `refs/heads/${worktree.branch}`],
            { cwd: root, allowFailure: true },
        );
        if (remote.status !== 0) {
            log(`retaining ${task.id}: could not verify remote branch ${worktree.branch}`);
            return false;
        }
        if (remote.stdout) {
            const deleted = command("git", ["push", "origin", "--delete", worktree.branch], {
                cwd: root,
                allowFailure: true,
            });
            if (deleted.status !== 0) {
                log(`retaining ${task.id}: remote branch deletion was not confirmed`);
                return false;
            }
        }
    }
    const terminals = terminalsForWorktree(worktree.id);
    for (const terminal of terminals) {
        const closed = orcaJson(["terminal", "close", "--terminal", terminal.handle], {
            allowFailure: true,
        });
        if (!closed) {
            log(`retaining ${task.id}: could not close terminal ${terminal.handle}`);
            return false;
        }
    }
    const removed = orcaJson(["worktree", "rm", "--worktree", `id:${worktree.id}`, "--force"], {
        allowFailure: true,
    });
    if (!removed) {
        log(`retaining ${task.id}: exact worktree removal was not confirmed`);
        return false;
    }
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
            log(`retaining ${task.id}: exact worktree is still owned by a worker`);
            continue;
        }
        const worktreePath = asPath(worktree.path || worktree.git?.path);
        const branch = String(worktree.branch || worktree.git?.branch || "").replace(/^refs\/heads\//, "");
        if (!worktreePath || !branch || !existsSync(worktreePath)) {
            log(`retaining ${task.id}: worktree path or branch is unavailable`);
            continue;
        }
        let taskRecord;
        try {
            taskRecord = taskFromWorktree(worktreePath, task.id);
        } catch (error) {
            log(`retaining ${task.id}: could not read the worktree task record (${error.message})`);
            continue;
        }
        if (!taskRecord || taskRecord.status !== "Done") {
            log(`retaining ${task.id}: worktree task record is not Done`);
            continue;
        }
        let status;
        try {
            status = gitStatus(worktreePath);
        } catch (error) {
            log(`retaining ${task.id}: could not inspect worktree status (${error.message})`);
            continue;
        }
        if (status) {
            log(`retaining ${task.id}: worktree has uncommitted files`);
            continue;
        }
        const mergedPr = mergedPrForBranch(branch);
        if (!mergedPr) {
            log(`retaining ${task.id}: no merged PR was proven for ${branch}`);
            continue;
        }
        if (dryRun) {
            log(`dry-run: would reclaim orphan ${task.id} after merged PR #${mergedPr.number}`);
            continue;
        }
        try {
            removeOrphanWorktree(
                { ...worktree, path: worktreePath, branch },
                task,
                mergedPr,
            );
        } catch (error) {
            log(`retaining ${task.id}: orphan cleanup failed (${error.message})`);
        }
    }
}

function checksPass(worktreePath) {
    const checks = [
        ["git", ["-C", worktreePath, "diff", "--check"]],
        ["pnpm", ["run", "validate:lifecycle"]],
    ];
    for (const [program, args] of checks) {
        const result = command(program, args, { cwd: worktreePath, allowFailure: true });
        if (result.status !== 0) return false;
    }
    return true;
}

function prList() {
    return ghJson(
        ["pr", "list", "--state", "all", "--limit", "100"],
        "number,title,body,headRefName,state,isDraft,mergedAt",
        { allowFailure: true },
    ) || [];
}

function prFor(taskId, runId, branch) {
    const marker = `<!-- lifecycle-task: ${taskId} run: ${runId} -->`;
    return prList().find((pr) => pr.headRefName === branch && String(pr.body || "").includes(marker)) ||
        prList().find((pr) => pr.headRefName === branch) ||
        null;
}

function writePrBody(task, taskId, runId, dispatchId, worktree, diff, completion) {
    const marker = `<!-- lifecycle-task: ${taskId} run: ${runId} -->`;
    const lines = [
        marker,
        "",
        `Backlog task: ${taskId} — ${task.title}`,
        `Run: ${runId}`,
        `Dispatch: ${dispatchId}`,
        `Worktree: ${worktree.id}`,
        "",
        "## Summary",
        completion.body || "Worker reported successful completion.",
        "",
        "## Files modified",
        ...diff.files.map((path) => `- ${path}`),
        "",
        "## Validation",
        "- `git diff --check`",
        "- `pnpm run validate:lifecycle`",
        "",
        "## Recovery state",
        "Coordinator owns PR publication, automatic-lane eligibility, merge, and exact resource cleanup.",
    ];
    const directory = join(tmpdir(), "react-rich-media-hooks");
    mkdirSync(directory, { recursive: true });
    const path = join(directory, `${taskId.toLowerCase().replaceAll(".", "-")}-${runId}.md`);
    writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
    return path;
}

function ensureDraftPr(task, taskId, runId, dispatchId, worktree, diff, completion) {
    let pr = prFor(taskId, runId, worktree.branch);
    const bodyPath = writePrBody(task, taskId, runId, dispatchId, worktree, diff, completion);
    const title = `${task.type}: ${task.title}`;
    if (!pr) {
        if (dryRun) {
            log(`dry-run: would create Draft PR for ${taskId} from ${worktree.branch}`);
            return { number: null, draft: true, state: "OPEN", dryRun: true };
        }
        const created = command("gh", [
            "pr", "create", "--draft", "--base", "main", "--head", worktree.branch,
            "--title", title, "--body-file", bodyPath,
        ], { cwd: worktree.path });
        const number = Number(created.stdout.match(/\/pull\/(\d+)/)?.[1]);
        if (!number) throw new Error(`Could not parse created PR number: ${created.stdout}`);
        pr = { number, body: readFileSync(bodyPath, "utf8"), isDraft: true, state: "OPEN" };
    } else if (!dryRun && pr.isDraft) {
        command("gh", ["pr", "edit", String(pr.number), "--body-file", bodyPath], { cwd: worktree.path });
    }
    if (!dryRun) {
        const inspected = ghJson(
            ["pr", "view", String(pr.number)],
            "body,state,isDraft,headRefOid,statusCheckRollup",
            { cwd: worktree.path },
        );
        if (String(inspected.body || "").includes("\\n")) {
            throw new Error(`PR #${pr.number} contains literal backslash-n; refusing to continue`);
        }
        pr = { ...pr, ...inspected };
    }
    return pr;
}

function mergeAutomaticPr(pr, worktreePath) {
    if (dryRun) {
        log(`dry-run: would mark PR #${pr.number} ready and squash-merge it`);
        return true;
    }
    if (pr.state === "MERGED") return true;
    if (pr.isDraft) command("gh", ["pr", "ready", String(pr.number)], { cwd: worktreePath });
    const merge = command("gh", ["pr", "merge", String(pr.number), "--squash"], {
        cwd: worktreePath,
        allowFailure: true,
    });
    const after = ghJson(["pr", "view", String(pr.number)], "state,mergedAt", { cwd: worktreePath });
    if (after.state === "MERGED") return true;
    if (merge.status !== 0) {
        throw new Error(`PR #${pr.number} merge failed: ${merge.stderr || merge.stdout}`);
    }
    return false;
}

function releaseExactWorker(dispatchId, worktree) {
    if (dryRun) {
        log(`dry-run: would release ${dispatchId} and remove ${worktree.id}`);
        return;
    }
    const released = orcaJson(["orchestration", "worker-release", "--dispatch", dispatchId], {
        allowFailure: true,
    });
    if (!released) {
        throw new Error(`worker-release did not settle ${dispatchId}; retaining artifacts`);
    }
    orcaJson(["worktree", "rm", "--worktree", `id:${worktree.id}`, "--force"], {
        allowFailure: true,
    });
    if (worktree.branch) {
        command("git", ["push", "origin", "--delete", worktree.branch], {
            cwd: root,
            allowFailure: true,
        });
    }
}

const completedRowsReleased = new Set();

function processCompleted(rows) {
    for (const row of rows.filter((candidate) => candidate.status === "completed")) {
        if (completedRowsReleased.has(row.id)) continue;
        if (!row.dispatch_id) {
            log(`retaining ${row.id}: no active or settled Dispatch was found in worker-list`);
            continue;
        }
        try {
            if (processCompletedRow(row.runId, row)) completedRowsReleased.add(row.id);
        } catch (error) {
            log(`retaining ${row.id}: ${error.message}`);
        }
    }
}

function processCompletedRow(runId, row) {
        const worker = getWorker(row.dispatch_id);
        const worktree = getWorktree(worker);
        if (!worker?.worker || !worktree?.path || !worktree.branch) {
            log(`retaining ${row.id}: settled worker or exact worktree is unavailable`);
            return false;
        }
        const taskId = backlogTaskId(row.spec || row.task_title);
        if (!taskId) {
            log(`retaining ${row.id}: no Backlog task id in spec`);
            return false;
        }
        const task = taskFromWorktree(worktree.path, taskId);
        if (!task || task.status !== "Done") {
            log(`retaining ${taskId}: worker task record is not Done`);
            return false;
        }
        if (gitStatus(worktree.path)) {
            log(`retaining ${taskId}: worker left uncommitted files in ${worktree.branch}`);
            return false;
        }
        command("git", ["-C", worktree.path, "fetch", "origin", "main", "--quiet"]);
        command("git", ["-C", worktree.path, "push", "--set-upstream", "origin", worktree.branch]);
        const diff = changedFiles(worktree.path);
        if (!checksPass(worktree.path)) {
            log(`retaining ${taskId}: current-head checks failed`);
            return;
        }
        const completion = (() => {
            try {
                return JSON.parse(row.result || "{}");
            } catch {
                return {};
            }
        })();
        const eligibility = automaticEligibility(task, diff);
        const pr = ensureDraftPr(task, taskId, runId, row.dispatch_id, worktree, diff, completion);
        log(`${taskId}: Draft PR #${pr.number ?? "pending"}; automatic lane=${eligibility.eligible ? "eligible" : `manual (${eligibility.reason})`}`);
        if (!eligibility.eligible || pr.dryRun) return false;
        if (!mergeAutomaticPr(pr, worktree.path)) {
            log(`retaining ${taskId}: merge result is unknown or unsuccessful`);
            return false;
        }
        releaseExactWorker(row.dispatch_id, worktree);
        log(`${taskId}: merged and exact worker/worktree cleanup completed`);
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
        "Before completion, verify acceptance criteria, mark only this Backlog task Done, commit the task record and all work on this branch with an English Conventional Commit, and push the branch to origin so the coordinator can publish the Draft PR.",
        "Send exactly one worker_done with outcome succeeded or failed using the injected task and dispatch IDs, then stop. Do not start another Backlog task, edit workflow policy, or keep working after worker_done.",
        `Selected task: ${task.id} — ${task.title}`,
    ].join("\n");
}

function dispatchNext(run, rows) {
    const active = allTaskRows().filter((row) => row.status === "dispatched");
    const capacity = Math.max(0, dispatchSelection.max_tasks - active.length);
    if (capacity === 0) return;
    const existing = new Set([
        ...taskIdSet(rows),
        ...taskIdSet(
            allTaskRows().filter((row) => reservedDispatchStatuses.has(row.status)),
        ),
    ]);
    const listed = command("pnpm", ["run", "backlog:dispatchable"], { cwd: root });
    const candidates = JSON.parse(listed.stdout).selectedTasks || [];
    for (const task of candidates.filter((candidate) => !existing.has(candidate.id)).slice(0, capacity)) {
        const spec = workerSpec(task);
        if (dryRun) {
            log(`dry-run: would worker-start ${task.id}`);
            continue;
        }
        const created = orcaJson([
            "orchestration", "task-create", "--spec", spec,
            "--task-title", `${task.id} ${task.title}`,
            "--display-name", task.id,
            "--run", run.id,
        ]);
        const orchestrationTask = created.task;
        const name = `${task.id.toLowerCase().replaceAll(".", "-")}-${slugify(task.title)}`;
        const started = orcaJson([
            "orchestration", "worker-start", "--task", orchestrationTask.id,
            "--worktree", "new-child", "--name", name, "--agent", "codex",
            "--setup", "run", "--run", run.id,
        ]);
        if (!started?.ready) throw new Error(`worker-start for ${task.id} did not become ready`);
        log(`started ${task.id} as ${orchestrationTask.id}/${started.dispatch?.id || "dispatch"}`);
        existing.add(task.id);
    }
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
    const run = ensureRun();
    if (run.id === "dry-run") {
        log("dry-run: coordinator Run would be created");
        reconcileMergedOrphans();
        return;
    }
    const rows = taskRows(run.id);
    processCompleted(allTaskRows());
    reconcileMergedOrphans();
    syncMain();
    dispatchNext(run, taskRows(run.id));
}

const lock = acquireLock();
if (!lock) {
    log("another coordinator invocation is already running; exiting without a second sweep");
    process.exit(0);
}

try {
    do {
        try {
            sweep();
        } catch (error) {
            log(`sweep stopped safely: ${error.message}`);
        }
        if (!once) {
            const interval = Number(coordinator.poll_interval_seconds || 60);
            Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, interval * 1000);
        }
    } while (!once);
} finally {
    releaseLock(lock);
}
