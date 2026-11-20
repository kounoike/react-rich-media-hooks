---
id: TASK-3
title: Introduce mise-managed hk quality gates
status: Done
assignee:
  - '@codex'
created_date: '2026-11-20 12:55'
updated_date: '2026-11-20 13:04'
labels: []
dependencies: []
priority: high
type: chore
ordinal: 27000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a deterministic shared hk gate for pre-commit and pull request/main CI using mise-pinned tools, preserve existing verification and release behavior, inventory and validate checked-in configuration, and prepare Zig formatting/static checks without modifying TASK-1.12. Standalone user-dispatched work from origin/main 8616866 in mise-hk-quality-gates; no dependency on TASK-1.12.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 mise pins hk and all added gate tools; local pre-commit invokes the shared gate without bypassing existing verify checks
- [x] #2 Pull requests and main pushes run the same gate while existing Node matrix, coverage, package, browser, supply-chain and release behavior remain intact
- [x] #3 Configuration formatting/schema inventory and standard TS/TSX checks follow Decision 5 and existing tools
- [x] #4 Zig checks pass with no Zig files and automatically check future tracked Zig sources without changing TASK-1.12
- [x] #5 Local setup/hook documentation and positive, negative, no-change, workflow syntax, verify/package/lifecycle evidence are recorded
- [x] #6 Clean committed and pushed branch has exactly one validated Draft PR for manual review
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Keep Decision-5 Oxfmt/Oxlint and existing verify/CI owners; add mise-pinned hk orchestration without a product/API decision.
2. Inventory tracked configuration; extend native formatting and add deterministic schema validation using local schemas and narrowly scoped tooling.
3. Add check-only pre-commit and shared CI gate, with conditional Zig fmt/ast-check.
4. Run positive/negative/no-change and existing verify/package/lifecycle checks, document evidence, commit/push and publish one manual-review Draft PR.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Baseline: clean dedicated mise-hk-quality-gates worktree HEAD equals origin/main 8616866; TASK-1.12 has no dependency relationship. Searched Decisions: Decision-5 already accepts native Oxfmt 0.65.0, Oxlint 1.80.0 and independent pnpm verify owners, so no new architecture Decision is needed for the requested reversible gate wiring.
Tool tradeoffs: reuse Oxfmt/Oxlint and Zig compiler fmt/ast-check rather than adding a formatter/linter; add exact development-only Ajv 8.20.0 and yaml 2.9.1 because no existing repository JSON Schema evaluator or YAML parser is directly available. Ajv checks installed Oxc schemas plus explicit repository configuration contracts offline; YAML parsing catches malformed files and duplicate keys. actionlint 1.7.12 checks workflow syntax/expressions offline with shellcheck disabled to avoid environment-dependent results; mise warns that its registry alias is deprecated in favor of jactionlint, but upstream actionlint remains pinned to the verified upstream release.

Implemented mise pins hk 2.13.0/Pkl 0.31.1/Zig 0.15.2/actionlint 1.7.12; hk check/pre-commit share configuration, conditional Zig and complete existing verify steps, with no globs/cache/fixes/staging/stashing. Added explicit hook installation and local/CI docs. Existing quality job now runs the shared gate plus unchanged coverage; browser, supply-chain and release jobs are unchanged. CI exposes mise bin-paths for only gate tools to preserve setup-node matrix ownership. Formatting changes in .orca/task-pr-lifecycle.json are JSON-value identical; no workflow policy changes.
Validation (2026-11-20): frozen install --ignore-scripts passed; full quality:gate passed on Node 22.23.2 and 24.19.0, including 4 unit-test files / 21 tests, type-aware Oxlint, TypeScript, build, React 18.2/19 packed ESM/SSR/CJS/TS consumers, package integrity and validate:lifecycle. config:check passed: 37 JSON/YAML files, pinned Oxc schemas via Ajv, tsc --showConfig for root/example configs, hk validate --deny-warnings, actionlint workflow syntax/expressions, supply-chain (15 direct dependencies, 230 integrity-pinned resolutions, 3 license exceptions, no assets). Coverage passed (21 tests). Whole-tree SHA-256 snapshots before/after Node24 gate were identical.
Negative probes (all restored): compacted package.json failed Oxfmt; string printWidth failed Oxfmt JSON Schema; a nonignored Zig file with a space in its name passed fmt/AST, then unused local variable failed ast-check. No Zig files produces an explicit successful no-op. Isolated /tmp/hk-precommit-evidence-pv1u3tbg with its own frozen install ran pnpm hooks:install then an actual git commit: full hook passed and index tree/worktree stayed unchanged; source/shared repository hooks were not installed or modified. An initial symlinked-node_modules test setup was rejected by pnpm and replaced with an independent install.
Contract evidence: all package fields except scripts/devDependencies are byte-value equivalent to origin/main; no src/tests, accepted Decisions, TASK-1.12 record/worktree/implementation changes. Ajv/YAML are development-only, with inventory/license entries and lockfile integrities; YAML also resolves Vite existing optional peer without changing its pinned version. New mise action SHA and version are recorded in supply-chain policy. Manual review is required: CI/dependency/protected configuration paths and more than 10 files/300 lines; no automatic-lane eligibility claimed.
Limitations: offline schema coverage is explicit repository contracts plus Oxc schemas and existing semantic validators, not complete upstream schemas for every format; historical measurements and generated lockfiles receive syntax checks, Backlog config remains CLI-owned, Markdown/HTML remain outside native formatting per Decision-5. Zig AST checks do not replace future target-dependent compilation/tests; TASK-1.12 must reconcile the compiler pin if needed. Initial tool/Pkl installation needs network; existing supply-chain exception expiry remains date-sensitive. Agent improvement PR: none; no independent workflow improvement was introduced.
Remaining criterion #6: commit/push the branch and create/validate exactly one Draft PR, then record its URL/head and completion.

Publication evidence: exactly one Draft PR #31 targets main: https://github.com/kounoike/react-rich-media-hooks/pull/31; PR head 666caa08dab565a5c5ff95403548ba6bac82daec matched local HEAD and git ls-remote origin/mise-hk-quality-gates, clean worktree, and published body contains real newline bytes with no literal backslash-n. All six acceptance criteria are proven; final task-record-only completion commit follows this note. GitHub Actions started both quality Node rows, both browser smoke rows and supply-chain verify; remote results were pending at this validation point, so manual review/merge remains with the user. No Run ID was supplied by the context Dispatch; exact Orca task task_aaf7d7bbb5c7 and Dispatch ctx_8eb0f9ac32f1 are included in the PR.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Introduced pinned mise/hk shared local, pre-commit and PR/main CI quality gates while preserving Decision-5 and full verify/package/lifecycle behavior. Validated 37 JSON/YAML configurations, native formatting, both Node 22/24 gates, 21 tests and coverage, deliberate schema/format/Zig failures, unchanged file hashes and an actual isolated pre-commit commit. Published exactly one validated manual-review Draft PR #31, https://github.com/kounoike/react-rich-media-hooks/pull/31; TASK-1.12 and public/runtime/distribution contracts are unchanged. Agent improvement PR: none.
<!-- SECTION:FINAL_SUMMARY:END -->
