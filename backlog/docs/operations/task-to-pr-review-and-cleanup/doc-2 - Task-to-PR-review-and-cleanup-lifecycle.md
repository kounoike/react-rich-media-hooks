---
id: doc-2
title: Task-to-PR review and cleanup lifecycle
type: guide
created_date: '2026-08-16 06:49'
updated_date: '2026-08-16 06:54'
---
# Task-to-PR Review and Cleanup Lifecycle

This guide is the canonical operational contract for TASK-2 and the reasoning record for accepted decision-2, **Adopt a supervised task-to-PR review and cleanup lifecycle**. It applies to every worker change in this repository, including documentation-only changes.

## Context

A worker can finish in an Orca terminal without the surrounding lifecycle knowing whether the Backlog task was validated, whether a pull request already exists, whether a user reviewed the exact head, or whether cleanup is safe. A full handoff does not provide the durable Run, Dispatch, completion outcome, review gate, or recovery identity required to connect those stages.

The repository contains the policy at `.orca/task-pr-lifecycle.json`. That file is deliberately declarative. Orca owns worker/session/worktree state, GitHub owns pull-request/check/merge state, and Backlog owns task state. This guide defines the contract between them.

## Decision Drivers

- Preserve a durable Run and Dispatch for every worker attempt, with explicit success and failure outcomes.
- Make a successful completion observable in Backlog before publishing or updating a pull request.
- Require explicit user approval for the exact pull-request head; a coordinator must never infer approval from a worker completion.
- Make required checks and the repository-approved merge strategy prerequisites for merge.
- Release only the exact worker session and worktree created or owned by this lifecycle, and only after a verified successful merge.
- Retain review artifacts on every non-success path so a restart or retry can resume instead of destroying evidence.
- Make duplicate messages, retries, and unknown remote results safe and auditable.
- State the boundary between repository policy and runtime integrations without claiming static configuration performs remote actions.

## Considered Options

1. **Untracked full handoff with manual follow-up.** This is simple to start but loses durable completion provenance, cannot bind approval to a head SHA, and makes cleanup unsafe. Rejected.
2. **Automatic merge and cleanup after a successful worker message.** This shortens the happy path but bypasses user review, required checks, and recovery for stale or duplicate messages. Rejected.
3. **A tracked Run/Dispatch with draft PR, explicit approval gate, and conditional cleanup.** This adds state and record keeping, but preserves reviewability and makes retries idempotent. Accepted.
4. **Repository-only automation that claims to create Runs, merge PRs, or delete worktrees.** Static files cannot authenticate to Orca or GitHub and cannot prove ownership of a live process. Rejected as an implementation claim; the exact runtime contract is documented below.

## Decision

Use the supervised lifecycle in this order:

`dispatched → completion_accepted → task_validated → draft_pr_ready → awaiting_user_review → approved → checks_passed → merged → cleanup_pending → completed`

The following states retain all review artifacts and are not successful completion:

`completion_failed`, `pr_failed`, `checks_failed`, `changes_requested`, `approval_rejected`, `interrupted`, `restart_recovery`, and `merge_unknown`.

### Non-negotiable invariants

1. A worker starts only from a tracked Orca Run and Dispatch. The Run and Dispatch IDs, task ID, exact worker session ID, exact worktree ID/path, branch, and attempt status are persisted before completion is processed.
2. A completion is accepted only when it is a single, matching `worker_done` for the active task and Dispatch with an explicit `succeeded` or `failed` outcome. A duplicate exact message is a reconciliation no-op; a conflicting replay is retained and escalated.
3. A successful completion validates the Backlog task and records files, commands, and results before a draft PR is created or updated. There is at most one lifecycle PR per task, found using the marker `<!-- lifecycle-task: {task_id} run: {run_id} -->` and then the task/head identity.
4. The PR remains a draft until the completion record, task validation, task context, and validation details are present. PR creation failure retains the branch, worktree, and logs and retries with the same marker.
5. The lifecycle pauses at an explicit user review gate. Approval is bound to the task, Run, Dispatch, PR number, and current head SHA. Pending, rejected, or requested-change decisions do not permit merge or cleanup.
6. Merge requires the recorded approval, a fresh current-head check, every required check successful, and an explicit repository-approved merge strategy. Automatic merge is disabled by this contract.
7. Cleanup is legal only after the PR is verified merged. It releases the exact Dispatch-owned worker session and removes only the exact worktree identity recorded by the Run. It must not use a path, branch name, or terminal selected by guesswork.
8. Branch, PR, worktree, worker/session output, and logs are retained for failed checks, requested changes, rejected approval, PR errors, interruptions, restarts, and unknown merge results. Branch deletion, if any, is solely part of the approved merge strategy, never an unconditional cleanup shortcut.

### Required lifecycle record

Persist or link these fields in the Run and Backlog task notes:

- `task_id`, `run_id`, `dispatch_id`, `completion_id`, and lifecycle state.
- Worker session ID, worktree ID, absolute worktree path, branch, and initial/current head SHA.
- PR number, URL, lifecycle marker, draft state, current head SHA, approval decision, required-check snapshot, merge commit SHA, and timestamps.
- Files modified, validation commands, exit status/results, and retained log locations.
- On recovery, the last durable state, the next safe action, and the reason any artifact is intentionally retained.

## Operating procedure

### 1. Start a supervised attempt

Create or bind one Orca Run for the objective, create a tracked orchestration Task for the Backlog task, and attach a Dispatch to the exact worker terminal/worktree. Do not use a full handoff for work that must later report completion.

Before sending work, record the task ID and the returned Run/Dispatch/resource identities. If the worker start is unknown, inspect the Dispatch and resource state; do not start a second worker merely because a command timed out.

The worker reports exactly once with its task ID, Dispatch ID, explicit outcome, three-sentence summary, and modified files. Heartbeats are liveness signals only and never authorize merge or cleanup.

### 2. Accept and validate completion

The coordinator first matches the task ID and Dispatch ID to the active Run, then deduplicates by completion ID and payload hash. For `succeeded`:

1. Read the Backlog task and verify that the requested scope and every applicable acceptance criterion have objective evidence.
2. Check that every reported file belongs to the lifecycle worktree and that the validation commands/results are reproducible. At minimum run `git diff --check` and the repository checks relevant to the changed files.
3. Append the completion outcome, Run/Dispatch/resource identities, files, and validation evidence to the Backlog task. Do not mark the task terminal until finalization rules have been followed.
4. Find a PR by the lifecycle marker. If none exists, create one draft PR; if one exists, update it rather than creating a duplicate. The title/body must include the task, Run, Dispatch, summary, files, validation details, and recovery state.
5. Reconcile the PR head SHA with the completion record and enter `awaiting_user_review`.

For `failed`, or for a successful payload that does not validate, record `completion_failed` and retain all artifacts. A retry uses a new Dispatch attempt while retaining the original Run/task/PR identities; it does not erase the failed record.

### 3. Pause for explicit review

Create a user-facing approval gate for the task and draft PR. The gate must display the PR URL, current head SHA, validation evidence, retained-resource identities, and the exact consequences of approval or rejection.

Only an explicit approval that names or durably binds the task, Run, Dispatch, PR number, and head SHA can move the state to `approved`. A changed head invalidates the approval and returns to `awaiting_user_review`. Rejection and requested changes move to their retained states. An interruption or runtime restart moves to `restart_recovery` until state is reconciled.

No merge, worker release, session closure, or worktree deletion is allowed while the gate is pending, rejected, or requested changes.

### 4. Verify checks and merge

After approval, refresh the PR and compare its current head SHA to the approved SHA. Re-run or inspect all repository-required checks; pending, missing, cancelled, or failed checks are not success. Resolve the configured repository-approved merge strategy before invoking merge; the placeholder strategy in the JSON policy is a guard that prevents an unapproved default from being silently selected.

Invoke the GitHub integration using that approved strategy with automatic merge disabled. Record the PR number, merge commit SHA, merged timestamp, strategy, and check snapshot in the Backlog task. If the API reports an unknown result, inspect the PR and repository history first. Treat an already-merged PR as success only after verifying the expected PR/head/task identity; otherwise remain in `merge_unknown` with artifacts retained.

### 5. Release exact resources after merge

Once the merge result is verified, transition to `cleanup_pending` and resolve the exact Dispatch-owned worker session and worktree recorded at start. Use the Dispatch-scoped worker-release operation and the runtime's exact worktree removal operation; never close a terminal by title, delete a branch to find a worktree, or remove a broad directory.

If an identity cannot be proven, leave it retained and record the reason. Replaying cleanup after a successful release must be a safe no-op. Record each release/removal result in the Backlog task, then mark the lifecycle `completed` only after the merge and cleanup records are durable. A merge success never authorizes cleanup of the coordinator, another task's worktree, the retained TASK-1.2 exploratory worktree, or any pre-existing user terminal.

## Recovery and idempotency

| Event | Safe state/action | Prohibited action |
| --- | --- | --- |
| Runtime restart | Locate the Run by ID, reconcile Backlog state and the marked PR, and continue from the last durable state. | Starting a second Run/Dispatch or deleting artifacts because the in-memory state is missing. |
| Duplicate completion | Match task + Dispatch + completion ID/payload hash; ignore an exact replay and reconcile the existing PR/state. | Creating a second PR, running cleanup, or merging based on a replay alone. |
| Conflicting completion replay | Retain both records, mark the attempt failed or blocked, and escalate for review. | Overwriting the first completion or choosing the newer message silently. |
| Worker start timeout/unknown | Inspect Dispatch/resource state; retry only after the original is proven stopped/failed, with an explicit new attempt identity. | Launching a replacement while the original may still be live. |
| PR creation/update failure | Retain branch, worktree, logs, and task record; retry lookup/create with the same marker after GitHub availability returns. | Falling back to an unmarked PR or merging a branch without a reviewed PR. |
| CI/check failure | Enter `checks_failed`; retain PR, branch, worktree, session output, and logs, then rerun/fix and invalidate any stale approval. | Merge, release, or worktree deletion. |
| Review requested changes | Enter `changes_requested`; keep the same PR and artifacts, dispatch a follow-up attempt or same worker explicitly, and require a new completion and review. | Closing the PR or deleting the worker resources. |
| Approval rejected | Enter `approval_rejected`; retain all artifacts and require a new explicit gate if the user reopens the work. | Treating rejection as approval or cleaning up. |
| Interruption | Enter `interrupted`; preserve state and logs, then resume/reconcile from IDs after the runtime returns. | Guessing whether merge or cleanup occurred. |
| Merge result unknown | Inspect PR state and commit ancestry; if not merged, retry only with the same approved head/strategy; if merged, record and proceed to exact cleanup. | Retrying blindly or releasing before verification. |
| Cleanup retry | Re-run only the exact Dispatch/worktree release for the verified merged attempt; completed release is idempotent. | Broad process, terminal, branch, or directory cleanup. |

The idempotency keys are `task_id`, `run_id`, `dispatch_id`, `completion_id`, the PR marker, and `head_sha`. State transitions are monotonic except for explicitly recorded recovery or a new review-requested attempt. A new attempt never erases the prior attempt's logs or PR context.

## Consequences

The accepted lifecycle adds durable state and a human pause to every task-to-PR attempt. It trades a shorter happy path for reviewable provenance, safe recovery, and a strict guarantee that a failure cannot silently delete its evidence. Existing runtime integrations must supply the gate, check, merge, and exact-resource operations; this repository does not pretend that policy files perform them.

## Related Tasks

- TASK-2 — Automate the task-to-PR review and cleanup lifecycle.
- TASK-1.1 — Its retained draft PR and worker lifecycle are protected by this contract; this task does not alter or clean it up.
- TASK-1.2 — Its retained exploratory worktree is explicitly outside the cleanup scope.

## Enforcement boundary and limitation

The JSON policy and this guide can be reviewed, versioned, and checked in a pull request, but they cannot authenticate to Orca or GitHub, create a Run/Dispatch, receive a worker message, resolve user identity, inspect branch protection, merge a PR, or delete a worktree. The runtime coordinator must implement the procedure using Orca orchestration and the repository's GitHub integration. If either integration is unavailable, the lifecycle stops in a retained state; it does not claim that the action happened.

The repository therefore enforces only the reviewable contract:

- A configuration review can reject a missing Run/Dispatch requirement, missing approval gate, unsafe cleanup scope, or disabled artifact retention.
- A runbook review can verify that every failure path has a recovery action and that no path authorizes early cleanup.
- Runtime checks must enforce the external invariants and append their evidence to Backlog and the PR. Branch protection, required-check names, and the exact merge strategy remain repository/organization settings and must be supplied before a live run.

## Verification checklist

Before accepting a lifecycle implementation or recovery run:

- [ ] The Run and Dispatch are tracked and their IDs/resources are recorded.
- [ ] Worker completion has one explicit outcome and is deduplicated.
- [ ] The Backlog task was validated and updated with scope, files, commands, and results.
- [ ] Exactly one draft PR is found or created using the lifecycle marker.
- [ ] The approval gate is explicit and bound to the current PR head.
- [ ] Required checks are successful for that same head and the approved merge strategy is recorded.
- [ ] Merge result and commit SHA are recorded before cleanup.
- [ ] Only the exact worker session and worktree are released after verified merge.
- [ ] Every failure/interruption/restart path retains PR, branch, worktree, and logs.
- [ ] A runtime limitation is recorded instead of claiming a repository file performed a remote action.

## Related records

- Accepted decision: `decision-2`, **Adopt a supervised task-to-PR review and cleanup lifecycle**.
- Backlog task: `TASK-2`, **Automate the task-to-PR review and cleanup lifecycle**.
- Machine-readable policy: `.orca/task-pr-lifecycle.json`.
