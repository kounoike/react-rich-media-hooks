---
id: TASK-1.25
title: Validate and close fixed-crop performance gaps on reference devices
status: In Progress
assignee:
  - '@codex'
created_date: '2026-09-25 10:53'
updated_date: '2026-10-03 14:39'
labels: []
dependencies:
  - TASK-1.11
references:
  - decision-7
documentation:
  - doc-6
modified_files:
  - README.md
  - docs/video-crop-benchmark.md
  - package.json
  - tests/browser/video-crop-benchmark.css
  - tests/browser/video-crop-benchmark.html
  - tests/browser/video-crop-benchmark.spec.ts
  - tests/browser/video-crop-benchmark.ts
  - tests/browser/video-crop-latency-marker.html
  - tests/browser/video-crop-latency-marker.ts
parent_task_id: TASK-1
priority: medium
type: task
ordinal: 25000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Close the measured verification gaps left by TASK-1.11 for the approved fixed camera crop at 1280×720 and 30 fps. The TASK-1.11 synthetic browser baseline on a WSL2 runner met the crop latency budget but missed the 30 fps target in Chromium and Firefox; physical camera/device performance and Firefox heap evidence remain unknown. First establish repeatable per-device evidence and attribute capture-only versus crop cost, then optimize only a bottleneck confirmed on a reference device. Preserve original-media fallback and session-owned cleanup, and do not make public API, compatibility, or architecture changes without an accepted Backlog Decision.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Record at least three capture-only, pass-through, and fixed-crop runs plus five warm add/update/bypass/remove cycles on a physical 1280×720/30 reference camera, with per-browser/device versions and lifecycle cleanup evidence.
- [ ] #2 Compare capture-only and crop frame rate, unexpected dropped frames, first-frame time, source-to-preview p95 latency, and available retained-heap measurements against TASK-1.6/doc-6 budgets.
- [ ] #3 Optimize only bottlenecks supported by those measurements and record the before/after evidence; if budgets remain missed, document tested fallback and affected browser/device combinations.
- [x] #4 Preserve the TASK-1.11 no-reacquisition, cancellation, failure, bypass, and cleanup behavior with automated coverage and consumer guidance.
- [x] #5 Leave Edge, Safari, and mobile coverage within the approved doc-6 cadence and record any still-unknown device results.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Inspect TASK-1.25 notes, accepted decision-7/doc-6 budgets, and the current crop benchmark and consumer API.
2. Implement a local on-demand browser measurement flow that opens the camera only after explicit start, guides three capture-only/pass-through/fixed-crop runs and five warm effect cycles, records the adopted metrics plus browser/device/runtime metadata, and downloads JSON.
3. Validate the flow using synthetic/fake camera input, including start/stop, fallback, and cleanup; do not open physical camera or start a dev server during implementation.
4. Run pnpm verify and Chromium/Firefox crop browser checks; update benchmark and consumer guidance with tool use and known physical-device gaps.
5. Audit acceptance criteria against evidence, preserve unknown physical rows, record the final summary through Backlog CLI, and mark Done only if all required criteria are satisfied.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Environment and repeat-run validation (2026-10-03): the active worker runs in WSL2 Linux x86_64 (`uname` reports the Microsoft WSL2 kernel). Enumerating `/dev` found no video character devices and `v4l2-ctl` is not installed, so this environment has no accessible physical reference camera. I asked the coordinator whether this Dispatch can be routed to an approved physical-device runtime; no reply had arrived at the latest inbox check.

The approved decision-7 and verification/doc-6 budgets remain unchanged. The `doc-6` CLI view is ambiguous because a separate API contract has the same document ID; the task-linked `backlog/docs/verification/doc-6` was read directly and is the verification strategy. It requires missing device rows to remain `unknown`/`blocked`, with no inferred pass. Edge and Safari stay on nightly/merge-queue and release cadence; mobile remains feasibility/manual only. No compatibility, API, product, or architecture decision was made.

`pnpm verify` passed: format, lint, 14 unit tests, typecheck, build, ESM/SSR/CJS and React 18.2/19.1.1 package-consumer checks, and task-to-PR lifecycle validation. The first Playwright attempt correctly exposed that `dist` had not yet been built; after `pnpm verify` built it, `pnpm exec playwright test tests/browser/video-crop.spec.ts --project=chromium --project=firefox` passed both browser tests. Each engine run used three 2-second capture-only/pass-through/crop trials, five warm effect add/update/bypass/remove cycles per trial, five session start/stop cycles, and track cleanup checks.

These Playwright trials still replace camera capture with the deterministic 1280x720 canvas and are not physical-device evidence. Chrome 151 (Windows desktop UA profile on WSL2): capture-only 29.82-29.91 fps, pass-through 29.83-29.84 fps, crop 29.19-30.03 fps, crop p95 33.5-34.6 ms, first frame 60.7-85.0 ms, zero observed `presentedFrames` gaps, and exact source-frame drop percentage unknown. Chromium heap remained 10,000,000 bytes before/after the five session cycles, and effect tracks were released. Firefox 153 (Windows desktop UA profile on WSL2): capture-only 16.03-16.50 fps, pass-through 16.26-16.56 fps, crop 13.77-13.92 fps, crop p95 47.92-48.26 ms, first frame 61.4-150.0 ms, zero observed callback gaps, and exact source-frame drop percentage unknown; `performance.memory` is unavailable. All trials requested one capture per effect journey, released effect tracks, and released all five session tracks. Firefox capture-only already missed the 30 fps target in this synthetic fixture, so these data do not establish a physical crop bottleneck. The browser checks exercised Firefox automatic original-video fallback and explicit bypass/removal; README consumer fallback guidance remains present.

Acceptance audit: #1 and #2 remain unproven because no physical reference camera is accessible; #3 cannot be closed without that reference measurement, so no speculative optimization was attempted. #4 is verified by passing unit and browser coverage plus the existing README guidance. #5 remains on the approved Edge/Safari/mobile cadence, with their still-unknown results recorded here. The physical-device performance gaps remain open.

User-approved scope (coordinator follow-up, 2026-10-03): implement a local user-operated measurement page in TASK-1.25. Camera access begins only after explicit Start, and Stop or normal completion releases the session tracks; physical camera capture was not run during implementation. The page guides three 2-second capture-only, pass-through, and fixed-crop measurements after 1-second warm-up, then records five add/update/bypass/remove effect cycles and five session stop/start retention cycles. It exports browser and client-hint versions, package version, user-entered full commit SHA/host/runtime/camera details, requested and negotiated settings, frame rate, presented-frame callback gaps, first usable frame, marker-to-preview latency, crop startup, available heap, budget comparisons, and cleanup evidence. A synchronized marker-only window uses same-origin BroadcastChannel for cameras that cannot see their own display; it does not request camera access. Camera device IDs are omitted. Exact source frames never delivered remain unknown because requestVideoFrameCallback only reports observable callback gaps; latency remains unknown when the optical marker is not decoded, and retained heap remains unavailable where performance.memory is absent.

Final verification: pnpm verify passed format, lint, 14 unit tests, typecheck/build, ESM/SSR/CJS/package consumer checks for React 18.2.0 and 19.1.1, and task-to-PR lifecycle validation. pnpm exec playwright test tests/browser/video-crop-benchmark.spec.ts tests/browser/video-crop.spec.ts --project=chromium --project=firefox passed all 6 tests, including synthetic measurement/export, explicit stop during a run, the existing crop baseline, and track cleanup. The Playwright-configured webServer ran only for these fake-input checks; no physical camera was requested. The synthetic tool test confirmed zero camera requests before Start, six session starts across the profile journey and retention cycles, five effect cycles, and ended tracks after completion.

The active runtime is WSL2 and exposes no /dev/video character device; v4l2-ctl is absent. The approved decision-7/doc-6 budgets and cadence remain unchanged. Acceptance criteria #1-#3 remain unchecked because physical reference-camera runs and device budget comparisons are still absent; no physical bottleneck is confirmed, so no speculative optimization or before/after claim was made. The existing synthetic Chrome/Firefox results and fallback are documented in docs/video-crop-benchmark.md; exact source-frame loss and Firefox retained heap remain unknown. Criteria #4 and #5 remain checked based on existing unit/browser coverage and the approved Edge/Safari/mobile cadence. No public API, compatibility, or architecture decision was made.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added a local, user-operated camera benchmark with synchronized optical latency marker, three capture-only/pass-through/crop trials, five effect cycles, five retention cycles, JSON export, and explicit cleanup. pnpm verify and six Chromium/Firefox browser tests passed using synthetic input. Physical reference-device measurements remain unavailable in this WSL2 workspace, so acceptance criteria #1-#3 stay unchecked and TASK-1.25 remains In Progress pending user-operated reference-camera evidence.
<!-- SECTION:FINAL_SUMMARY:END -->
