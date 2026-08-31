---
id: TASK-1.22
title: Establish dependency and supply-chain maintenance
status: Done
assignee:
  - '@kounoike'
created_date: '2026-08-13 21:15'
updated_date: '2026-08-31 00:51'
labels: []
dependencies:
  - TASK-1.18
  - TASK-1.9
parent_task_id: TASK-1
priority: medium
type: chore
ordinal: 19000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Establish repeatable controls for dependency updates, third-party build inputs, license awareness, vulnerability response, and publish provenance without assuming a particular automation service before approval.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 An approved policy defines dependency-update cadence, grouping, lockfile handling, compatibility evidence, review requirements, and bounded automation behavior
- [x] #2 Runtime, development, model, WebAssembly, and other distributed asset dependencies have documented provenance, licenses, versions, and update ownership where applicable
- [x] #3 Automated vulnerability and license checks have defined severity handling, exception recording, and false-positive review procedures
- [x] #4 CI actions and other third-party build inputs are pinned and updated according to the approved integrity policy
- [x] #5 Package publication provenance, credentials, least privilege, and secret-rotation responsibilities are documented and verifiable
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Define the repository supply-chain policy and machine-readable exception/asset manifests: update cadence, grouping, frozen lockfile and integrity requirements, compatibility/review evidence, vulnerability/license severity handling, provenance inventory, third-party input pinning, and publication credential/provenance responsibilities.
2. Add the direct dependency and distributed-asset inventory with current versions, licenses, registry/source provenance, ownership, and explicit no-runtime/model/WASM asset state.
3. Add a dependency/license validation script and package command that verifies the policy, current installed license metadata, expiring exceptions, package-manager/lockfile integrity expectations, and registry signature evidence.
4. Add a read-only scheduled/pull-request supply-chain workflow using a full commit-pinned checkout action, frozen install with scripts disabled, vulnerability/license/signature checks, least-privilege permissions, and bounded runtime.
5. Run objective policy, supply-chain, package, lifecycle, and formatting checks; update all TASK-1.22 acceptance criteria and final notes through Backlog CLI, commit the scoped changes, push the branch, and open a newline-correct Draft PR.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Started 2026-08-31: reviewed accepted Decision-5 toolchain and Decision-6 release contracts; package currently has no CI workflows, runtime assets, or dependency-maintenance controls. Assignment is @kounoike. User-authorized one-time automatic-merge exception applies to this named setup task and the other four named setup tasks; coordinator may use it only with the lifecycle policy and current-head checks.

Implemented approved controls: docs/supply-chain-maintenance.md; supply-chain policy, direct dependency provenance inventory, empty distributed-asset manifest, and time-bounded license/vulnerability exception register; scripts/check-supply-chain.mjs; package supply-chain check/audit/signature commands; and .github/workflows/supply-chain.yml with read-only permissions, frozen --ignore-scripts install, weekly/PR/push scans, and full-SHA checkout pin. Validation so far: policy JSON parse, workflow YAML parse, supply-chain:check (7 direct dependencies, 128 integrity-pinned resolutions), supply-chain:audit (production moderate and development high: no known vulnerabilities), supply-chain:signatures (128 verified), package:check (typecheck/build/package validation), validate:lifecycle, node --check, and git diff --check all pass. Note: only direct package metadata is committed; transitive versions/integrity remain in pnpm-lock.yaml and transitive license metadata is checked from pnpm licenses at validation time.

Final objective verification 2026-08-31: jq validation passed for all machine-readable policy files; Python YAML parse and least-privilege assertions passed; pnpm install --frozen-lockfile --ignore-scripts passed; pnpm run supply-chain:check passed (7 direct dependencies, 128 integrity-pinned resolutions, 3 reviewed license exceptions, 0 distributed assets); pnpm run supply-chain:audit passed with no known production moderate or development high vulnerabilities; pnpm run supply-chain:signatures passed with 128 verified signatures; node --check, pnpm package:check, pnpm run validate:lifecycle, git diff --check, and staged diff check passed. Acceptance criteria #1-#5 are objectively satisfied.

Authorization clarification: the user explicitly authorized a one-time automatic-merge exception for five named setup tasks, including TASK-1.22; this authorization does not broaden the scoped change or waive current-head checks.

Follow-up rebase 2026-08-31: fetched origin/main at c5c45743d95390d59e8f2f69a584c5c30adf0abc and rebased commit 470ea9a, resolving the expected package.json overlap by retaining TASK-1.19 format/lint/test scripts and adding TASK-1.22 supply-chain scripts; README.md had no conflict and was preserved from origin/main. TASK-1.19 added five direct toolchain/test dependencies, so the TASK-1.22 inventory and policy were extended to 12 direct dependencies before final validation.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Established the approved service-neutral dependency and supply-chain maintenance controls: cadence/grouping and frozen-lockfile policy, direct dependency and empty distributed-asset provenance inventories, expiring license/vulnerability exception records, full-SHA third-party action pinning, read-only scheduled/PR/push checks, and protected OIDC publication credential responsibilities. Preserved TASK-1.19 quality tooling during rebase and extended the inventory to 12 direct dependencies; verified 220 integrity-pinned resolutions, 128 registry signatures, no known audited vulnerabilities, package validation, lifecycle policy, JSON/YAML syntax, and diff cleanliness.
<!-- SECTION:FINAL_SUMMARY:END -->
