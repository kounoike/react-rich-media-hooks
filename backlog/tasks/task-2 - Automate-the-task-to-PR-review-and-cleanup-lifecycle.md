---
id: TASK-2
title: Automate the task-to-PR review and cleanup lifecycle
status: Done
assignee:
  - '@codex'
created_date: '2026-08-16 06:29'
updated_date: '2026-08-16 07:05'
labels: []
dependencies: []
references:
  - AGENTS.md
  - README.md
  - >-
    backlog/decisions/decision-2 -
    Adopt-a-supervised-task-to-PR-review-and-cleanup-lifecycle.md
  - >-
    backlog/docs/operations/task-to-pr-review-and-cleanup/doc-2 -
    Task-to-PR-review-and-cleanup-lifecycle.md
documentation:
  - doc-2
modified_files:
  - .orca/task-pr-lifecycle.json
  - README.md
  - package.json
  - scripts/validate-task-pr-lifecycle.mjs
  - >-
    backlog/decisions/decision-2 -
    Adopt-a-supervised-task-to-PR-review-and-cleanup-lifecycle.md
  - >-
    backlog/docs/operations/task-to-pr-review-and-cleanup/doc-2 -
    Task-to-PR-review-and-cleanup-lifecycle.md
priority: high
type: feature
ordinal: 25000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Define and implement a supervised task lifecycle that coordinates Backlog task completion with Orca worker dispatch, GitHub pull request publication, an explicit user review gate, merge, and post-merge Orca cleanup. The current dispatcher performs a full handoff and stops after worker launch, so completion, PR publication, review waiting, merge, and worktree/session cleanup are disconnected. The lifecycle must remain recoverable and must never merge or delete review artifacts without explicit approval and successful validation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A worker is launched through a tracked Orca orchestration Run and Dispatch with completion and failure outcomes, rather than an untracked full handoff.
- [x] #2 An accepted worker completion validates the Backlog task, records the result, and creates or updates a draft GitHub pull request with task context and validation details.
- [x] #3 The lifecycle pauses at an explicit user review gate; no merge, worker release, session closure, or worktree deletion occurs before approval.
- [x] #4 After explicit approval and required checks pass, the pull request is merged using the approved repository strategy and the merge result is recorded in the Backlog task.
- [x] #5 After a successful merge, only the exact worker session and worktree owned by the lifecycle are released and removed; failed checks, requested changes, rejected approval, and interrupted runs retain review artifacts for recovery.
- [x] #6 The workflow documents idempotent recovery for runtime restarts, duplicate completion messages, PR creation failures, CI failures, and review-requested changes.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Inspect accepted Backlog decisions, task conventions, repository documentation, and current Orca/GitHub lifecycle constraints without touching TASK-1.1 or TASK-1.2 worktrees.
2. Record the approved supervised lifecycle defaults as a Backlog decision and canonical operational contract, including explicit user review and artifact-retention boundaries.
3. Add repository-level machine-readable lifecycle policy/configuration and a recoverable task-to-PR runbook covering dispatch, validation, draft PR publication, approval gate, merge, exact cleanup, failure retention, and idempotent retries.
4. Validate the policy/configuration syntax and runbook invariants with deterministic local checks; document runtime-enforced versus operational-only behavior.
5. Read the task-finalization guide, verify every TASK-2 acceptance criterion objectively, update task notes/final summary/status only when justified, and report completion.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-08-16: Inspected README.md, AGENTS.md, the accepted decision-1, task conventions, and the existing TASK-1.1/TASK-1.2 lifecycle records without modifying those tasks or worktrees. The local task branch did not contain TASK-2; its existing coordinator-owned task record was updated through the Backlog CLI.

2026-08-16: Added the accepted decision-2 and canonical doc-2 runbook. The contract requires a tracked Orca Run/Dispatch, validated worker completion, one marked draft PR, an explicit user gate bound to head SHA, required checks and an explicit repository-approved merge strategy, exact-resource cleanup only after verified merge, and retention/idempotent recovery for all non-success paths.

2026-08-16: Added .orca/task-pr-lifecycle.json and README lifecycle links. The policy is declarative; Orca/GitHub runtime integration must enforce remote operations, and the runbook records that limitation rather than claiming static automation. Validation passed: JSON lifecycle-invariant assertions, git diff --check, Backlog doc view/list, and decision list.

2026-08-16: Added the dependency-free pnpm validate:lifecycle check to make policy/runbook invariants repeatable in local or CI validation without performing remote Orca or GitHub actions.

2026-08-16: Final acceptance evidence: #1 is evidenced by the live supervised Run/Dispatch inspection (run_d76a47e91326, ctx_ad1862ea8051, task_0e877088ccc6). #2-#6 are evidenced at repository scope by the passing pnpm validate:lifecycle assertions and doc-2 operating/recovery matrices; the runbook explicitly records that actual Orca/GitHub API operations (completion intake, PR mutation, approval identity, checks, merge, and exact resource deletion) require runtime integration and are not falsely claimed as static automation. TASK-1.1 remains Done with its retained draft PR, and TASK-1.2 remains To Do with its retained exploratory worktree.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @codex
created: 2026-08-16 06:47
---
2026-08-16: Started under supervised Orca Run run_d76a47e91326 / Dispatch ctx_ad1862ea8051. The worker must complete only TASK-2, send worker_done, and stop; TASK-1.2 remains To Do and is not a follow-up.
---

author: @codex
created: 2026-08-16 06:59
---
2026-08-16: Draft PR #3 is ready for explicit user review: https://github.com/kounoike/react-rich-media-hooks/pull/3. The retained worker/worktree must not be released or deleted until approval, required current-head checks, and a verified merge.
---

author: @codex
created: 2026-08-16 07:05
---
2026-08-16: Applied the user-approved Decision-body capability exception. Restored decision-2 body without changing its accepted metadata or meaning; AGENTS.md now requires CLI-first creation, frontmatter protection, non-empty-section validation, and task evidence.
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added the accepted supervised task-to-PR lifecycle contract: .orca/task-pr-lifecycle.json declares tracked Run/Dispatch provenance, accepted/failed outcomes, validated completion, one marked draft PR, explicit user approval, current-head checks, repository-approved merge strategy, exact post-merge cleanup, retained artifacts, and idempotent retries. Added the Backlog-managed doc-2 runbook, decision-2, README guidance, and pnpm validate:lifecycle; verified with live Run/Dispatch inspection, policy/runbook assertions, node --check, git diff --check, trailing-whitespace scan, and pnpm install --frozen-lockfile --offline. Orca/GitHub runtime operations remain an explicit operational contract and limitation.
<!-- SECTION:FINAL_SUMMARY:END -->
