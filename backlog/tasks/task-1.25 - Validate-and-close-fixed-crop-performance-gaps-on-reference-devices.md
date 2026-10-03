---
id: TASK-1.25
title: Validate and close fixed-crop performance gaps on reference devices
status: In Progress
assignee:
  - '@codex'
created_date: '2026-09-25 10:53'
updated_date: '2026-10-03 14:07'
labels: []
dependencies:
  - TASK-1.11
references:
  - decision-7
documentation:
  - doc-6
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
1. Review accepted decision-7, verification/doc-6, and the TASK-1.11 benchmark to establish the exact budgets and remaining gaps.
2. Identify the available reference camera and browser/device access; run the required three capture-only, pass-through, and fixed-crop trials plus five warm lifecycle cycles on each accessible 1280x720/30 reference device.
3. Compare delivered rate, dropped frames, first-frame time, p95 latency, heap, and cleanup evidence to doc-6; optimize only a bottleneck confirmed by those measurements and preserve original-media fallback and session ownership.
4. Retain unknown or unavailable device/browser rows explicitly, preserve automated lifecycle coverage and consumer guidance, and make no public API, compatibility, distribution, or architecture changes.
5. Run required repository checks, audit every acceptance criterion against evidence, record findings and final summary through Backlog CLI, and mark this task Done only if all criteria are satisfied.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Environment and verification findings (2026-10-03):

The dispatched worktree runs in WSL2 Linux x86_64 and exposes no /dev/video* device. The required physical 1280x720/30 camera and native reference-device setup are unavailable here. I sent the coordinator a Dispatch-scoped ask for device access; the response is pending. No physical-device result is claimed, so AC #1 and the reference-device portions of #2/#3 remain open. No optimization was made because no reference-device bottleneck is confirmed.

`pnpm verify` passed: format check, lint, 14 unit tests, typecheck, ESM/SSR/CJS and React consumer package validation, and task-to-PR lifecycle validation. `pnpm exec playwright test tests/browser/video-crop.spec.ts --project=chromium --project=firefox` passed 2 browser tests, each performing three synthetic 1280x720/30 canvas runs and five warm add/update/bypass/remove cycles plus five session start/stop cycles. This is virtual canvas evidence, not physical-camera evidence.

The run used Chrome 151.0.7922.34 and Firefox 153.0 profiles on the WSL2 host. Chromium capture/pass-through/crop rates were 29.80-29.88 / 29.84-29.88 / 29.03-29.99 fps; crop p95 was 33.60-34.30 ms and capture first frame was 69.80-73.33 ms. Firefox rates were 16.06-16.45 / 15.83-16.82 / 14.18-14.47 fps; crop p95 was 46.34-48.60 ms and capture first frame was 49.70-69.80 ms. All six crop runs missed the strict 30 fps target while p95 and first-frame budgets passed. Preview presented-frame gaps were zero, but exact source-frame loss remains unknown because the harness cannot reliably associate every source frame. Firefox automatic overload fallback was verified in all three runs; Chromium requires the documented explicit bypass for the strict-rate miss.

All runs completed five warm effect cycles with owned tracks stopped and one capture request per processing journey. Chromium heap remained 10,000,000 bytes before/after the five session restart cycles; Firefox exposes no retained-heap API in this browser. Existing unit/browser coverage and README.md document no reacquisition, cancellation, processor failure, bypass, cleanup, and consumer fallback guidance; this supports AC #4. Edge and Safari were not run in this WSL2 PR validation; doc-6 assigns them nightly/merge-queue coverage. Mobile remains feasibility/manual only. Their device outcomes remain unknown and no cadence or support claim was changed.

Acceptance audit (2026-10-03): AC #1 is unmet because no physical reference camera is accessible. AC #2 has synthetic-only measurements; physical per-device comparison and exact source-loss evidence remain open. AC #3 has no reference-device before/after result; no optimization was attempted without an evidenced physical bottleneck, and synthetic fallbacks are documented. AC #4 and AC #5 are checked from passing lifecycle/browser verification, consumer guidance, and the recorded doc-6 cadence/unknowns. Keep the task In Progress; the access ask was resumed after its first timeout and a blocker escalation was sent.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Validated existing crop lifecycle coverage and consumer fallback guidance with pnpm verify and the Chromium/Firefox synthetic benchmark. The synthetic runs retained the strict 30 fps gap and unknown source-frame loss; no physical reference camera was available from this WSL2 worktree, so AC #1-#3 remain open while AC #4-#5 are verified. TASK-1.25 remains In Progress pending reference-device access.
<!-- SECTION:FINAL_SUMMARY:END -->
