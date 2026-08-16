# react-rich-media-hooks

A rich React library for building browser-based real-time media applications.

## Development

This project uses:

- Backlog.md for task management
- Backlog.md Decisions for architectural decisions
- pnpm for workspace management

See `AGENTS.md` before making changes.

## Supervised task lifecycle

Changes follow the repository's supervised task-to-PR lifecycle: a worker is
started through a tracked Orca Run/Dispatch, completion is validated and
published as one draft pull request, and the flow pauses for explicit user
approval before required checks, merge, and exact worker/worktree cleanup.

- Policy/configuration: `.orca/task-pr-lifecycle.json`
- Operational runbook: `backlog/docs/operations/task-to-pr-review-and-cleanup/doc-2 - Task-to-PR-review-and-cleanup-lifecycle.md`

The policy and runbook are declarative repository contracts. Orca and GitHub
runtime integrations must enforce the external operations; failures,
interruptions, rejected approvals, requested changes, and restarts retain the
pull request, branch, worktree, and logs for recovery.
