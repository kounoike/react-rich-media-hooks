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
parent tasks and reports the single task that should be selected next.

Worktree creation is single-flight. Poll the exact `orca-ide worktree create`
session until its final JSON result; do not retry after an empty response,
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
