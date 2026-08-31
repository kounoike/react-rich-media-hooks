---
id: TASK-1.9
title: Bootstrap an installable and verifiable library package
status: Done
assignee:
  - '@codex'
created_date: '2026-08-13 20:31'
updated_date: '2026-08-31 00:09'
labels: []
dependencies:
  - TASK-1.6
  - TASK-1.8
  - TASK-1.18
parent_task_id: TASK-1
priority: high
type: chore
ordinal: 17000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create the minimum production package foundation needed to build and pack the approved library contract using the approved development toolchain. Local quality automation, CI, dependency maintenance, and release automation are delivered by separate dependent tasks.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A clean checkout can install dependencies and run the documented package build using the declared toolchain
- [x] #2 The package builds the approved runtime and type entry points with the documented module, side-effect, and auxiliary-asset behavior
- [x] #3 Package metadata, peer and runtime dependencies, license information, export maps, and published-file boundaries match the approved distribution contract
- [x] #4 A packed artifact can be installed into a representative consumer and imported in every supported execution context
- [x] #5 Contributor documentation explains the package layout, build workflow, and artifact inspection procedure
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Implement the user-authorized package foundation against accepted Decision-5 and the approved distribution requirements: package metadata, explicit ESM/CJS/type entry points, side-effect boundaries, and allowlisted publication files.
2. Add the smallest SSR-safe core and React-facing runtime/type entry points needed for a verifiable installable package, keeping optional video/audio entry points browser-inert and free of runtime assets.
3. Configure the accepted TypeScript 7/Vite 8 declaration and library build, lock dependencies, and document package layout, build, packing, tarball inspection, and representative consumer verification.
4. Verify clean install, build, packed artifact exports/imports in ESM/CJS/SSR/type consumers, package boundaries, and repository lifecycle/diff checks before finalizing the task.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-08-31: Started TASK-1.9 as @codex after reading dependencies TASK-1.6, TASK-1.8, and TASK-1.18 plus accepted Decisions 1, 2, 5, and 6. The user task brief explicitly authorizes this initial setup to implement and automatically merge the approved package/distribution contract despite protected-path review policy; implementation will follow the leading package recommendation in doc-7 and accepted toolchain Decision-5 without changing Decision-3 status or adding unresolved product choices.

2026-08-31: Implemented the package foundation: public package metadata and conditional exports for root/core/video/audio, React peer range, Node/pnpm engines, sideEffects false, files allowlist, TypeScript 7 declaration config, Vite 8 ESM/CJS library build, SSR-safe core/React/effect entry modules, and package verification scripts. No media capture, worker, worklet, WASM, model, or import-time browser work was added; effect modules are semantic inert factories for later vertical slices.
2026-08-31: Added package:check verification for emitted JS/declarations, source-map and tarball allowlist boundaries, local ESM/CJS self-imports, packed-tarball installation into a temporary consumer, TypeScript 7 NodeNext declaration resolution, and packed ESM/SSR/CJS imports. `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm build`, and `pnpm package:check` pass. License remains explicitly UNLICENSED with a matching LICENSE notice because no project license is specified by accepted Decisions; coordinator escalation msg_3d70910e1297 requests direction before a public license is encoded.

2026-08-31: Added exact package validators publint 0.3.24 and @arethetypeswrong/cli 0.18.5. Conditional ESM/CJS type exports now use .d.ts/.d.cts pairs and a typesVersions fallback; publint strict and ATTW strict report all public entries valid across node10, Node16 CJS/ESM, and bundler resolution.

2026-08-31 finalization: Verified every acceptance criterion objectively. AC1: `pnpm run install:frozen` and documented `pnpm build` pass from the clean lockfile/toolchain. AC2: Vite 8 emits root/core/effects video/effects audio ESM and CJS runtime files; TypeScript 7 emits ESM `.d.ts` and CJS `.d.cts`; `sideEffects:false`, no import-time browser work, and no auxiliary assets are validated. AC3: package metadata, React peer range, Node/pnpm engines, exact dev validators, conditional exports, typesVersions, and `files` allowlist pass publint strict, ATTW strict, and tarball allowlist inspection; the license boundary is explicit UNLICENSED with LICENSE because no project license has been approved. AC4: package:check installs the packed artifact into temporary React 18.2 and React 19 consumers, compiles TypeScript 7 NodeNext imports, and runs packed ESM, SSR snapshot, and CJS imports for every public entry. AC5: README documents layout, frozen install, build, pack, validation, tarball inspection, side effects, and artifact boundaries. Final repository checks: `pnpm run verify`, `pnpm install --frozen-lockfile`, Oxfmt 0.65.0 check, `pnpm run backlog:dispatchable`, and `git diff --check` all pass. No Backlog Decision was changed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented the user-authorized installable package foundation with Vite 8 ESM/CJS entry builds, TypeScript 7 declarations, conditional export/type maps, SSR-safe core/React/effect modules, explicit metadata and tarball boundaries, and strict publint/ATTW plus packed consumer validation. Verified clean frozen install, aggregate package/lifecycle checks, React 18.2/19 TypeScript/ESM/SSR/CJS consumers, Oxfmt formatting, dispatchability, and git diff checks; license metadata is explicitly UNLICENSED pending a separately approved project license. No media-processing implementation, Decision change, CI, release, or dependency-maintenance scope was added.
<!-- SECTION:FINAL_SUMMARY:END -->
