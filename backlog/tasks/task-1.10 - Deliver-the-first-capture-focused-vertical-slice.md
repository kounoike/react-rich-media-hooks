---
id: TASK-1.10
title: Deliver the first capture-focused vertical slice
status: Done
assignee:
  - '@codex'
created_date: '2026-08-13 20:31'
updated_date: '2026-09-04 04:13'
labels: []
dependencies:
  - TASK-1.9
  - TASK-1.20
parent_task_id: TASK-1
priority: high
type: feature
ordinal: 22000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Deliver the smallest supported end-to-end consumer journey for acquiring browser media through the agreed React API, including transparent lifecycle and failure behavior. Processing features remain outside this slice unless required to prove the extension contract.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A representative React consumer can request the scoped media, render or otherwise consume it, and release it through the documented public API
- [x] #2 The consumer can exercise the approved device discovery, labeling, selection, switching, preference, and fallback behavior without bypassing the public API
- [x] #3 Permission denial, unavailable or removed devices, cancellation, overlapping requests, rerendering, unmounting, and development Strict Mode follow the documented state and cleanup contract
- [x] #4 Unsupported execution contexts fail in the documented manner without import-time crashes
- [x] #5 Automated verification covers the agreed deterministic and browser-level scenarios
- [x] #6 Consumer documentation includes a minimal example, device selection, state and error handling, and resource ownership guidance
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Replace the inert core session with a browser-safe capture controller that owns getUserMedia streams, exposes immutable snapshots, explicit start/stop/retry/switch actions, and generation-tagged cancellation/supersession results.
2. Add public device discovery/selection helpers and session device snapshots with secure-context/visibility feature detection, redacted-label handling, devicechange reconciliation, remembered-preference fallback, exact explicit switching, and track mute/ended observation.
3. Preserve approved ownership semantics: session-owned tracks are stopped exactly once, application output clones are independent, output replacement is observable through stable output metadata, disposal is idempotent, and React hooks/provider remain thin useSyncExternalStore adapters.
4. Add deterministic fake browser-media tests for discovery, constraints, lifecycle races, cleanup, failures, cancellation, switching, fallback, clones, unsupported contexts, rerendering, unmounting, and Strict Mode; add browser-level Chromium/Firefox tests for real secure-loopback capture and device lifecycle behavior.
5. Update consumer documentation with the minimal capture example, device discovery/selection and fallback guidance, state/error handling, output attachment, clone ownership, SSR/unsupported behavior, and explicit session disposal; run formatting, lint, type, unit, browser, package, lifecycle, and diff checks.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Research 2026-09-04: Read accepted Decision-1 (product/quality), Decision-2 (framework-neutral session + thin React hooks, standard outputs, session ownership, generation cancellation, explicit switching, SSR-safe browser activation), Decision-5 (TypeScript/Vitest/Playwright/Vite toolchain), Decision-6, dependencies TASK-1.9 and TASK-1.20, API doc-6, and lifecycle/device evidence doc-4/TASK-1.13. Existing production code is an inert SSR-safe session with placeholder snapshot types and only unsupported behavior; package/build/test infrastructure is already established. Implementation remains within the accepted capture slice and does not add processors, external input/adoption, transport, or a new Decision.

Implementation 2026-09-04: Replaced the inert session with a browser-safe capture owner using getUserMedia, immutable snapshots, explicit start/stop/retry/switch actions, generation-tagged cancellation/supersession, owned-track cleanup, standard per-kind outputs, output clone ownership, and track mute/ended observation. Added public refreshDevices/getDevices data with partial/redacted labels, devicechange refresh, remembered device preference fallback, exact explicit switching, selected device evidence, and typed DOMException categories. Kept processor factories, external capture input/adoption, transport, and other product scope unchanged.

Validation evidence 2026-09-04: pnpm verify passed formatting, Oxlint, 8 Vitest tests, package build/packed React 18.2 and 19 ESM/SSR/CJS/TypeScript consumers, and lifecycle policy. pnpm test:browser:smoke passed Chromium and Firefox secure-loopback capture with discovery, video/audio output, stop, and dispose. node --check experiments/capture-lifecycle/run.mjs and node experiments/capture-lifecycle/run.mjs passed CAPTURE_LIFECYCLE_EXPERIMENT_PASS with 5 scenarios and 41 assertions including React Strict Mode, stale completion, cancellation, ownership, removal, replacement, retry, and cleanup. pnpm run backlog:dispatchable returned no remaining tasks; git diff --check passed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented the first capture-focused vertical slice: browser-safe MediaSession capture with explicit lifecycle actions, generation-safe cancellation and stale-result cleanup, standard outputs and clone ownership, device discovery with redaction/partial state, remembered-preference fallback, exact switching, devicechange reconciliation, track activity/error state, and SSR-safe unsupported behavior. Added deterministic fake-media coverage plus Chromium/Firefox secure-loopback checks and documented the consumer flow in README; pnpm verify, package consumers, capture lifecycle experiment (5 scenarios/41 assertions including Strict Mode), browser smoke, lifecycle policy, dispatchability, and git diff checks passed.
<!-- SECTION:FINAL_SUMMARY:END -->
