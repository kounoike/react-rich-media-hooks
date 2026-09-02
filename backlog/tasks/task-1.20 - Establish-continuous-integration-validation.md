---
id: TASK-1.20
title: Establish continuous integration validation
status: In Progress
assignee:
  - '@codex'
created_date: '2026-08-13 21:15'
updated_date: '2026-09-02 14:40'
labels: []
dependencies:
  - TASK-1.6
  - TASK-1.19
  - TASK-1.22
parent_task_id: TASK-1
priority: high
type: chore
ordinal: 20000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Automate the approved verification gates for pull requests and protected branches with secure, observable, and maintainable CI workflows.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Pull-request and protected-branch workflows run every required formatting, lint, type, test, build, package-integrity, and selected browser check
- [x] #2 The Node, operating-system, and browser matrix matches the approved support strategy, with explicit periodic or manual coverage for combinations not run on every change
- [x] #3 Caching, concurrency cancellation, timeouts, retries, and artifact retention are configured without hiding deterministic failures or creating unbounded resource use
- [x] #4 Workflow permissions and secret access follow least privilege, and third-party actions follow the approved supply-chain policy
- [x] #5 Failures expose sufficient logs or artifacts for diagnosis, and contributor documentation explains how to reproduce each gate locally
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Inventory the approved browser strategy, local quality commands, supply-chain policy, package scripts, and repository workflow conventions.
2. Add pull-request/protected-branch CI validation with the approved formatting, lint, type, unit, build, package-integrity, and selected browser gates; use the supported Node/OS/browser matrix and explicit scheduled/manual coverage for deferred combinations.
3. Configure bounded dependency caching, concurrency cancellation, per-job timeouts, narrowly scoped retries, diagnostic logs/artifacts with retention, least-privilege permissions, and full-commit-pinned third-party actions consistent with the supply-chain policy.
4. Document local reproduction for every CI gate and validate workflow syntax, scripts, policy assertions, lifecycle rules, and repository checks.
5. Verify every acceptance criterion objectively, record evidence and the authorized one-time automatic-merge exception in TASK-1.20, commit/push the scoped changes, and publish a newline-correct Draft PR.

6. Reproduce the published CI failures, explicitly provision pnpm in each affected workflow job, update the Node.js version strategy for the 2026-09-02 supported runner environment, run local gates, rerun PR #23 CI, and verify every Node Quality plus Chromium/Firefox smoke check before commit/push.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-08-31: User explicitly authorized a one-time automatic-merge exception for the five named setup tasks, including TASK-1.20. This authorization is limited to the approved CI validation scope, does not waive current-head checks, and does not permit unrelated product, public API, compatibility, distribution, dependency, release, security, or workflow-policy decisions.

2026-08-31 implementation: Added Playwright 1.62.1 browser integration ownership, secure-loopback fixture, Chromium/Firefox smoke script, all-desktop browser project configuration, PR/protected-main CI workflow, weekly/manual native-OS browser matrix, deterministic Node quality matrix, frozen ignore-scripts installs, pnpm caching, concurrency cancellation, explicit job/test timeouts, one bounded CI retry, least-privilege permissions, full-SHA checkout/setup-node/upload-artifact pins, and retained diagnostic artifacts. Documented local reproduction and the WebKit/native Safari/mobile/manual evidence boundary in README.md and docs/ci-validation.md; recorded Playwright and action provenance in the existing supply-chain inventory/policy.

2026-08-31 validation so far: pnpm install --frozen-lockfile, pnpm format:check, pnpm lint, pnpm typecheck, pnpm verify, pnpm run supply-chain:check, pnpm run supply-chain:audit, pnpm run supply-chain:signatures, pnpm run validate:lifecycle, git diff --check, YAML parsing, and CI=1 pnpm test:browser:smoke all pass. Browser smoke passed Chromium and Firefox (2 tests); supply-chain checks report 13 direct dependencies, 224 integrity-pinned resolutions, no known vulnerabilities, and 224 verified registry signatures.

2026-08-31 finalization evidence: CI=1 pnpm test:browser:smoke passed Chromium and Firefox (2 tests). pnpm verify passed Oxfmt (17 files), Oxlint, Vitest (1 file/3 tests), TypeScript typecheck including playwright.config.ts, Vite build, package integrity/packed React 18.2 and 19 consumers, and lifecycle validation. pnpm install --frozen-lockfile --ignore-scripts passed; supply-chain:check passed with 13 direct dependencies and 224 integrity-pinned resolutions; supply-chain:audit reported no known production moderate or development high vulnerabilities; supply-chain:signatures verified 224 packages; git diff --check passed; Python YAML parsing and custom workflow assertions passed for all workflows (read-only permissions, cancellation, timeout, retention, and 3 pinned actions).

2026-09-02 resumed after the prior agent terminated abnormally. Initial evidence: branch kounoike/task-1-20-ci-validation and origin are both at d7a32ee; PR #23 is OPEN/DRAFT with old failures in Quality (Node 20.19.0, 22.12.0, 24.19.0) and Browser smoke (chromium, firefox). Worktree is clean. Scope remains CI setup and Node matrix/version alignment only.

2026-09-02 implementation: Added pinned pnpm/action-setup v6.0.9 before every setup-node cache use, verified pnpm 11.21.0, and recorded the action SHA in supply-chain/policy.json. Removed the EOL Node 20 quality row; the CI and browser workflows now use Node 22.23.2 and the runner-cached Node 24.19.0 on Ubuntu 24.04. Updated CI reproduction documentation while leaving the package engine compatibility range unchanged. Local evidence: frozen install, pnpm verify, supply-chain check, signature verification (224 packages), audit (no known vulnerabilities), YAML parse, workflow setup ordering assertions, git diff --check, and Chromium/Firefox smoke (2 passed).
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @codex
created: 2026-09-02 14:33
---
Resumed TASK-1.20 in the existing worktree and branch after abnormal agent termination; PR #23 remains the scoped Draft PR. Investigating pnpm provisioning and current Node runner support before implementation.
---

author: @codex
created: 2026-09-02 14:40
---
Implementation and local validation passed. Ready to commit/push so PR #23 can run the updated public CI; pending verification of both Node Quality rows and Chromium/Firefox smoke rows on the new head.
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Established CI validation with frozen Node/pnpm quality matrices, PR/protected-main deterministic gates, Chromium/Firefox secure-loopback smoke, weekly/manual Edge and WebKit native-OS coverage, bounded retries/timeouts/concurrency, pnpm caching, retained diagnostics, least-privilege permissions, and full-SHA action policy records. Added Playwright browser scripts/configuration and contributor reproduction documentation while keeping native Safari, mobile, device, accessibility, and performance claims in their documented manual/release boundaries. Verified with pnpm verify, CI=1 pnpm test:browser:smoke, frozen script-disabled install, supply-chain checks/audits/signatures, YAML/workflow assertions, and git diff --check.
<!-- SECTION:FINAL_SUMMARY:END -->
