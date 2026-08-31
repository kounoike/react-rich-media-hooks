---
id: TASK-1.19
title: Establish local developer quality checks
status: Done
assignee:
  - '@codex'
created_date: '2026-08-13 21:15'
updated_date: '2026-08-31 00:41'
labels: []
dependencies:
  - TASK-1.18
  - TASK-1.9
parent_task_id: TASK-1
priority: high
type: chore
ordinal: 18000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Provide a fast, documented local workflow that applies the approved formatting, linting, type, test, build, and package checks consistently before changes reach CI.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Documented commands cover formatting in check and write modes, semantic linting, type checking, unit tests, package builds, and package-integrity checks
- [x] #2 Commands produce actionable failures, use consistent configuration, and do not modify source files when running in validation mode
- [x] #3 Editor configuration and ignore rules align with command-line behavior, generated outputs, caches, and repository conventions
- [x] #4 Optional commit hooks do not become the sole enforcement mechanism and can be reproduced by direct package commands
- [x] #5 A clean checkout can execute the documented workflow with the declared runtime and package-manager versions
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Review accepted Decision-5 and the completed package foundation from TASK-1.9, then inventory existing scripts, configs, editor settings, ignore rules, and documentation.
2. Add the approved local formatting, semantic lint, type, unit-test, build, and package-integrity commands with actionable validation-mode behavior and documented runtime/package-manager versions.
3. Align editor and ignore configuration with the command scopes and generated/cache boundaries; keep hooks optional and reproducible through direct commands.
4. Run the documented workflow from a clean dependency state, record objective evidence for every acceptance criterion, update the task, and publish the scoped Draft PR.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-08-31: User explicitly authorized a one-time automatic-merge exception for the five named setup tasks, including TASK-1.19. This authorization applies only to the approved local quality-check workflow; no unrelated product, public API, compatibility, distribution, CI, release, or toolchain decision was added.

2026-08-31 implementation: Added exact Oxfmt 0.65.0 formatting scripts/config, Oxlint 1.80.0 with oxlint-tsgolint 7.0.2001 type-aware configuration, TypeScript 7 typecheck coverage for tests, Vitest 4.1.11 unit/coverage scripts and SSR-safe core tests, editor/ignore boundaries, and README workflow documentation. Corrected two existing unsafe effect-option assertions so the approved semantic lint gate passes without disabling rules. Existing lifecycle scripts and experiments remain outside the local source/test formatter/linter scope and continue under their dedicated validator.

2026-08-31 checks: pnpm install --frozen-lockfile, pnpm format:check, root Oxfmt check, pnpm lint, root Oxlint check, pnpm typecheck, pnpm test:unit, pnpm test:unit:coverage, pnpm run package:check, pnpm run verify, and git diff --check passed.

2026-08-31 finalization evidence: Fresh `pnpm run verify` passed format:check (15 files), Oxlint, Vitest (1 file/3 tests), TypeScript typecheck, Vite 8 plus declaration build, strict publint/ATTW and packed React 18.2/19 ESM/SSR/CJS/TypeScript package consumers, and validate:lifecycle. `pnpm run install:frozen` passed on Node v24.19.0/pnpm 11.21.0; `pnpm run format:write` completed without adding tracked changes; `git diff --check` passed. Acceptance criteria 1-5 are objectively satisfied by the documented scripts/configuration, direct-command hook policy, clean install, and verification outputs.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Established the approved local quality workflow with pinned Oxfmt/Oxlint/tsgolint/TypeScript/Vitest tooling, direct format/lint/type/unit/package/aggregate scripts, SSR-safe unit coverage, editor and ignore policies, and runtime documentation. All five acceptance criteria are checked; clean frozen install and fresh pnpm run verify passed on Node v24.19.0/pnpm 11.21.0, including strict package consumers and lifecycle validation; no commit hook, CI, public API, Decision, or unrelated toolchain change was added.
<!-- SECTION:FINAL_SUMMARY:END -->
