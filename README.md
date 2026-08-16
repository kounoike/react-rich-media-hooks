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

Orca and GitHub integrations enforce the external Run/Dispatch, approval,
checks, merge, and exact cleanup operations. Failures, interruptions, rejected
approvals, requested changes, and restarts retain the pull request, branch,
worktree, and logs for recovery.
