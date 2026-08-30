---
id: TASK-1.18
title: Select the development toolchain contract
status: Done
assignee:
  - '@codex'
created_date: '2026-08-13 21:15'
updated_date: '2026-08-30 22:04'
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
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Created and linked doc-8 as the approval-bound development toolchain contract proposal and proposed decision-4, comparing TypeScript, lint/format, build, unit/browser test, and package-validation alternatives with compatibility, maintenance, ownership, command, cache, and CI/local evidence. Verified all five acceptance criteria plus document/Decision integrity, candidate availability probes, pnpm run validate:lifecycle, pnpm run backlog:dispatchable, and git diff --check; no implementation dependencies or configuration were added because explicit approval is still pending. The proposal and unaccepted Decision are ready for review in the scoped Draft PR.
<!-- SECTION:FINAL_SUMMARY:END -->
