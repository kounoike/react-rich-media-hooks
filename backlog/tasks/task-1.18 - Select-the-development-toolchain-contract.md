---
id: TASK-1.18
title: Select the development toolchain contract
status: Done
assignee:
  - '@codex'
created_date: '2026-08-13 21:15'
updated_date: '2026-08-30 22:37'
labels: []
dependencies:
  - TASK-1.6
  - TASK-1.8
references:
  - doc-8
  - decision-4
documentation:
  - doc-8
parent_task_id: TASK-1
priority: high
type: task
ordinal: 15000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Select a maintainable development toolchain that satisfies the approved compatibility, distribution, and verification contracts. Compare replaceable options before choosing versions or products, and keep the result focused on contributor-visible behavior and maintenance policy.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The TypeScript compiler version, configuration baseline, supported-version policy, and upgrade cadence are proposed with React and emitted-type compatibility evidence
- [x] #2 Linter and formatter candidates are compared for TypeScript and React coverage, rule quality, editor integration, performance, maintenance, migration cost, and separation of formatting from semantic checks
- [x] #3 Build, unit-test, browser-test, and package-validation responsibilities are assigned to tools without unnecessary overlap
- [x] #4 Required commands, configuration ownership, generated or cached files, and local versus CI responsibilities are specified
- [x] #5 Alternatives and tradeoffs are presented to the user, and significant toolchain choices are not accepted or implemented without explicit user approval and any required Backlog.md Decision
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Review TASK-1.6 and TASK-1.8 contracts plus accepted/proposed Decisions and repository scripts/configuration.
2. Inventory current toolchain conventions and verify candidate TypeScript, lint/format, build, test, browser-test, and package-validation evidence from authoritative documentation.
3. Compare replaceable alternatives, document compatibility, maintenance, ownership, commands, caches, generated files, and local/CI responsibilities as an approval-bound proposal.
4. Record the proposal and any new proposed Decision through Backlog CLI without accepting unresolved product, compatibility, dependency, distribution, or architecture choices.
5. Present the alternatives and approval questions through orchestration, then wait for explicit direction before dependent implementation; validate acceptance evidence and publish the scoped task record.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-08-31: Started TASK-1.18 as @codex after reading dependencies TASK-1.6 (Done, doc-6 verification strategy) and TASK-1.8 (Done, doc-7 compatibility/distribution proposal), then reviewed accepted decision-1/decision-2 and proposed decision-3. Current repository baseline is a private shell: package.json has only pnpm 11.21.0 plus lifecycle/backlog scripts, mise.toml says Node LTS/pnpm latest, pnpm-lock.yaml has an empty importer, and no source/toolchain configs exist. Recorded the implementation plan before research.
2026-08-31: Researched authoritative TypeScript, React, ESLint/typescript-eslint, Prettier, Biome, Vite, Vitest, Playwright, Node package exports, publint, and arethetypeswrong documentation. Candidate recommendation remains approval-bound: exact-pinned TypeScript 6.0.2 with TS 5.2+ consumer fixtures; ESLint 10 + typescript-eslint/React/React Hooks/JSX-a11y semantic lint and Prettier 3 formatting; Vite 8 library build with tsc declaration emit; Vitest 4 unit tests; Playwright Test browser matrix; publint + attw + pack/consumer fixtures for package validation. Alternatives, tradeoffs, compatibility evidence, maintenance policy, commands, ownership, caches, and CI/local split will be recorded in doc-8; no dependency or config implementation is authorized before explicit user approval.
2026-08-31: Verified Backlog CLI 1.50.1 with backlog --version, backlog decision --help, and backlog decision create --help. Decision create supports only title/status and generates a body skeleton, so if a proposed Decision is created, the documented narrow body-section exception is required; frontmatter will remain unchanged and accepted decisions will not be edited.

2026-08-31: Created doc-8, Development Toolchain Contract Proposal, through backlog doc create/update. It compares TypeScript 6.0.2 vs 5.9/7/floating, ESLint+Prettier vs Biome, Vite/Rollup/tsdown/tsc-only, Vitest/Jest/Node test runner, Playwright/Vitest Browser Mode/WebdriverIO/Cypress, and package validation alternatives. It specifies React 18.2/19 and TS 5.2/latest-5.x/6.0.2 emitted-type fixtures, strict config variants, commands, ownership, generated/cache boundaries, local/PR/nightly/release responsibilities, maintenance cadence, and explicit approval questions; all recommendations remain unaccepted.
2026-08-31: Created proposed decision-4 via backlog decision create and filled only the allowed body sections (Context, Decision Drivers, Considered Options, Decision, Consequences, Related Tasks) because CLI 1.50.1 supports title/status only; preserved decision-4 frontmatter exactly and left accepted decision-1/decision-2 unchanged.

2026-08-31 validation evidence: authoritative candidate command probes passed without modifying the repository: pnpm dlx --package typescript@6.0.2 tsc --version -> Version 6.0.2; pnpm dlx --package typescript@5.9.3 tsc --version -> Version 5.9.3; pnpm dlx --package eslint@10 eslint --version -> v10.9.1; pnpm dlx --package prettier@3 prettier --version -> 3.9.6; pnpm dlx --package vite@8 vite --version -> vite/8.2.2; pnpm dlx --package vitest@4 vitest --version -> vitest/4.1.11 on Node v24.19.0. These probes establish candidate availability only, not acceptance; emitted-type and consumer compatibility remain implementation-time gates in doc-8.

2026-08-31 finalization evidence: backlog doc view doc-8 confirmed ten proposal sections and no literal backslash-n; decision-4 frontmatter was compared byte-for-byte with the CLI-created metadata and all six required body sections were non-empty; accepted decision-1/decision-2 were unchanged. Candidate availability probes passed for TypeScript 6.0.2/5.9.3, ESLint 10, Prettier 3, Vite 8, and Vitest 4; pnpm run validate:lifecycle passed; pnpm run backlog:dispatchable returned only the ready leaf TASK-1.21; git diff --check passed. The approval ask msg_dec03cf106c7 and its required resume both timed out with no coordinator message; escalation msg_3190f24820bb was sent, and no implementation was performed pending explicit user approval.

2026-08-31: User-directed revision: make TypeScript 7.0.2 the primary compiler, replace ESLint/typescript-eslint with Oxlint plus oxlint-tsgolint, and replace direct Prettier usage with Oxfmt for native JavaScript/TypeScript/JSX/TSX/JSON/YAML/TOML/CSS formatting. Oxfmt's npm bundled Prettier fallback for Markdown/HTML is excluded from routine formatter globs. Proposal and Decision-4 were revised; implementation remains gated on the compatibility spike and unresolved toolchain choices.

2026-08-31 revised candidate probes: pnpm view resolved TypeScript 7.0.2, Oxlint 1.80.0, oxlint-tsgolint 7.0.2001, and Oxfmt 0.65.0; Oxlint and Oxfmt require Node 20.19+ or 22.12+. pnpm dlx probes passed for tsc Version 7.0.2, oxlint Version 1.80.0, and oxfmt Version 0.65.0. The tsgolint package resolved, but its direct CLI reports that direct invocation is unsupported; type-aware linting must be run through Oxlint as documented.

2026-08-31: User requested a concise document. Replaced the 433-line doc-8 body with a 110-line contract retaining the proposed baseline, compatibility fixtures, alternative tradeoffs, responsibility map, command/config ownership, generated/cache policy, CI cadence, maintenance policy, approval gate, and acceptance-evidence map. Verified required sections/tokens, no literal backslash-n, and git diff --check.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @codex
created: 2026-08-30 22:29
---
User directed the revised TypeScript 7 + Oxlint/tsgolint + Oxfmt direction and removal of the direct Prettier baseline. The proposal remains approval-bound for implementation until the compatibility spike and remaining choices are resolved.
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Condensed doc-8 to a 110-line approval-bound contract while retaining the TypeScript 7 + Oxlint/tsgolint + Oxfmt baseline, React/TypeScript compatibility fixtures, alternatives, tool responsibility boundaries, commands, configuration ownership, generated/cache rules, CI/maintenance policy, approval gates, and acceptance evidence. Verified document integrity and required contract sections plus git diff --check; no production dependencies or configuration were added.
<!-- SECTION:FINAL_SUMMARY:END -->
