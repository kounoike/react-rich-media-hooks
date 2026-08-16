import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const policyPath = resolve(root, ".orca/task-pr-lifecycle.json");
const runbookPath = resolve(root, "AGENTS.md");

const failures = [];
const expect = (condition, message) => {
  if (!condition) failures.push(message);
};

let policy;
let runbook;
try {
  policy = JSON.parse(await readFile(policyPath, "utf8"));
  runbook = await readFile(runbookPath, "utf8");
} catch (error) {
  console.error(`Unable to read lifecycle policy or runbook: ${error.message}`);
  process.exit(1);
}

const lifecycle = policy.lifecycle;
const successPath = lifecycle.states.success_path;
const retainedStates = lifecycle.states.retained_terminal_states;
const coordinator = lifecycle.coordinator;

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
    lifecycle.merge.allow_automatic_merge === false,
  "merge strategy must be explicit and automatic merge disabled",
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
  "coordinator's repository `main` worktree is read-only",
  "forbid_post_merge_backlog_updates",
  "explicit user approval",
  "current head SHA",
  "exact Dispatch-owned worker session",
  "`gh pr create/edit --body-file`",
  "literal backslash-n",
]) {
  expect(runbook.includes(phrase), `runbook evidence is missing: ${phrase}`);
}

if (failures.length > 0) {
  console.error("Task-to-PR lifecycle validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Task-to-PR lifecycle policy and runbook: OK");
