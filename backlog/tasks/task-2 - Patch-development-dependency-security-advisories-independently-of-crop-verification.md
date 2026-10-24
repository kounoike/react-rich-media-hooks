---
id: TASK-2
title: >-
  Patch development dependency security advisories independently of crop
  verification
status: In Progress
assignee:
  - '@codex'
created_date: '2026-10-24 06:06'
updated_date: '2026-10-24 06:11'
labels: []
dependencies: []
references:
  - 'https://github.com/advisories/GHSA-587h-7wmj-h5pm'
  - 'https://github.com/kounoike/react-rich-media-hooks/pull/28'
documentation:
  - docs/supply-chain-maintenance.md
priority: high
type: chore
ordinal: 26000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Restore the main branch supply-chain gate with a focused dependency-only PR, merged before TASK-1.25 PR #28 as explicitly requested by the user on 2026-10-24. Update Vite 8.2.2 to patched 8.2.4 and the Vitest/coverage pair from 4.1.11 to patched 4.1.12; extract the existing development-only tinypool/source-map-js fixes from PR #28 without crop implementation or measurement changes. Preserve approved toolchain families, public API, React peers, compatibility and distribution contracts.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Main-based manifest, pnpm-generated lockfile and dependency inventory consistently resolve patched Vite and the affected transitive packages without unrelated product changes.
- [x] #2 Frozen installation, vulnerability gates, registry signatures, license/provenance policy, quality/package verification and Chromium/Firefox browser checks pass for the updated dependency graph.
- [ ] #3 A separate PR targeting main contains only dependency fixes, associated inventory/documentation and this task record, with the user-requested merge ordering documented.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Verify advisories and accepted supply-chain/toolchain policies; isolate dependency changes from PR #28. 2. Apply Vite 8.2.4, paired Vitest/coverage 4.1.12 and existing tinypool/source-map-js patches on origin/main; synchronize dependency inventory and regenerate the lockfile with pnpm 11.21.0. 3. Run frozen installation, audits, signatures, license/provenance, aggregate quality/package, coverage and Chromium/Firefox browser verification against the final graph. 4. Publish a focused Draft PR, finalize the task with objective evidence, review the exact diff and current-head CI, then use the user-authorized squash merge before PR #28.

5. Update the separately locked capture example to the same patched Vite version and preserve standalone installation with a local root-only pnpm-workspace.yaml; verify its frozen install, audit and build.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
User explicitly authorized a separate dependency update PR and merging it before PR #28 on 2026-10-24. Decision-5 adopts Vite 8 as the bundler family; this bounded patch retains that accepted contract and needs no new architectural Decision. Main has no existing open remediation task (TASK-1.22 is completed policy setup). Reviewed the primary GHSA-587h-7wmj-h5pm advisory: Vite 8.2.0 through 8.2.3 are affected and 8.2.4 is patched. Extract the existing PR #28 tinypool 2.1.2 and source-map-js 1.2.2 overrides so main also resolves GHSA-5gmw-xhrv-c9v3, GHSA-85c8-ppgw-ccpr and GHSA-68fv-2mgg-jv7q. The formatter pins vulnerable tinypool exactly, so retain the scoped override in pnpm 11 configuration; no audit exception or direct formatter update. PR #28 product changes and historical accepted Decisions remain untouched. This is direct user-owned work in a separate Orca worktree, not a new dispatched worker or scheduler run.

The first audit after the high/critical fixes found two moderate development advisories affecting @vitest/mocker 4.1.11: GHSA-qxg6-89mg-rqv8 and GHSA-xp26-3454-mjgp. Primary advisories and registry metadata identify 4.1.12 as the patched backport; vitest and @vitest/coverage-v8 require matching patch versions. Include that bounded paired security update within this dependency remediation scope instead of retaining known patchable advisories. No release-family, peer or architectural choice changes.

The separately locked capture example also pins Vite 8.2.2. Update that pin and its pnpm-generated lockfile to 8.2.4. Adding root pnpm 11 override configuration otherwise causes pnpm --dir examples/capture install to select the parent root and silently ignore the example lock; a local example pnpm-workspace.yaml keeps the documented standalone commands and lockfile boundary intact. The first local browser command reused the pre-existing TASK-1.25 server on port 4173, so it is not accepted as validation of this dependency graph. Re-run all four base browser cases through a temporary ignored Playwright config with a dedicated own-worktree Vite 8.2.4 server on port 4197 and reuseExistingServer false; no shared server or product/browser-test configuration is modified.

Final root graph validation passed: pnpm install --frozen-lockfile --ignore-scripts; pnpm verify (format/lint, 14 unit tests, typecheck, Vite 8.2.4 build, React 18.2/19.1.1 packed ESM/SSR/CJS/TypeScript consumers, lifecycle policy); pnpm test:unit:coverage (14 tests); supply-chain:check (13 direct dependencies, 224 integrity-pinned resolutions, unchanged three license exceptions, zero distributed assets); supply-chain:signatures (224 verified); supply-chain:audit (no known vulnerabilities in production or development). The dedicated own-worktree browser server on port 4197 passed all four Chromium/Firefox capture/crop tests in 50.1s. Example frozen installation and audit passed with Vite 8.2.4 and no known vulnerabilities. Manifest contract comparison confirms only Vite/Vitest/coverage direct development patch versions changed; exports, React peers, engines, scripts, distributed file list and runtime dependencies match origin/main. No product source/tests, CI/workflow, Decision, API, compatibility or distribution-contract changes are included. Agent improvement PR: none.

The standalone capture example production build also passed with its own Vite 8.2.4 and frozen lockfile; the script rebuilt the library and typechecked the React consumer before bundling. All local acceptance verification is complete. The separately published PR and current-head CI are the remaining review/integration steps.
<!-- SECTION:NOTES:END -->
