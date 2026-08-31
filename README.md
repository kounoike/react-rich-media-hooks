# react-rich-media-hooks

A rich React library for building browser-based real-time media applications.

## Development

This project uses:

- Backlog.md for task management
- Backlog.md Decisions for architectural decisions
- Node.js 20.19+ (or 22.12+) and pnpm 11.21.0 for the pinned toolchain
- Oxfmt 0.65.0 and Oxlint 1.80.0 with oxlint-tsgolint 7.0.2001
- TypeScript 7.0.2, Vitest 4.1.11, and Vite 8.2.2

See `AGENTS.md` before making changes.

## Local quality workflow

Install the exact lockfile dependencies before running checks:

```sh
pnpm install:frozen
```

The direct package scripts are the canonical enforcement mechanism. No commit
hook is required or configured, so every check can be reproduced in a clean
checkout or CI job:

| Command | Purpose | Writes files? |
| --- | --- | --- |
| `pnpm format:check` | Check native JS, JSX, TS, TSX, JSON, TOML, and source configuration formatting with Oxfmt | No |
| `pnpm format:write` | Apply the Oxfmt formatting policy to those files | Yes, intended |
| `pnpm lint` | Run Oxlint correctness/suspicious diagnostics plus TypeScript-aware checks | No |
| `pnpm lint:fix` | Apply Oxlint-safe fixes for reviewed changes | Yes, intended |
| `pnpm typecheck` | Run the authoritative TypeScript 7 source check | No |
| `pnpm test:unit` (or `pnpm test`) | Run deterministic Vitest unit/contract tests | Test output only |
| `pnpm test:unit:coverage` | Run unit tests with V8 coverage output | Coverage output only |
| `pnpm build` | Emit Vite ESM/CJS files and TypeScript declarations under `dist/` | Build output only |
| `pnpm package:check` | Build, pack, inspect the tarball, run strict publint/ATTW, and test packed consumers | Build/artifact output only |
| `pnpm verify` | Run format check, lint, unit tests, package checks, and lifecycle validation | Generated output only |

Validation commands (`format:check`, `lint`, `typecheck`, `test:unit`, and
`verify`) do not pass write or autofix flags and must not modify tracked source
files. When a validation check fails, its tool reports the file and diagnostic;
use the write/fix commands only after reviewing the resulting diff.

Oxfmt intentionally scopes the local formatter to `src/`, `tests/`, and the
owned tool configuration files. Markdown/HTML, experiments, and supervised
task-lifecycle scripts retain their existing conventions and are checked by
their respective repository workflows. The formatter and editor policy are
kept in `.oxfmtrc.json` and `.editorconfig`; Oxlint's type-aware configuration
is in `.oxlintrc.json`.

Generated outputs and caches are ignored: `dist/`, `.artifacts/`, `coverage/`,
`test-results/`, `playwright-report/`, `.playwright/`, `.vitest/`, `.cache/`,
`.turbo/`, `.vite/`, `.oxlint-cache/`, `*.tsbuildinfo`, `node_modules/`, and
the pnpm store. Ignoring them does not replace the clean-install, package, or
test gates.

## Package foundation

The package is ESM-first and exposes a stable root entry, a framework-neutral
`./core` entry, and explicit optional `./effects/video` and `./effects/audio`
entries. The root and core modules are browser-inert at import time; media
permissions, processing resources, and optional runtime assets are not created
until a later implementation invokes an explicit session action. React is a
peer dependency of the root entry, while the core entry has no React runtime
dependency. `sideEffects: false` documents the no-import-work contract and
keeps optional effect modules tree-shakeable.

Build and inspect the package with the pinned toolchain:

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm build
pnpm package:check
```

`pnpm build` writes JavaScript to `dist/` using Vite 8 and declarations using
TypeScript 7. It emits matching ESM (`.js`) and CommonJS (`.cjs`) files for
each public entry. `pnpm package:check` verifies those files, resolves every
public entry in ESM and CommonJS through the export map, checks that the
package is publishable and side-effect-free, and creates one tarball under
`.artifacts/`. Inspect the final boundary with:

```sh
tar -tzf .artifacts/react-rich-media-hooks-0.1.0.tgz
```

Only `dist/`, this README, and the package license file are included by the
package `files` allowlist. Backlog records, experiments, tests, development
configuration, and local caches remain outside the artifact. The package is
licensed under MIT; the SPDX identifier is in `package.json` and the complete
notice is in `LICENSE`.

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
