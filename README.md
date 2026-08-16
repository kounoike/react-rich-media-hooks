# react-rich-media-hooks

A rich React library for building browser-based real-time media applications.

## Development

This project uses:

- Backlog.md for task management
- Backlog.md Decisions for architectural decisions
- pnpm for workspace management

See `AGENTS.md` before making changes.

## Supervised task lifecycle

The task-to-PR workflow is repository operating policy rather than a Backlog
task or Decision. See the workflow rules in `AGENTS.md` and the machine-readable
policy in `.orca/task-pr-lifecycle.json`. A worker-owned task record is updated
in its task worktree before the Draft PR; the coordinator's `main` worktree does
not receive task-completion bookkeeping.

Before dispatching work, run `pnpm run backlog:dispatchable`. It filters ready
parent tasks and reports up to three `selectedTasks` in priority and ordinal
order for the next bounded parallel batch.

The repository's Orca scheduled coordinator runs every five minutes in the
main workspace. It starts `pnpm run orchestration:coordinator -- --loop`; the
first process holds a single-flight lock and polls settled `worker_done`
results every five minutes. The loop creates and validates the Draft PR,
uses the guarded automatic lane when eligible, squash-merges and cleans up the
exact worker resources, fast-forwards a clean `main`, and starts the next ready
leaf task batch through `orca orchestration worker-start`. A failed, uncertain,
manual-review, or dirty-branch state is retained instead of being skipped.

Worktree creation is single-flight per task. Create and poll each requested
worktree to its final JSON result before creating the next one; after setup,
worker sessions may run concurrently. Do not retry after an empty response,
timeout, or `runtime_unavailable` until both Orca and Git worktree lists confirm
that the requested target does not already exist.

Small research, maintenance, and implementation changes can use the automatic
completion lane when they do not change Decisions, public API, compatibility,
distribution, or protected workflow/dependency/CI/release paths, or require a
user decision, and remain within the configured diff limits.
Feature, API, compatibility, distribution, and uncertain changes remain behind
the explicit review gate.

Orca and GitHub integrations enforce the external Run/Dispatch, approval,
checks, merge, and exact cleanup operations. Failures, interruptions, rejected
approvals, requested changes, and restarts retain the pull request, branch,
worktree, and logs for recovery.
