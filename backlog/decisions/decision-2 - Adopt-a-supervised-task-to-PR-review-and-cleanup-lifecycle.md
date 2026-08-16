---
id: decision-2
title: Adopt a supervised task-to-PR review and cleanup lifecycle
date: '2026-08-16 06:49'
status: accepted
---
## Context

The repository previously dispatched workers through full handoffs, leaving completion validation, pull-request publication, user review, merge, and exact Orca cleanup disconnected. The installed Backlog CLI 1.50.1 also creates Decision files with empty body placeholders and provides no Decision body update command. This body restores the accepted rationale without changing the Decision metadata or meaning; the canonical operational details remain in doc-2.


## Decision

Use a supervised task-to-PR lifecycle for every worker attempt:

`dispatched → completion_accepted → task_validated → draft_pr_ready → awaiting_user_review → approved → checks_passed → merged → cleanup_pending → completed`

Workers must start from a tracked Orca Run and Dispatch, report an explicit success or failure outcome, and validate the Backlog task before creating or updating one marked Draft PR. The flow must pause for explicit user approval bound to the task, Run, Dispatch, PR, and current head SHA. Merge requires that approval, successful checks for the current head, and an explicit repository-approved strategy. Cleanup may release only the exact Dispatch-owned worker session and worktree after verified merge; all failures, requested changes, rejected approvals, interruptions, and unknown results retain review artifacts and support idempotent recovery.


## Consequences

The lifecycle adds durable coordination state and a human review gate, but prevents untracked completion from causing unsafe merges or deletion. Repository files can define and validate the contract, while Orca and GitHub integrations must perform the external Run, PR, approval, check, merge, and exact-resource operations. If those integrations are unavailable, the lifecycle remains in a retained recovery state rather than claiming success.

## Decision Drivers

- Preserve worker, task, PR, approval, and cleanup provenance across retries and runtime restarts.
- Bind approval and checks to the exact reviewable head.
- Prevent automatic merge or cleanup before explicit approval and verified merge.
- Retain artifacts for every non-success path.

## Considered Options

1. Untracked full handoff with manual follow-up; rejected because completion and cleanup provenance are not durable.
2. Automatic merge and cleanup after a worker message; rejected because it bypasses review, checks, and recovery.
3. Tracked Run/Dispatch, Draft PR, explicit approval gate, current-head checks, and conditional exact cleanup; accepted.
4. Static repository files claiming to perform Orca/GitHub operations; rejected because they cannot authenticate or prove live-resource ownership.

## Related Tasks

- TASK-2 — Automate the task-to-PR review and cleanup lifecycle.
- TASK-1.1 — Its Draft PR and worktree remain protected by the same review and cleanup gate.
- TASK-1.2 — Its retained exploratory worktree remains outside the cleanup scope.
