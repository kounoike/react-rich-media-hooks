---
id: TASK-1.4
title: Validate browser video-processing feasibility
status: Done
assignee:
  - '@codex'
created_date: '2026-08-13 20:31'
updated_date: '2026-08-16 18:47'
labels: []
dependencies:
  - TASK-1.1
  - TASK-1.2
  - TASK-1.14
  - TASK-1.17
documentation:
  - doc-5
modified_files:
  - experiments/video-feasibility/index.html
  - experiments/video-feasibility/benchmark.js
  - backlog/docs/research/video/doc-5 - Browser-Video-Processing-Feasibility.md
parent_task_id: TASK-1
priority: high
type: spike
ordinal: 10000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Validate whether representative browser video transformations can meet the scoped experience and quality hypotheses. Compare capability categories and execution placements empirically while keeping the experiment disposable and avoiding a production technology commitment.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Representative transformations, visual scenes, and input profiles are defined from the approved product contract and background-processing analysis
- [x] #2 The spike measures latency, throughput, frame drops, CPU and memory signals, startup cost, and recovery from processing overload
- [x] #3 Visual quality is compared reproducibly against agreed baselines, including boundary, motion, occlusion, lighting, and fallback cases relevant to the selected transformations
- [x] #4 Main-thread and off-main-thread implications, frame transfer costs, backpressure, cancellation, cleanup, and output interoperability are evaluated where supported
- [x] #5 Browser coverage, device-class limits, fallback behavior, and material privacy or security constraints are documented
- [x] #6 The feasibility conclusion, alternatives, evidence, and tradeoffs are presented to the user; any accepted significant decision is recorded with Backlog.md Decisions only after explicit approval
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Inspect the approved product contract, TASK-1.2 capability map, TASK-1.14 background-processing analysis, and TASK-1.17 interoperability report; keep all implementation and architecture choices approval-bound.
2. Run a disposable browser video benchmark covering representative crop, background replacement/blur, and subject-framing fixtures across rendered-output, raw-track, and frame/codec categories where the installed browsers expose them.
3. Measure startup, throughput, frame drops, latency, CPU/memory proxies, overload recovery, frame-transfer/backpressure, cancellation, cleanup, and output handoff; compare reproducible visual cases and document unknown browser/device coverage.
4. Create a dated evidence report and link it to TASK-1.4, recording alternatives, tradeoffs, fallback/privacy constraints, and follow-up questions without accepting a significant product, API, compatibility, or architecture decision.
5. Run repository checks, verify every acceptance criterion objectively, check the task criteria, record the final summary through Backlog, commit all task/report changes, and push the branch.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Feasibility spike evidence (2026-08-17 JST)

Created doc-5 and the dependency-free experiments/video-feasibility harness. The harness fixes 1280x720/30 synthetic input and measures crop, background replacement/blur-style compositing, worker ImageBitmap transfer, Chromium legacy raw-track generation, overload/backpressure, cancellation, cleanup, output video/MediaRecorder/RTCPeerConnection handoff, and reproducible oracle-mask quality scenarios covering boundary, motion lag, occlusion, low light, and original-frame fallback.

Chrome 151.0.7922.137 exposed MediaStreamTrackProcessor plus legacy MediaStreamTrackGenerator in Window but none of the tested raw-track constructors in DedicatedWorker; Firefox 153.0.4 exposed no raw-track constructors in Window or Worker. Canvas was portable in both tested engines; the short runs produced approximately 25.2-27.4 fps in Chrome and 25.7 fps in Firefox for canvas paths, 24.6 fps for Firefox ImageBitmap worker transfer, and 12.8 fps for the same worker path in Chrome. Chrome raw-track copy delivered 27.1 fps but dropped output frames; all paths stopped tracks and settled cleanup. Edge, Safari, mobile, hardware acceleration, model inference/quality, asset delivery, and real-device CPU/memory remain explicitly unknown.

The evidence supports a portable rendered-output fallback with raw-track/worker paths as approval-bound optimizations; no production architecture, API, compatibility promise, model, runtime, or significant Decision was accepted. Full measurements, quality scores, command context, limitations, alternatives, and acceptance mapping are in doc-5.

## Final verification (2026-08-17 JST)

Acceptance criteria verified against doc-5 and executed evidence: Chrome 151.0.7922.137 capabilities/quality/canvas/worker/raw runs; Firefox 153.0.4 WebDriver capabilities/quality/canvas/worker/raw runs; Chrome optional MediaRecorder and RTCPeerConnection handoff smoke; Chrome /usr/bin/time -v CPU/RSS signals; Chrome performance.memory heap deltas; worker bounded queue and cancellation; raw pipe abort and track cleanup; and cross-engine oracle-mask quality metrics. Edge, Safari, mobile, model inference, hardware acceleration, real-device profiling, and model asset delivery remain explicitly documented unknowns rather than unsupported claims.

Repository checks passed: pnpm run validate:lifecycle; pnpm run backlog:dispatchable; node --check experiments/video-feasibility/benchmark.js; git diff --check; backlog decision list --plain; and backlog doc view doc-5 --plain. No Definition of Done items are defined.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @codex
created: 2026-08-16 18:46
---
2026-08-17: Feasibility evidence and approval-bound alternatives are recorded in doc-5; no significant product/API/compatibility/architecture choice was accepted.
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Validated browser video-processing feasibility with a disposable 1280x720/30 harness and recorded the dated evidence in doc-5. Chrome 151 and Firefox 153 measurements cover canvas crop/replacement/blur, ImageBitmap worker transfer and overload, Chromium legacy raw-track generation, visual oracle scenarios, frame/latency/CPU/RSS/heap signals, output handoff, cancellation, cleanup, fallbacks, and explicit Edge/Safari/mobile/model-quality unknowns; recommendations remain approval-bound and no significant Decision was accepted. Verified all six acceptance criteria and repository checks: pnpm run validate:lifecycle, pnpm run backlog:dispatchable, node --check, git diff --check, decision list, and doc view.
<!-- SECTION:FINAL_SUMMARY:END -->
