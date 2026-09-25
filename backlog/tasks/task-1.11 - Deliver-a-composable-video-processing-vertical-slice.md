---
id: TASK-1.11
title: Deliver a composable video-processing vertical slice
status: Done
assignee:
  - '@codex'
created_date: '2026-08-13 20:31'
updated_date: '2026-09-25 11:33'
labels: []
dependencies:
  - TASK-1.4
  - TASK-1.10
  - TASK-1.6
  - TASK-1.7
references:
  - decision-7
  - TASK-1.25
documentation:
  - README.md
  - docs/video-crop-benchmark.md
modified_files:
  - README.md
  - docs/video-crop-benchmark.md
  - src/core/index.ts
  - src/effects/video/index.ts
  - src/effects/video/runtime.ts
  - tests/video-processing.test.ts
  - tests/browser/video-crop.spec.ts
parent_task_id: TASK-1
priority: medium
type: feature
ordinal: 23000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Deliver the smallest end-to-end consumer journey for a user-approved representative video transformation through the validated extension boundary. Start with one representative implementation and a documented baseline measurement, then iterate only on bottlenecks demonstrated by that measurement. The slice must meet the agreed compatibility, visual-quality, and performance contract or expose the documented fallback; do not make broad speculative optimization or production architecture commitments. Use background blur or replacement when it is included in the approved product scope; otherwise record the approved representative scenario.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A representative consumer can add, update, bypass, and remove the approved video transformation without reacquiring unrelated media
- [x] #2 Backpressure, overload, processor failure, cancellation, fallback, and cleanup follow the documented lifecycle and error contract
- [x] #3 The initial implementation is benchmarked against the TASK-1.6 budgets on supported browsers and devices and either meets them or exposes documented fallback behavior; optimization is limited to evidence-backed bottlenecks
- [x] #4 Automated tests and consumer documentation cover the end-to-end transformed-video journey
- [x] #5 The task records baseline measurements, observed bottlenecks, optimization experiments, and unresolved gaps; remaining optimization work is split into a follow-up task instead of silently expanding this slice
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Confirm the approved fixed user-selected 1280×720/30 fps crop and Decision-7 verification baseline.
2. Implement crop add/update/bypass/remove at the session boundary while preserving capture ownership, audio, cancellation, fallback, backpressure, and cleanup.
3. Measure capture-only, pass-through, and crop in three two-second runs per PR browser; record p50/p95/maximum latency, observed frame callbacks, source paint counts, startup, resources, fallback, and browser evidence. Mark exact source-frame loss unknown when the fixture cannot associate frames reliably.
4. Fix the measured cross-browser output-size handoff issue. Avoid speculative throughput optimization; track the strict frame-rate miss, exact source-loss metric, and physical-device attribution in dependent TASK-1.25.
5. Add automated lifecycle and browser coverage, consumer guidance, and the durable benchmark report; run repository verification and finalize from the recorded evidence.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
User approved the baseline-first implementation/evaluation approach on 2026-08-19. This task now owns the first thin slice and evidence-backed iteration; it does not pre-commit to a broad optimization strategy.

Research (2026-09-25): accepted decision-1/doc-1 includes manual camera crop, background blur, still-image replacement, and auto-framing in the first-release video scope, but does not designate one as TASK-1.11's representative scenario. Accepted decision-2/doc-6 defines the semantic lifecycle boundary: independent video processor lifecycle, default bypass to original media during recoverable loading/failure, tagged cancellation/supersession, and deterministic cleanup. TASK-1.6/doc-6 labels the performance/browser policy provisional, and TASK-1.6 notes say those policies remain pending explicit user approval; decision list contains no later accepted performance-budget decision. The specific scenario and approved budget are therefore not evidenced yet; implementation is paused pending coordinator confirmation.

Coordinator communication blocker (2026-09-25): the supplied orchestration ask and escalation commands were attempted with the provided worker handle and Task/Dispatch IDs; Orca rejected both before enqueue with “The Dispatch capability is missing. Pass --dispatch-capability <token> from your dispatch preamble.” The version-matched worker contract requires that capability, but it is absent from the preamble; no alternate credential was guessed or used, and no coordinator question was recorded.

User approval received 2026-09-25 through the active Dispatch: use fixed user-selected camera crop at 1280x720/30 fps for TASK-1.11; exclude background effects and auto-framing from this slice; adopt TASK-1.6/doc-6 budgets, balanced desktop browser cadence, mobile feasibility-only policy, and explicit unknown/exception handling. Created accepted decision-7, “Adopt the fixed camera crop and cross-browser verification baseline,” related to TASK-1.6 and TASK-1.11; earlier Decisions were not changed.

Decision-body CLI exception evidence: Backlog CLI version 1.50.1; `backlog decision --help` and `backlog decision create --help` expose no Decision body/section fields. Created decision-7 metadata through `backlog decision create --status accepted`, then populated only the permitted body sections. Validated that its frontmatter is unchanged, Context/Decision Drivers/Considered Options/Decision/Consequences/Related Tasks are non-empty, `backlog decision list --plain` reports decision-7 accepted, and `git diff --check` passes.

Approval update (2026-09-25): Decision-7 resolves the earlier missing-scenario/budget gate and authorizes implementation within the fixed-crop scope. The remaining work is baseline measurement, implementation, fallback evidence, tests, and consumer documentation.

Implementation and validation (2026-09-25):

Decision-7 authorizes the fixed camera crop at 1280x720/30 fps, excludes background effects and auto-framing from this slice, and adopts TASK-1.6/doc-6 budgets and balanced browser cadence. The session now supports crop add/update/bypass/remove, reports processor state/errors, avoids reacquiring video or audio, uses bounded one-frame-at-a-time drawing, and restores the original video on unsupported, failed, cancelled, or sustained overload processing. Dimension-changing crop updates replace the output track, and session stop/dispose and bypass release processor resources.

Browser baseline: three two-second runs per engine with a deterministic 1280x720 canvas source, on WSL2 Linux x86_64 with 24 logical CPUs. Playwright projects were Chromium/Chrome 151.0.7922.34 and Firefox 153.0; their desktop user-agent profiles identify Windows. The fixture is headless and synthetic, with no physical camera/GPU. Chromium capture/pass-through/crop rates were 29.77-29.81 / 29.33-29.83 / 28.91-30.09 fps; crop p50/p95/maximum source-to-preview latency was 24.10-28.00 / 32.10-34.30 / 34.60-35.00 ms. Firefox rates were 16.03-16.26 / 15.35-16.27 / 13.99-14.47 fps; crop p50/p95/maximum latency was 36.86-46.40 / 40.66-47.92 / 40.72-48.78 ms. All runs had zero skipped preview presented frames; capture first frame was 58.90-65.90 ms on Chromium and 62.82-64.40 ms on Firefox; crop setup was 35.00-36.60 ms and 35.00-37.00 ms respectively.

The strict 30 fps crop target was met in one of three Chromium runs and missed in the other two; Firefox missed in all runs, although its capture-only fixture was already far below target. All p95 latencies and first-frame/startup budgets passed. Firefox automatic overload fallback was verified in all three runs after two slow windows; explicit bypass restored the original camera output in all six browser runs without another getUserMedia call. Five add/update/bypass/remove cycles per run stopped every processor track. Chromium exposed 10,000,000 bytes before and after each cycle group; Firefox did not expose performance.memory.

A browser experiment found that Chromium did not update canvas capture track dimensions after resizing while Firefox did. Recreating and handing off the crop output track on dimension-changing updates produced 960x720 then 640x720 output in both engines with a single capture request. No speculative pixel-throughput optimization was attempted because this synthetic WSL2 fixture cannot establish a physical-device bottleneck.

Durable evidence is in docs/video-crop-benchmark.md and consumer usage/fallback guidance is in README.md. TASK-1.25 tracks physical reference-camera validation, the remaining strict-frame-rate gap, Firefox heap evidence, and only measurement-backed optimization. Edge/Safari remain on the approved nightly/merge-queue cadence, and mobile remains feasibility/manual coverage.

Verification passed: pnpm verify (format, lint, 14 unit tests, typecheck, ESM/SSR/CJS/package-consumer checks, and task-to-PR lifecycle validation) plus pnpm exec playwright test tests/browser/video-crop.spec.ts --project=chromium --project=firefox (2 tests passed, three measured runs and five warm cycles per browser). git diff --check passed before task finalization.

Final acceptance audit (2026-09-25): Decision-7 requires five warm session start/stop cycles against an inactive post-warm-up heap baseline. The first browser harness covered five processor add/update/bypass/remove cycles only, so TASK-1.11 is returned to In Progress while session-level cycle and heap evidence is added.

Final benchmark correction (2026-09-25): this section supersedes preliminary ranges earlier in these notes and is based on the final video-crop-baseline.json after removing the unreliable pixel-ID drop decoder. Three two-second runs per browser used Chrome 151.0.7922.34 and Firefox 153.0 in the headless WSL2 Linux x86_64 runner with a deterministic 1280×720/30 fps canvas source and desktop Windows user-agent profiles.

Chromium capture-only/pass-through/crop throughput measured 29.78–29.91 / 29.72–29.82 / 29.08–29.66 fps. Crop p50/p95/maximum latency was 24.50–25.70 / 33.70–34.40 / 34.70–42.90 ms; capture first frame was 61.30–68.30 ms, crop first frame 68.60–84.20 ms, and crop setup 27.40–39.50 ms. Firefox throughput measured 15.49–16.27 / 16.26–16.69 / 13.57–14.23 fps. Crop p50/p95/maximum latency was 39.94–44.12 / 44.24–47.60 / 44.48–47.92 ms; capture first frame was 54.68–62.40 ms, crop first frame 148.86–149.92 ms, and crop setup 36–37 ms. All runs met the first-frame, crop p95, and setup budgets; capture-only and crop strict 30 fps budgets were missed in every run.

Preview requestVideoFrameCallback sequences had zero reported presentedFrames gaps. Source generator paints and preview callback counts are included in docs/video-crop-benchmark.md, but exact source-frame loss percentage and TASK-1.6 capture-only 1% loss criterion remain unknown: interval counts are not exact frame correspondence and the synthetic pixel-ID decoder was inconsistent. No source-loss percentage is claimed. The headless canvas results do not establish real-camera behavior; Edge/Safari remain on the approved periodic cadence, and physical reference devices/mobile are not measured here.

Firefox automatically restored the original video output after two slow processing windows in all three runs; explicit bypass is documented for the Chromium strict-rate miss. Effect add/update/bypass/remove did not reacquire video or audio and restored the original output. In every browser session, five warm effect cycles stopped all processor tracks, and five warm session start/stop cycles stopped all reacquired capture tracks. Chromium heap was 10,000,000 bytes before and after each lifecycle batch; Firefox does not expose performance.memory in this fixture. Each processing journey called getUserMedia once; separate session restarts necessarily made five additional capture calls. Crop output dimensions changed from 960×720 to 640×720 using a replacement track in both engines without reacquiring capture.

Remaining measured-rate, source-loss, physical-reference-camera, and Firefox heap evidence is tracked in TASK-1.25; no speculative throughput optimization was applied. Final verification passed: pnpm verify (format, lint, 14 unit tests, typecheck, build, ESM/SSR/CJS/package consumers, lifecycle validation), Playwright Chromium+Firefox (2 browser tests, three measured runs and five warm effect/start-stop cycles per browser), and git diff --check.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Delivered the approved fixed-camera crop through the session API with update, bypass, failure/cancellation/overload fallback, cleanup, consumer documentation, and a durable benchmark. pnpm verify and the Chromium/Firefox Playwright benchmark passed; latency and startup budgets passed, while strict 30 fps misses and unknown exact source-frame loss are recorded with fallback behavior. TASK-1.25 tracks the remaining physical-device, exact-loss, Firefox heap, and measured optimization work.
<!-- SECTION:FINAL_SUMMARY:END -->
