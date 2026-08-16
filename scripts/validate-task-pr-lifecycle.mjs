import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const policyPath = resolve(root, ".orca/task-pr-lifecycle.json");
const runbookPath = resolve(root, "AGENTS.md");
const packagePath = resolve(root, "package.json");
const dispatchScriptPath = resolve(root, "scripts/list-dispatchable-tasks.mjs");

const failures = [];
const expect = (condition, message) => {
  if (!condition) failures.push(message);
};

let policy;
let runbook;
let packageJson;
let dispatchScript;
try {
  const [policyText, runbookText, packageText, dispatchScriptText] =
    await Promise.all([
      readFile(policyPath, "utf8"),
      readFile(runbookPath, "utf8"),
      readFile(packagePath, "utf8"),
      readFile(dispatchScriptPath, "utf8"),
    ]);
  policy = JSON.parse(policyText);
  runbook = runbookText;
  packageJson = JSON.parse(packageText);
  dispatchScript = dispatchScriptText;
} catch (error) {
  console.error(`Unable to read lifecycle policy or dispatch guard: ${error.message}`);
  process.exit(1);
}

const lifecycle = policy.lifecycle;
const successPath = lifecycle.states.success_path;
const retainedStates = lifecycle.states.retained_terminal_states;
const coordinator = lifecycle.coordinator;
const dispatchSelection = lifecycle.dispatch_selection;
const worktreeCreation = lifecycle.worktree_creation;
const completionModes = lifecycle.completion_modes;
const automaticCompletion = completionModes.automatic;
const automaticSuccessPath = lifecycle.states.automatic_success_path;

expect(policy.version === 1, "policy version must be 1");
expect(lifecycle.id === "task-to-pr-review-cleanup", "lifecycle id is missing");
expect(lifecycle.run.required === true, "a tracked Run is required");
expect(lifecycle.run.dispatch_required === true, "a tracked Dispatch is required");
expect(
  coordinator.main_workspace_policy === "read_only_for_task_records" &&
    coordinator.require_clean_main_before_dispatch === true &&
    coordinator.forbid_task_file_writes_from_main === true &&
    coordinator.forbid_post_merge_backlog_updates === true &&
    coordinator.task_record_owner === "worker_task_worktree_before_draft_pr",
  "coordinator main/task-record ownership rules must be explicit",
);
expect(
  dispatchSelection.command === "pnpm run backlog:dispatchable" &&
    dispatchSelection.source_of_truth === "backlog-cli" &&
    dispatchSelection.required_status === "To Do" &&
    dispatchSelection.requires_ready === true &&
    dispatchSelection.requires_leaf_task === true &&
    dispatchSelection.reject_if_has_subtasks === true &&
    dispatchSelection.selection_order.join(",") === "priority,ordinal" &&
    dispatchSelection.max_tasks === 1 &&
    dispatchSelection.no_candidate_action ===
      "report_and_stop_before_run_or_dispatch",
  "dispatch selection must require exactly one ready leaf task",
);
expect(
  worktreeCreation.single_flight === true &&
    worktreeCreation.poll_command_until_exit === true &&
    worktreeCreation.indeterminate_results.join(",") ===
      "empty_output,timeout,runtime_unavailable" &&
    worktreeCreation.before_retry.join(",") ===
      "orca_worktree_list,git_worktree_list" &&
    worktreeCreation.retry_only_when_target_absent === true &&
    worktreeCreation.duplicate_policy ===
      "stop_and_reconcile_exact_target",
  "worktree creation must be single-flight and polled before retry",
);
expect(
  completionModes.default === "manual_review" &&
    automaticCompletion.enabled === true &&
    automaticCompletion.task_types.join(",") === "spike,docs,bug,chore,task" &&
    automaticCompletion.max_changed_files === 10 &&
    automaticCompletion.max_changed_lines === 300 &&
    automaticCompletion.requires_no_decision_changes === true &&
    automaticCompletion.requires_no_user_decision === true &&
    automaticCompletion.requires_no_public_api_changes === true &&
    automaticCompletion.requires_no_compatibility_changes === true &&
    automaticCompletion.requires_no_distribution_changes === true &&
    automaticCompletion.requires_current_head_checks === true &&
    automaticCompletion.fallback === "manual_review" &&
    automaticCompletion.protected_paths.includes("backlog/decisions/**") &&
    automaticCompletion.protected_paths.includes(".github/**") &&
    automaticCompletion.protected_paths.includes("package.json"),
  "automatic completion must be limited to small non-Decision changes",
);
expect(
  packageJson.scripts?.["backlog:dispatchable"] ===
    "node scripts/list-dispatchable-tasks.mjs" &&
    dispatchScript.includes('"--ready"') &&
    dispatchScript.includes("subtasks"),
  "the dispatchable-task script must be installed and filter ready parent tasks",
);
expect(
  lifecycle.pull_request.body_encoding_policy === "body_file_or_actual_newlines" &&
    lifecycle.pull_request.reject_literal_backslash_n === true,
  "PR body encoding must use real newlines and reject literal backslash-n",
);
expect(
  lifecycle.run.forbid_untracked_full_handoff === true,
  "untracked full handoffs must be forbidden",
);
expect(
  lifecycle.run.tracked_outcomes.includes("succeeded") &&
    lifecycle.run.tracked_outcomes.includes("failed"),
  "both succeeded and failed outcomes must be tracked",
);
expect(
  successPath.join(",") ===
    "dispatched,completion_accepted,task_validated,draft_pr_ready,awaiting_user_review,approved,checks_passed,merged,cleanup_pending,completed",
  "success path must pause for review before checks, merge, and cleanup",
);
expect(
  automaticSuccessPath.join(",") ===
    "dispatched,completion_accepted,task_validated,draft_pr_ready,checks_passed,merged,cleanup_pending,completed",
  "automatic success path must bypass only the explicit review gate",
);
for (const state of [
  "completion_failed",
  "pr_failed",
  "checks_failed",
  "changes_requested",
  "approval_rejected",
  "interrupted",
  "restart_recovery",
  "merge_unknown",
]) {
  expect(retainedStates.includes(state), `${state} must retain artifacts`);
}
expect(
  lifecycle.states.retained_artifacts.join(",") ===
    "pull_request,branch,worktree,logs",
  "all review artifacts must be retained on non-success paths",
);
expect(
  lifecycle.completion.accepted_only_from_active_dispatch === true,
  "completion must come from the active Dispatch",
);
expect(
  lifecycle.completion.duplicate_policy ===
    "ignore_exact_replay_and_reconcile_state",
  "duplicate completion handling must be idempotent",
);
expect(lifecycle.pull_request.draft === true, "the first PR must be a draft");
expect(lifecycle.pull_request.one_per_task === true, "one PR per task is required");
expect(
  lifecycle.pull_request.idempotency_marker.includes("{task_id}") &&
    lifecycle.pull_request.idempotency_marker.includes("{run_id}"),
  "PR lookup must use a task/Run marker",
);
expect(lifecycle.review_gate.required === true, "explicit user review is required");
expect(
  lifecycle.review_gate.kind === "explicit_user_approval",
  "the review gate must be an explicit user approval",
);
expect(
  lifecycle.review_gate.automatic_mode.enabled === true &&
    lifecycle.review_gate.automatic_mode.requires_eligibility === true &&
    lifecycle.review_gate.automatic_mode.approval_required === false &&
    lifecycle.review_gate.automatic_mode.bypasses_manual_approval_gate === true &&
    lifecycle.review_gate.automatic_mode.bypasses.join(",") ===
      "forbid_merge_before_approval,forbid_cleanup_before_approval_and_merge" &&
    lifecycle.review_gate.automatic_mode.fallback === "manual_review",
  "automatic review mode must explicitly bypass only the manual approval gate",
);
expect(
  lifecycle.review_gate.forbid_merge_before_approval === true &&
    lifecycle.review_gate.forbid_cleanup_before_approval_and_merge === true,
  "merge and cleanup must be blocked before approval",
);
expect(
  lifecycle.merge.required_approval === true &&
    lifecycle.merge.required_checks === true &&
    lifecycle.merge.checks_must_be_successful_for_current_head === true,
  "merge must require approval and current-head checks",
);
expect(
  lifecycle.merge.strategy_must_be_explicit === true &&
    lifecycle.merge.allow_automatic_merge === true &&
    lifecycle.merge.automatic_merge_requires_eligibility === true &&
    lifecycle.merge.automatic_mode_overrides_required_approval === true,
  "merge strategy must be explicit and automatic merge eligibility-gated",
);
expect(
  lifecycle.cleanup.trigger === "successful_merge_only" &&
    lifecycle.cleanup.require_identity_match === true &&
    lifecycle.cleanup.delete_unrelated_resources === false,
  "cleanup must be exact-resource and merge-gated",
);
expect(
  lifecycle.idempotency.duplicate_pr_policy === "update_existing_marked_pr" &&
    lifecycle.idempotency.duplicate_merge_policy ===
      "treat_already_merged_as_success_after_verification" &&
    lifecycle.idempotency.duplicate_cleanup_policy ===
      "safe_noop_after_exact_resource_release",
  "PR, merge, and cleanup retries must be idempotent",
);

for (const heading of ["### Supervised task-to-PR workflow"]) {
  expect(runbook.includes(heading), `runbook heading is missing: ${heading}`);
}
for (const phrase of [
  "tracked Orca Run and Dispatch",
  "worker owns changes to its Backlog task",
  "Dispatchable task selection is leaf-only",
  "pnpm run backlog:dispatchable",
  "Parent/roll-up tasks must never be dispatched directly",
  "do not create a Run, Dispatch, worktree, or worker",
  "artificial dependencies",
  "Worktree creation is single-flight",
  "poll that exact command session until it exits",
  "runtime_unavailable",
  "never issue a second create",
  "coordinator's repository `main` worktree is read-only",
  "forbid_post_merge_backlog_updates",
  "explicit user approval",
  "current head SHA",
  "exact Dispatch-owned worker session",
  "`gh pr create/edit --body-file`",
  "literal backslash-n",
  "Lifecycle review has two lanes",
  "at most 10 files and 300 changed lines",
  "no unresolved user decision",
  "fall back to manual review",
  "Automatic completion still requires",
]) {
  expect(runbook.includes(phrase), `runbook evidence is missing: ${phrase}`);
}

if (failures.length > 0) {
  console.error("Task-to-PR lifecycle validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Task-to-PR lifecycle policy and runbook: OK");
