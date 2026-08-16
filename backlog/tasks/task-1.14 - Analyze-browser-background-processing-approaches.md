---
id: TASK-1.14
title: Analyze browser background-processing approaches
status: In Progress
assignee:
  - '@codex'
created_date: '2026-08-13 21:02'
updated_date: '2026-08-16 12:17'
labels: []
dependencies:
  - TASK-1.1
  - TASK-1.2
references:
  - 'https://github.com/shiguredo/media-processors'
parent_task_id: TASK-1
priority: high
type: spike
ordinal: 5000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Determine feasible approaches for background blur, replacement, and related person-segmentation effects in browser real-time video. Analyze browser primitives and representative existing implementations before recommending which approaches deserve empirical validation. shiguredo/media-processors is a mandatory comparison target. The user reports having contributed to strengthening that library in 2023 and has relevant implementation knowledge that should be consulted when interpreting its design and tradeoffs. Do not implement production code or accept an architecture in this task.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 shiguredo/media-processors is analyzed as a mandatory comparison target, including its virtual-background public API, processing pipeline, segmentation or matting approach, execution placement, browser coverage, extensibility, licensing, and maintenance characteristics
- [ ] #2 Other representative libraries and SDKs are compared against the same criteria, with the selection rationale and primary sources documented
- [ ] #3 Candidate pipeline categories are evaluated for frame acquisition, segmentation, compositing, output interoperability, backpressure, cancellation, and resource cleanup
- [ ] #4 Quality and performance evaluation profiles cover representative resolutions and devices, visual artifacts, latency, frame drops, CPU, memory, startup or model-loading cost, and overload recovery
- [ ] #5 Privacy, asset delivery, offline or content-security constraints, accessibility implications, and fallback behavior are documented
- [ ] #6 Findings about shiguredo/media-processors that benefit from the user’s 2023 contributor experience are explicitly reviewed with the user, and no significant product or architecture decision is treated as accepted without explicit user approval
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Anchor the scope in accepted decision-1/doc-1 and TASK-1.2 capability constraints; inspect existing records before making recommendations.
2. Analyze shiguredo/media-processors public API, source pipeline, browser paths, models/assets, licensing, maintenance, and 2023 contributor-relevant evidence for explicit user review.
3. Compare MediaPipe Tasks Vision, TensorFlow.js Body Segmentation, and LiveKit Track Processors against the same criteria using primary documentation and source.
4. Evaluate browser pipeline categories for acquisition, segmentation, compositing, output handoff, backpressure, cancellation, and cleanup, without accepting a production architecture.
5. Define quality/performance, privacy, delivery/CSP/offline, accessibility, and fallback profiles that can guide empirical validation.
6. Verify all acceptance criteria and repository checks, record findings and approval-gated recommendations in TASK-1.14, then finalize only this task.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Research boundary and authority

Research date: 2026-08-16. This spike consumes accepted decision-1 and doc-1, especially the requirements for first-party local effects, standard media outputs, explicit ownership, optional assets, SSR-safe imports, accessibility, deterministic cleanup, and falsifiable quality hypotheses. TASK-1.2 is the related capability baseline; its dated Chrome 151 and Firefox 153 probes, secure-context and Permissions Policy constraints, worker exposure gaps, and technology-neutral fallback categories were reviewed before this analysis.

This record compares approaches and recommends empirical validation profiles only. It does not select a public API, segmentation model, matting algorithm, worker strategy, acceleration backend, browser support promise, processing order, or dependency. No Backlog Decision was created because the task explicitly forbids accepting an architecture without explicit user approval.

## Comparison-set rationale

The comparison set intentionally covers different boundaries rather than popularity:

- shiguredo/media-processors is mandatory and is the closest end-to-end virtual-background reference, including the user’s 2023 contributor history.
- MediaPipe Tasks Vision is the current official web task/runtime boundary: model loading, TFLite/Wasm execution, GPU delegation, synchronous versus live-stream calls, and worker guidance are explicit.
- TensorFlow.js Body Segmentation is a model-facing library with two runtime families and multiple segmentation semantics; it separates inference and mask conversion from media-track acquisition and output.
- LiveKit Track Processors is an SDK-integrated processor boundary with a first-party background processor, output-track handoff, browser fallback, dynamic switching, and lifecycle behavior.

This set includes open libraries and an SDK-oriented integration while retaining a browser-native baseline from TASK-1.2. A commercial SDK was not selected because its primary implementation, asset licensing, and maintenance evidence are not inspectable enough for a like-for-like source comparison; it remains a future market/requirements comparison if needed.

## Mandatory comparison: shiguredo/media-processors

### Public API and effect behavior

The public package is @shiguredo/virtual-background. The primary API constructs VirtualBackgroundProcessor with an assetsPath, then calls startProcessing(track, options) to obtain a processed MediaStreamVideoTrack. Options include backgroundImage (HTMLImageElement, HTMLVideoElement, HTMLCanvasElement, ImageBitmap, or OffscreenCanvas), blurRadius, segmentationModel (selfie-landscape or selfie-general), and backgroundImageRegion. The package also exposes stopProcessing, isProcessing, original/processed track getters, average FPS, and average processing time. Background image aspect-ratio handling is extensible through cropBackgroundImageCenter, fillBackgroundImage, or a caller callback.

The public surface is intentionally track-oriented and useful for handing the result to a video element or another MediaStream consumer, but it is a stateful single-processor object: startProcessing rejects an already-processing track, and callers must stop the processor and separately decide when to stop the original input track. It is not a React lifecycle contract and does not expose a generic segmentation or compositor plugin interface.

Primary sources:
- https://github.com/shiguredo/media-processors/blob/develop/packages/virtual-background/README.md
- https://github.com/shiguredo/media-processors/blob/develop/packages/virtual-background/src/virtual_background.ts
- https://www.npmjs.com/package/@shiguredo/virtual-background

### Segmentation, compositing, and execution placement

The package pins @mediapipe/selfie_segmentation at 0.1.1675465747. The model is a two-class human/background segmentation model rather than an explicit high-resolution alpha-matting model. The MediaPipe model card documents general input at 256 x 256 and landscape input at 144 x 256, with approximately 249 KB and 244 KB model sizes respectively; the output is a single human mask and may include multiple similar-scale people.

Source pipeline:
1. VideoTrackProcessor acquires frames using the Chromium MediaStreamTrackProcessor/MediaStreamTrackGenerator path when both legacy constructors are available, or an HTMLVideoElement.requestVideoFrameCallback plus HTMLCanvasElement.captureStream path otherwise.
2. The processor converts a VideoFrame to ImageBitmap in the Breakout Box path, closes the input frame, calls MediaPipe Selfie Segmentation, and returns a persistent canvas.
3. A segmentation result callback resizes the canvas and composites the foreground with source-in, then puts either a caller image or the original frame underneath with destination-over. Background blur uses Canvas filter where available; Safari uses a temporary canvas and StackBlur because the source notes Safari filter limitations.
4. The output is a MediaStreamVideoTrack. Frame timing and duration are preserved explicitly in the Breakout Box path when a new VideoFrame is created; the canvas fallback requires separate output timing and latency measurement.

Execution and support posture:
- The repository README says current Chrome or Edge are supported generally and that virtual background/background blur also works on Safari; it explicitly does not promise other browsers.
- The package README describes Chromium Breakout Box and Safari 15.4+ requestVideoFrameCallback. Firefox is not a support promise even if a particular Firefox release happens to expose requestVideoFrameCallback.
- The implementation feature-detects MediaStreamTrackProcessor and MediaStreamTrackGenerator, while the current Media Capture Transform draft standardizes VideoTrackGenerator and has no Window exposure consensus. Name and context detection must therefore be tested rather than copied as a guarantee.
- OffscreenCanvas is used when available; HTMLCanvasElement is the fallback. The Safari fallback is main-thread and canvas-capture based.

### Backpressure, cancellation, cleanup, and extensibility

The Breakout Box route pipes an asynchronous TransformStream into the generator and serializes the callback through the stream transform. It uses an AbortController, closes VideoFrame and ImageBitmap objects on the normal path, cancels the processor readable and aborts the generator writable on pipeline errors, and stops when the output generator is already ended. The current source’s stopProcessing aborts the stream and clears the MediaPipe result callback, but it does not stop the caller-owned original track; empirical tests must verify generated-track termination, segmentation/runtime cleanup, and repeated start/stop behavior.

The requestVideoFrameCallback route pauses the internal video element and cancels its pending callback. It creates an internal MediaStream, canvas, and captured output track; the source does not make ownership of every internal object explicit after stopProcessing. The feasibility spike should test whether clearing srcObject, stopping the captured track, releasing the canvas, and closing model resources are required in each browser to avoid retained media or GPU work.

The package has a reusable internal video-track utility, but video-track-processor is marked private and is not published as a user-facing extension contract. CHANGES.md records support for chaining multiple video processors in 2023.1.0, currently noted as Chrome/Edge-only. The public virtual-background options are useful effect-level extension points, not arbitrary processor injection.

### Assets, licensing, and maintenance

The package accepts an assetsPath and uses MediaPipe locateFile, so the caller can self-host or choose a CDN. The checked-in example defaults to jsDelivr. Asset delivery is therefore part of the API contract: model/Wasm fetches need explicit CSP, CORS, cache, integrity, offline, and versioning tests; production must not rely on an unpinned @latest URL.

The package and repository code are Apache License 2.0. The README separately directs users to the @mediapipe/selfie_segmentation asset licensing for bundled binarypb, TFLite, and Wasm/JS files. The current dependency metadata reports Apache-2.0 for @mediapipe/selfie_segmentation and MIT for stackblur-canvas; notices still need to be preserved when redistributing the complete asset set. MediaPipe Selfie Segmentation’s model card also states Apache License 2.0. These facts reduce license friction but do not replace a release-time dependency and model notice audit.

Maintenance is mixed and must be described accurately: the GitHub repository remains active, with current develop-branch maintenance commits and a current CHANGES entry for virtual-background type-resolution work, but the published @shiguredo/virtual-background version remains 2023.2.0 (npm publication 2023-07-06; registry metadata modified 2025-10-01). The source branch and npm package can therefore differ materially. The project should pin a reviewed source/package version and record browser/model evidence instead of inferring support from repository activity.

Primary maintenance and licensing sources:
- https://github.com/shiguredo/media-processors
- https://github.com/shiguredo/media-processors/blob/develop/CHANGES.md
- https://github.com/shiguredo/media-processors/blob/develop/LICENSE
- https://github.com/shiguredo/media-processors/blob/develop/packages/virtual-background/package.json
- https://storage.googleapis.com/mediapipe-assets/Model%20Card%20MediaPipe%20Selfie%20Segmentation.pdf

### Findings specifically requiring the user’s 2023 experience

CHANGES.md attributes the following 2023 work to @kounoike:
- virtual-background 2023.2.0: reduced CPU-GPU transfers to speed up background blur;
- VideoTrackProcessor instrumentation: added average processing time and frame-rate reporting;
- related image-to-image/video-processor and GPU-path work that exposes the same copy/readback and instrumentation tradeoffs.

CHANGES.md also records the 2023.1.0 extraction of shared Chrome/Edge Breakout Box and Safari requestVideoFrameCallback code into video-track-processor and the addition of multiple processor composition, attributed to other contributors. The implementation now makes those boundaries and the Safari readback path visible enough to form review questions.

These are evidence-backed review points, not an accepted recommendation. The coordinator was asked to explicitly review them with the user: whether the CPU/GPU transfer reduction was primarily about avoiding readback, how the metrics were interpreted under asynchronous segmentation and stale masks, whether processor chaining had lifecycle or timing caveats, and whether the Safari fallback’s canvas ownership/cleanup had known constraints. User confirmation or correction must be appended before this task is treated as satisfying the contributor-review criterion.

## Common comparison matrix

| Target | Public API and pipeline | Execution and browser posture | Extensibility and output | License, assets, maintenance |
| --- | --- | --- | --- | --- |
| MediaPipe Tasks Vision | ImageSegmenter.createFromOptions/createFromModelPath/createFromModelBuffer; IMAGE, VIDEO, LIVE_STREAM modes; category or confidence masks; caller performs compositing and output-track creation | segment and segmentForVideo are synchronous and block the UI thread; official docs recommend a Web Worker for camera use; live-stream resultListener is asynchronous and may drop inputs; GPU delegate and WebGL are configurable | Custom compatible TFLite model, output mask modes, model metadata; no MediaStreamTrack output or built-in backpressure/cleanup around the caller’s frame loop; ImageSegmenter.close is explicit | Web package reports Apache-2.0; model card/asset terms must be tracked separately. Docs call the web solution a preview, use CDN paths for Wasm/models, and state on-device input processing while also reporting API performance/utilization metrics to Google. Active 2026 release stream, but preview/API/asset terms require pinning. |
| TensorFlow.js Body Segmentation | createSegmenter with MediaPipeSelfieSegmentation or BodyPix; MediaPipe runtime or TFJS runtime; segmentPeople returns masks with canvas/ImageData/tensor conversions; toBinaryMask, drawMask, drawBokehEffect, and blurBodyPart assist compositing | Runtime/backend is caller-selected; MediaPipe uses the MediaPipe JS solution, TFJS loads a GraphModel and can use TFJS CPU/WebGL/WebGPU dependencies. No built-in worker or MediaStreamTrack loop; caller owns scheduling and overload policy | Selfie Segmentation returns one prominent-human mask; BodyPix can return multi-person and 24 body parts; BodySegmenter exposes dispose/reset but no cancellation contract or output track | Package code Apache-2.0; models and MediaPipe assets require separate audit. @tensorflow-models/body-segmentation 1.0.2 was published 2023-07-31; repository package updates are older than the current browser baseline, so pin and benchmark. |
| LiveKit Track Processors | BackgroundProcessor modes background-blur, virtual-background, and disabled; attach through local video track setProcessor; switchTo avoids toggle artifacts; custom ProcessorWrapper + Transformer boundary | Modern MediaStreamTrackProcessor/Generator path or canvas.captureStream fallback; BackgroundTransformer requires OffscreenCanvas, VideoFrame, createImageBitmap, and WebGL2, and uses MediaPipe Tasks ImageSegmenter GPU delegate. segmentForVideo is synchronous and source comments measure tens to approximately 100 ms UI blocking; worker offload is called challenging because WebGL textures are not easily posted | ProcessorWrapper accepts custom transformers and outputs a processed MediaStreamTrack, integrated with LiveKit publishing. Source tracks lifecycle states, restart, media exhaustion, and cleanup; fallback has max FPS and latest-frame checks. Browser support checks distinguish any processor support from modern API support; Firefox/Safari support is not guaranteed by the package docs/issues | Apache-2.0 package; @mediapipe/tasks-vision pinned at 0.10.14 in the current package. Latest package line is 0.7.2 (2026-02-25) and recent changes address dynamic mode switching and black-screen flashes, making it a useful lifecycle/artifact reference rather than a drop-in framework core. |

Primary sources for the comparison:
- MediaPipe web guide: https://developers.google.com/edge/mediapipe/solutions/vision/image_segmenter/web_js
- MediaPipe web task source: https://github.com/google-ai-edge/mediapipe/tree/master/mediapipe/tasks/web/vision
- MediaPipe web samples, including worker-based ImageBitmap transfer: https://github.com/google-ai-edge/mediapipe-samples-web/blob/main/src/tasks/image-segmenter.ts
- MediaPipe privacy/licensing/model evidence: https://github.com/google-ai-edge/mediapipe, https://github.com/google-ai-edge/mediapipe/blob/master/LICENSE, https://storage.googleapis.com/mediapipe-assets/Model%20Card%20MediaPipe%20Selfie%20Segmentation.pdf
- TensorFlow body-segmentation API: https://github.com/tensorflow/tfjs-models/tree/master/body-segmentation
- TensorFlow segmenter interface: https://github.com/tensorflow/tfjs-models/blob/master/body-segmentation/src/body_segmenter.ts
- LiveKit processor docs: https://github.com/livekit/track-processors-js/blob/main/processor-docs/video-processors.md
- LiveKit wrapper/source: https://github.com/livekit/track-processors-js/blob/main/src/ProcessorWrapper.ts
- LiveKit background transformer: https://github.com/livekit/track-processors-js/blob/main/src/transformers/BackgroundTransformer.ts

## Candidate pipeline categories

### A. Raw track transform with a generated output track

Capture MediaStreamTrack -> MediaStreamTrackProcessor (prefer maxBufferSize 1/latest-frame semantics where supported) -> VideoFrame/ImageBitmap transfer -> segmentation runtime -> GPU/Wasm/CPU compositor -> VideoTrackGenerator/MediaStreamTrackGenerator -> output MediaStreamTrack.

Strengths: direct track interoperability, fewer canvas copies, explicit frame timestamps, natural WebRTC/MediaRecorder/video handoff, and a standards-aligned worker model. Risks: current draft is a Working Draft; MediaStreamTrackProcessor and VideoTrackGenerator are worker-exposed in the draft with no Window exposure consensus, browser names differ, audio transform consensus is absent, and TASK-1.2 already observed Chrome Window-only legacy names with no tested worker constructors and no Firefox raw-track constructors. Every frame must be closed, dropped-frame counts observed, generator closure propagated, and AbortSignal/cancellation made idempotent. Empirical target: Chrome/Edge first, then exact Firefox/Safari releases if exposed.

### B. Rendered video plus canvas capture fallback

Input track -> internal HTMLVideoElement -> requestVideoFrameCallback (or bounded animation loop) -> Canvas/OffscreenCanvas -> segmentation -> compositing -> HTMLCanvasElement.captureStream -> output track.

Strengths: Safari-compatible path, broad DOM support, easy visual inspection and compositing, and direct output track. Risks: main-thread scheduling, image/frame copies, canvas capture timing, output timestamp differences, hidden-page throttling, and origin-clean/CORS restrictions. A canvas with cross-origin-tainted content cannot be captured; captured tracks can mute when origin cleanliness changes. Stop must cancel callbacks, pause and detach the internal video, stop the captured track, release the canvas and model/runtime, and handle output consumers that stop early. Empirical target: Safari and Firefox fallback plus Chromium as a regression comparator.

### C. Dedicated Worker inference/compositing

Main thread captures VideoFrame/ImageBitmap or a transferable MediaStreamTrackHandle -> worker -> MediaPipe Tasks or TFJS inference -> OffscreenCanvas/WebGL/Wasm compositor -> transferable VideoFrame or main-thread output track/canvas.

Strengths: isolates synchronous ML from the React/main event loop and makes overload/cancellation easier to observe; MediaPipe’s official web guidance and samples support worker execution patterns. Risks: current raw-track worker availability is inconsistent; WebGL textures do not transfer directly; OffscreenCanvas/WebGL lifecycle and worker termination must be measured; SharedArrayBuffer/threaded Wasm may require cross-origin isolation that breaks embeds/OAuth; output-track generation may still need a main-thread bridge. Empirical target: worker ImageBitmap/VideoFrame transfer, OffscreenCanvas compositor, and a no-isolation fallback.

### D. Runtime/model and compositor combinations

Segmentation and compositing are independent experiment axes. Compare MediaPipe Selfie Segmentation, MediaPipe Tasks Image Segmenter, and TFJS Selfie Segmentation/BodyPix; compare CPU/Wasm, WebGL, and WebGPU where the runtime exposes them; compare Canvas 2D, WebGL texture, and (where support permits) WebGPU compositors. Do not compare only aggregate FPS: record model input resolution, mask resolution, copies/readbacks, stale-mask behavior, and visual artifacts. A library API that returns masks (MediaPipe Tasks or TFJS) must be tested separately from the output-track boundary.

### Output, backpressure, cancellation, and ownership invariants

All profiles must exercise HTMLVideoElement, RTCPeerConnection, MediaRecorder, and a second application-owned consumer where practical. Preserve or explicitly document frame timestamps, duration, dimensions, mute/ended, clone, and stop behavior. Define whether the library owns the generated output track, internal streams, canvas/video elements, workers, model runtimes, GPU resources, and asset cache; do not stop application-owned input tracks implicitly.

Use a bounded latest-frame-wins policy or a documented quality-preserving queue; measure input, discarded, processed, output, and stale-mask frames. Abort superseded work, close VideoFrame/ImageBitmap/segmentation-mask resources immediately, close ImageSegmenter/TFJS models, terminate workers, stop generated tracks, and release WebGL/WebGPU resources. A generation token is needed so a late segmentation result cannot overwrite a newer frame after cancellation or effect replacement. A failed effect should preserve the original track or a safe bypass without page reload.

## Evaluation profiles for empirical validation

Use fixed video fixtures and the same output consumer for every candidate. The approved quality contract provides the initial 720p/30 and p95 latency hypotheses; these are hypotheses to measure, not automatic pass/fail claims for every device.

### Resolution and device matrix

- 640 x 480 at 30 fps: low-cost baseline and canvas fallback stress case.
- 1280 x 720 at 30 fps: release-contract target; measure single-subject blur/replacement and combined crop/tracking where applicable.
- 1920 x 1080 at 30 fps: high-resolution stress and downscale-policy case.
- Optional 1280 x 720 at 60 fps: scheduling/backpressure stress, not a first-release guarantee.
- Low, mid, and high desktop tiers with recorded CPU model, core count, RAM, browser build, GPU/driver, power mode, and display scale; include hardware acceleration on and the documented software/headless control.
- Mobile feasibility tier: one recent iOS Safari and one recent Android Chrome device, with thermal and background/foreground transitions. Mobile remains feasibility input under doc-1, not an initial support guarantee.
- Browser rows: exact Chrome, Edge, Firefox, and Safari builds; secure top-level page, iframe with Permissions Policy, worker where applicable, cross-origin isolated and no-isolation fixtures.

### Quality and visual-artifact profile

Corpus slices: diverse skin tones and hair textures, glasses/masks/headwear, clothing close to background color, low light/backlight, motion and rapid turn, partial occlusion, hands/objects crossing the body, multiple people, no-person frames, busy indoor backgrounds, fine hair, and replacement images with aspect-ratio mismatch or alpha.

Metrics and review:
- foreground IoU/precision/recall and boundary F-score against a labeled corpus; use the doc-1 initial IoU >= 0.85 hypothesis only after defining the mask threshold and resolution;
- temporal mask stability/flicker, boundary shimmer/halo/holes, mask lag after motion, subject dropout/reacquisition, color spill, blur seam, background crop/stretch, first-frame flash, and A/V sync;
- blinded human review by corpus slice, not only aggregate score; preserve representative screenshots/clips and threshold/asset versions.

### Performance, startup, and overload profile

Record cold asset transfer, cache-hit transfer, Wasm/model compile and GPU initialization, first useful output, warm start after stop/start, p50/p95 per-frame processing and source-to-output latency, delivered/discarded/output FPS, queue depth, mask age, main-thread long tasks, worker time, CPU by process, JS heap/retained heap, GPU memory/context loss where observable, battery/thermal state on mobile, and ten-minute endurance.

Inject overload by increasing resolution/frame rate, delaying segmentation/compositing, blocking the main thread in a controlled fixture, backgrounding/focusing the page, revoking permissions, ending tracks, and replacing/removing the background asset. Verify bounded memory, latest-frame or documented queue behavior, cancellation of stale work, a deterministic degraded/bypass state, recovery time, and no leaked workers/tracks/contexts after repeated start/stop and effect switching.

## Privacy, delivery, offline, CSP, accessibility, and fallback

- Keep camera frames, masks, detections, and outputs on device by default. MediaPipe Tasks documentation says input processing is on device but also states that API performance/utilization metrics are sent to Google; this must be disclosed, independently verified for the chosen web package/version, or disabled/avoided before satisfying the project’s no-telemetry default.
- Prefer self-hosted, version-pinned Wasm/model assets with explicit integrity and notice handling. Test CDN, packaged, public-path, same-origin, and service-worker/cache-storage delivery under CSP connect-src, script-src, worker-src, child-src, img-src, media-src, CORS, and SRI/integrity policies. Treat remote background images as untrusted assets: validate origin-clean/CORS behavior and failure states.
- Offline is an asset-delivery mode, not an implicit guarantee. Define cache versioning, model/runtime eviction, first-run cold behavior, partial-cache failure, and an explicit “assets unavailable/offline” state. Never hide asset fetch latency inside processing latency.
- Cross-origin isolation may unlock threaded Wasm/shared memory but can break third-party embeds and OAuth. Every worker profile needs a no-isolation result and a documented fallback.
- Expose headless loading-assets, active, bypassed, degraded, unsupported, failed, and cancelled states plus actionable error categories. The reference UI must provide keyboard-operable effect controls, screen-reader announcements for asynchronous loading/failure/degraded transitions, non-color-only status, a visible/announced bypass, and a user control to disable automatic visual changes.
- Fallback priority: original capture track first; then fixed crop or unprocessed framing; then lower resolution/frame rate or reduced effect quality only when explicitly reported; canvas fallback where it meets privacy/latency constraints; blur-only or replacement-only only when segmentation/compositing supports it. A failed image should not strand the track. Do not introduce a cloud-processing fallback because doc-1 accepts local processing and excludes default telemetry.

## Approval-gated empirical recommendation

The following should be benchmarked as alternatives, without treating any as accepted architecture:

1. Chrome/Edge raw track transform using the shiguredo/LiveKit-style processor boundary, a pinned segmentation runtime, and a GPU/Canvas compositor. This tests the lowest-copy output-track route and current Chromium support.
2. Safari/Firefox-compatible requestVideoFrameCallback plus canvas.captureStream using the same input corpus and model where possible. This quantifies the compatibility path’s copies, main-thread cost, timestamps, and cleanup.
3. Dedicated Worker inference/compositing using transferable ImageBitmap/VideoFrame and OffscreenCanvas, with both cross-origin-isolated and no-isolation fixtures. This tests UI responsiveness and whether a worker path can return an interoperable track without unacceptable bridges.
4. MediaPipe Tasks versus TensorFlow.js runtime/model variants on identical frames, with mask quality, input/output conversion, startup, asset size, licensing, and backpressure measured independently from track plumbing.

LiveKit and shiguredo should be retained as black-box/reference fixtures for mode switching, first-frame behavior, chaining, and output handoff. Any promotion of one category to a product architecture, public API, compatibility contract, or dependency requires explicit user approval and a new or superseding Backlog Decision where appropriate.

## Evidence index

Browser and standards:
- https://www.w3.org/TR/mediacapture-transform/
- https://www.w3.org/TR/mediacapture-fromelement/
- https://www.w3.org/TR/webcodecs/
- https://www.w3.org/TR/webaudio-1.1/
- https://www.w3.org/TR/mediacapture-streams/
- https://www.w3.org/TR/secure-contexts/
- https://www.w3.org/TR/permissions-policy-1/
- https://html.spec.whatwg.org/multipage/interaction.html#page-visibility
- https://developer.chrome.com/blog/background_tabs
- https://developer.chrome.com/docs/web-platform/page-lifecycle-api

Reference implementations:
- https://github.com/shiguredo/media-processors
- https://github.com/tensorflow/tfjs-models/tree/master/body-segmentation
- https://github.com/google-ai-edge/mediapipe
- https://github.com/livekit/track-processors-js

Package metadata snapshots gathered via npm CLI on 2026-08-16:
- @shiguredo/virtual-background 2023.2.0, Apache-2.0, npm publication 2023-07-06.
- @mediapipe/tasks-vision 1.0.1, Apache-2.0; unpacked package size reported as 36,831,894 bytes.
- @tensorflow-models/body-segmentation 1.0.2, Apache-2.0, npm publication 2023-07-31.
- @livekit/track-processors 0.7.2, Apache-2.0, npm publication 2026-02-25.

## Validation status

No production source or workflow policy files were changed. The only intended worktree modification is this TASK-1.14 task record written through the Backlog CLI. Acceptance criteria 1–5 are addressed above with primary source URLs and explicit empirical profiles. Criterion 6 remains pending the coordinator’s user-review response for the 2023 contributor-specific findings; no architecture or product decision has been accepted.

Validation and review gate (2026-08-16): pnpm run validate:lifecycle passed; pnpm run backlog:dispatchable passed; git diff --check passed; task view confirmed the research evidence addresses AC1-5. AC6 remains intentionally unchecked: the durable coordinator review request for the 2023 contributor-specific shiguredo findings (message msg_2416cd1218f0) timed out after 600000ms, was resumed as required, then timed out again after 120000ms without a response; escalation msg_9a31b649ce89 was sent. TASK-1.14 remains In Progress, no architecture or product decision was accepted, and the blocker requires explicit user review before finalization.
<!-- SECTION:NOTES:END -->
