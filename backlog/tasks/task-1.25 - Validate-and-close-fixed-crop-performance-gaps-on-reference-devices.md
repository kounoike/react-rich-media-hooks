---
id: TASK-1.25
title: Validate and close fixed-crop performance gaps on reference devices
status: In Progress
assignee:
  - '@codex'
created_date: '2026-09-25 10:53'
updated_date: '2026-10-05 21:43'
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
  - src/effects/video/runtime.ts
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
1. Reconfirm decision-7 and doc-6 budgets and review the existing synthetic and physical-device evidence.
2. Correct benchmark-only attribution errors for restored source-track identity and measure first usable frame after getUserMedia resolves.
3. Attribute the reproduced Chrome reference-device crop throughput loss within the approved fixed-crop path and make only a scoped, measurement-supported optimization.
4. Prepare the benchmark to measure marker-to-preview p95 and collect user-operated before/after physical-device evidence.
5. Keep criteria #1-#3 open until valid reference-device frame-rate, latency, startup, and lifecycle evidence is recorded; update the task and Draft PR.
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

Coordinator follow-up (2026-10-03): the user explicitly directed a synthetic-camera evaluation in this Dispatch. Do not open or expose a physical camera or occupy a Windows desktop. Exercise the actual crop measurement flow with a reproducible software-generated 1280x720@30 source, report metrics and lifecycle cleanup with exact runtime details, clearly label results as software-pipeline evidence, and keep TASK-1.25 In Progress with criteria #1-#3 unclaimed. No public API or contract changes are authorized.

Synthetic canvas repeat (2026-10-03 UTC): pnpm verify passed formatting, lint, all 14 unit tests, typecheck/build, ESM/SSR/CJS and React 18.2.0/19.1.1 consumer validation, and task-to-PR lifecycle validation. The six relevant Playwright checks passed in Chrome 151.0.7922.34 and Firefox 153.0. The baseline runner returned a deterministic changing 1280x720 canvas.captureStream(30) track through its getUserMedia override; it exercised the library session and crop output without accessing a physical camera. Runtime was WSL2 Linux x86_64 (kernel 6.18.40.1, 24 logical CPUs), Node v24.19.0, pnpm 11.21.0; desktop profiles advertised Windows UA while reporting Linux platform.

Fresh three-run results are recorded in docs/video-crop-benchmark.md. Chrome capture/pass-through/crop ranges were 29.82-30.18 / 29.64-29.84 / 29.03-29.67 fps; crop p95 27.90-34.60 ms; first capture frame 59.03-72.50 ms and first crop frame 78.60-86.30 ms. Firefox ranges were 15.63-16.31 / 16.01-16.26 / 14.17-14.84 fps; crop p95 47.76-48.30 ms; first capture frame 58.36-71.76 ms and first crop frame 83.24-149.30 ms. Both reported zero presented-frame callback gaps, which does not measure source frames never delivered. Each session passed five warm effect add/update/bypass/remove cycles and five stop/start cycles with processor/input tracks ended. Chromium exposed an unchanged 10,000,000-byte JS heap reading; Firefox retained heap remains unavailable. Firefox automatic original-video fallback and explicit bypass/removal passed; Chromium did not trigger its automatic threshold, and explicit bypass/removal passed.

This is software-pipeline evidence only. The synthetic source cannot establish physical camera/device frame rate, exact source-frame loss, thermal behavior, or a reference-device bottleneck. No optimization or public contract change was made. Acceptance criteria #1-#3 remain unchecked and unknown pending user-operated physical reference-camera runs; TASK-1.25 remains In Progress.

Measurement-count clarification: the performance table uses only the full-duration video-crop.spec.ts attachment (three two-second stages per profile/browser), not the separate ?test=1 UI artifact. Crop p95 used 59, 60, 59 matched latency samples for Chromium runs 1-3 and 29, 30, 29 for Firefox; exact preview callback/source canvas paint/latency sample counts for each capture-only, pass-through, and crop stage are in docs/video-crop-benchmark.md. Chromium control-path latency matching had only 7-11 samples per run. The ?test=1 page test uses 250 ms stages and about 4-9 frames and is used only for flow, lifecycle, and export verification.

Physical-device browser smoke (2026-10-06): Orca app 1.4.220, default profile, Chrome 150.0.7871.250 on Win32. getUserMedia for c922 Pro Stream Webcam (046d:085c) negotiated 1280x720 at 30 fps. With a visible video element appended to the DOM, requestVideoFrameCallback fired for a 1280x720 frame while document.visibilityState was visible and document.hasFocus was false. An earlier callback timeout used a detached video element, so tab inactivity is not established as the cause. This is smoke evidence only, not sustained fps or acceptance evidence; acceptance criteria #1-#3 remain open.

Measurement-page readiness review (2026-10-06): Inspected the existing page in the Orca built-in browser at http://127.0.0.1:4173/tests/browser/video-crop-benchmark.html (default profile). The page reports camera off/no permission requested, Start camera enabled, Run measurements disabled, and no results, so it is ready for the user-operated run and no benchmark was collected in this dispatch. Before starting, replace the benchmark SHA after this task-note commit, populate the physical host/device field, and replace the prefilled WSL2 Node/pnpm entry with values from the physical runtime; camera identifier field currently says c922. The existing PR #28 is OPEN/Draft on this same branch; its current body contains synthetic evidence but identifies the previous dispatch, so update its body/evidence through the coordinator normal completion flow after this task-record commit is pushed. No PR edit was made in this dispatch. Keep TASK-1.25 In Progress and criteria #1-#3 unchecked.

Added an in-page physical-run verdict panel to the local benchmark. It shows OK, NG, incomplete, or excluded status per input, trial coverage, performance budgets, and track cleanup; a required physical-camera attestation prevents synthetic Playwright input from being counted as device evidence. Acceptance criteria #1-#3 remain open until user-operated physical-device results are reviewed.

User-operated physical reference-camera run (Chrome 154.0.8037.98 on Windows 25H2, C922 Pro Stream Webcam 046d:085c, negotiated 1280x720@30; report commit a9343566ac1d6a530c462b7166f7be91a4a8d086): three capture-only trials measured 30.16/29.78/29.76 fps, pass-through 29.81/29.91/29.85 fps, and fixed crop 26.01/27.13/29.10 fps. All presented-frame callback gap percentages were 0%; exact source frames never delivered are not observable. Crop setup was 43.4-72.9 ms. All three crop p95 latency fields are null because the optical marker yielded zero samples. Five session start/stop cycles and cleanup passed (19 tracks observed, zero live after dispose); heap decreased from 8,068,358 to 7,820,386 bytes and stayed within budget. All five effect cycles reported successful add/update/bypass/remove, bypass restored the original, and prior effect tracks ended. The reported removeRestoredInput=false is a benchmark identity-comparison error: runProfiles leaves the final crop applied, then runEffectCycles stores that crop output as inputTrack before clearing it, and later compares the restored camera track against the crop track. The implementation and existing browser coverage compare removal against the original capture track. The 9,654.5 ms first-frame value was timed from before MediaSession.start(), therefore includes the OS camera permission prompt; it cannot be compared to the decision-7 500 ms budget, which begins after permission resolution. Missing host make/model remains a metadata gap. This physical run confirms a crop-specific throughput miss relative to pass-through, but does not yet complete criteria #1-#3 because latency is unmeasured and startup timing is confounded.

Follow-up to the first physical run: fixed the benchmark's remove-restoration comparison by retaining the original source track from camera startup instead of sampling the active crop output after the performance profiles. First-frame timing now begins at the instrumented getUserMedia stream-resolution time; getUserMedia request-to-stream duration is reported separately, including any user permission wait. Added a scoped crop scheduling experiment inside the approved canvas path: use captureStream(0) plus requestFrame() after each source-frame draw when supported, and retain the existing cadence-based capture as fallback. No after-result is available yet; the physical before/after comparison is required before claiming a performance improvement or closing criteria #1-#3. Updated the reference benchmark report and user instructions. Validation: pnpm build passed (Vite production build, build TypeScript compilation, and CJS declarations); git diff --check passed. Automated tests were not run.

Additional static check after formatting: pnpm typecheck passed, including the updated benchmark page TypeScript. No automated test suite was run in this follow-up.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Reran the fixed-crop pipeline with a deterministic 1280x720/30 canvas source in Chrome 151.0.7922.34 and Firefox 153.0, documented per-run throughput, p95 latency, first-frame and cleanup results, and verified the synthetic benchmark UI. pnpm verify and all six Chromium/Firefox browser checks passed. This software-only run cannot satisfy physical-reference criteria #1-#3, so TASK-1.25 remains In Progress pending user-operated physical-device evidence.
<!-- SECTION:FINAL_SUMMARY:END -->
