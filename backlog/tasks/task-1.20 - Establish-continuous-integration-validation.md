---
id: TASK-1.20
title: Establish continuous integration validation
status: Done
assignee:
  - '@codex'
created_date: '2026-08-13 21:15'
updated_date: '2026-09-02 14:48'
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

2026-09-02 resumed after the prior agent terminated abnormally. Initial evidence: branch kounoike/task-1-20-ci-validation and origin were both at d7a32ee; PR #23 was OPEN/DRAFT with old failures in Quality (Node 20.19.0, 22.12.0, 24.19.0) and Browser smoke (chromium, firefox). Worktree was clean. Scope remains CI setup and Node matrix/version alignment only.

2026-09-02 implementation: Added pinned pnpm/action-setup v6.0.9 before every setup-node cache use, verified pnpm 11.21.0, and recorded the action SHA in supply-chain/policy.json. Removed the EOL Node 20 quality row; the CI and browser workflows now use Node 22.23.2 and the runner-cached Node 24.19.0 on Ubuntu 24.04. Updated CI reproduction documentation while leaving the package engine compatibility range unchanged. Local evidence: frozen install, pnpm verify, supply-chain check, signature verification (224 packages), audit (no known vulnerabilities), YAML parse, workflow setup ordering assertions, git diff --check, and Chromium/Firefox smoke (2 passed).

2026-09-02 public CI run 33643591808 on head 0060426: pnpm/action-setup, Node 22.23.2/24.19.0 setup, exact pnpm verification, installs, and both Node Quality rows passed; supply-chain run 33643591830 also passed. Chromium and Firefox smoke reached test execution but both failed because BROWSER_PROJECT filtered playwright.config.ts to one project while test:browser:smoke passed both project selectors.

2026-09-02 follow-up: Changed PR smoke workflow execution to pnpm exec playwright test while retaining BROWSER_PROJECT filtering, so each matrix job runs only its selected project. Updated local reproduction documentation accordingly. Also upgraded pinned checkout/setup-node/upload-artifact actions to Node 24-compatible v7 releases and refreshed supply-chain policy SHAs, removing runner Node 20 action-runtime warnings. Local Chromium and Firefox single-project runs passed; YAML, setup-order, supply-chain, lifecycle, and diff checks passed.

2026-09-02 final validation: On PR #23 head c1b345e, CI validation run 33644245916 passed Browser smoke chromium, Browser smoke firefox, Quality Node 22.23.2, and Quality Node 24.19.0. Supply-chain controls run 33644245927 passed verify. gh pr checks 23 reports pass for all five current checks. The public jobs confirmed pnpm setup, Node setup, exact pnpm verification, and selected browser execution. The worktree and origin branch are clean and aligned at c1b345e.
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

author: @codex
created: 2026-09-02 14:42
---
Public CI confirmed the pnpm provisioning fix and both Node Quality rows. Diagnosed a separate CI smoke selector conflict; applying the minimal workflow-only fix to invoke Playwright with the matrix-selected project while retaining the existing BROWSER_PROJECT config filter.
---

author: @codex
created: 2026-09-02 14:45
---
The smoke selector fix and Node 24-compatible action pins are locally validated. Committing and pushing the follow-up; public CI must now pass both browser smoke jobs as well as both Node Quality jobs on the resulting head.
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fixed PR CI by provisioning pnpm 11.21.0 before setup-node cache resolution, using supported runner-aligned Node 22.23.2 and 24.19.0 LTS rows, and upgrading pinned actions to Node 24-compatible v7 releases. Corrected the matrix browser selector so each smoke job executes its selected project, and updated CI reproduction documentation and action provenance. Verified locally with frozen install, pnpm verify, supply-chain checks/signatures/audit, YAML and workflow assertions, git diff --check, and Chromium/Firefox smoke. Verified publicly on PR #23 head c1b345e: Node Quality 22.23.2 and 24.19.0, Chromium smoke, Firefox smoke, and supply-chain verify all passed.
<!-- SECTION:FINAL_SUMMARY:END -->
