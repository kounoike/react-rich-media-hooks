---
id: doc-5
title: Browser Video Processing Feasibility
type: other
created_date: '2026-08-16 18:40'
updated_date: '2026-08-16 18:45'
tags:
  - research
  - video
  - browser
  - feasibility
---
# Browser Video-Processing Feasibility

## Status and authority

Research run: 2026-08-17 JST (the browser result timestamps are 2026-08-16 UTC). This report belongs to TASK-1.4 and consumes the user-approved product and quality contract in decision-1/doc-1 plus the capability, background-processing, and interoperability records from TASK-1.2, TASK-1.14, and TASK-1.17.

This is a feasibility spike, not a production technology selection. The alternatives and recommendations below remain approval-bound. No Backlog Decision was created, and no public API, model, runtime, worker strategy, acceleration backend, browser guarantee, or transform order was accepted.

## Question and evidence boundary

The approved first release must provide local, first-party behavior for arbitrary camera crop, background blur, background image replacement, and single-primary-subject face-driven auto-framing. The quality contract uses a fixed 1280x720/30 input profile for the initial video hypothesis: fixed crop should add at most 50 ms p95; auto-framing plus one background effect should sustain at least 24 fps and add at most 150 ms p95; warm effect initialization after local assets are available should complete within 1 second; and the library must recover from overload and release resources deterministically.

The harness deliberately does not download or select a segmentation or face model. It measures browser media plumbing, crop/compositor cost, frame transfer, scheduling, output handoff, cancellation, and cleanup with deterministic synthetic content. Therefore it can validate pipeline feasibility and expose compatibility risk, but it cannot establish real-model segmentation quality, face-tracking quality, or the product's demographic/environment quality hypothesis.

## Reproducible fixtures and profiles

The disposable harness is [benchmark.js](../../../../experiments/video-feasibility/benchmark.js) with a minimal page in [index.html](../../../../experiments/video-feasibility/index.html). It uses a 1280x720 synthetic source at 30 fps and a 320x180 quality fixture. The scene includes:

- a moving foreground subject with high-contrast boundary and hair-like strokes;
- motion and a changing crop window for auto-framing/crop behavior;
- a partial occlusion stripe;
- changing exposure and a low-light variant; and
- a deterministic replacement background plus original-frame fallback.

The page modes are `capabilities`, `quality`, `canvas-crop`, `canvas-blur`, `canvas-replacement`, `canvas-overload`, `worker-transfer`, `worker-overload`, `raw-track`, and `raw-overload`. Canvas and worker output tracks are attached to a muted video element. The raw path uses whichever Window generator name the browser exposes (`VideoTrackGenerator` or the legacy `MediaStreamTrackGenerator`). A short optional interoperability run (`interop=1`) creates a `MediaRecorder` and adds the output to an `RTCPeerConnection`.

The Chrome runs used `google-chrome --headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage --dump-dom --virtual-time-budget=...` against a secure loopback server. Firefox was driven with geckodriver 0.37.0 and the WebDriver session; its timing runs used real wall-clock timers. Chrome was Google Chrome 151.0.7922.137; Firefox was Mozilla Firefox 153.0.4. Both ran on Linux/WSL2 headless software rendering. The page sent no COOP/COEP headers (`crossOriginIsolated=false`). No camera, model, network media upload, persistence, or telemetry was used.

Metrics are defined as follows:

- startup is the measured time from pipeline start to the first processed frame;
- throughput is processed frames divided by the effective measurement window;
- output frame callbacks and `getVideoPlaybackQuality()` expose output delivery and dropped-frame signals;
- input gaps come from source frame indices or raw-frame timestamps;
- p95 end-to-end latency is the output `requestVideoFrameCallback` time minus the most recent transform completion;
- worker transfer is the send-to-main-thread-result interval, including the ImageBitmap round trip;
- Chrome page heap uses `performance.memory.usedJSHeapSize` where present; Firefox has no equivalent signal in this run;
- `/usr/bin/time -v` records a coarse Chrome launcher-process CPU/RSS signal, not child-process or model-isolated attribution; and
- cleanup checks that owned tracks are `ended`, the video is detached, workers are terminated, pending worker frames are zero, and raw pipes settle after abort.

The Chrome virtual-time run is useful for repeatable frame counts and output behavior, but its page wall-clock values are not a substitute for real-device profiling: some synchronous work is not reflected in `performance.now()` under virtual time. Host CPU/RSS and Firefox real-time measurements are retained as corroborating signals, not release claims.

## Capability matrix

| Browser/context | Observed capability result | Feasibility implication |
| --- | --- | --- |
| Chrome 151.0.7922.137, Window | `MediaStreamTrackProcessor=function`, legacy `MediaStreamTrackGenerator=function`, `VideoTrackGenerator=undefined`; `VideoFrame`, `VideoEncoder`, `VideoDecoder`, `OffscreenCanvas`, canvas capture, WebGL2, WebGPU interface, `MediaRecorder`, and `RTCPeerConnection` present | Raw track path is available under a legacy constructor name in this exact Window context. Constructor presence alone is insufficient: the raw run still showed output drops and must be feature-tested operationally. |
| Chrome 151.0.7922.137, DedicatedWorker | All three tested raw-track transform constructors were `undefined`; `VideoFrame`, `VideoEncoder`, and `OffscreenCanvas` were functions | Do not infer worker raw-track support from Window support. A worker pipeline needs an explicit transfer/canvas strategy or a different browser capability. |
| Firefox 153.0.4, Window | Raw-track processor/generator constructors all `undefined`; `VideoFrame`, `VideoEncoder`, `VideoDecoder`, `OffscreenCanvas`, canvas capture, WebGL2, `MediaRecorder`, and `RTCPeerConnection` present; WebGPU interface and `performance.memory` unavailable | Rendered-output and ImageBitmap worker categories remain viable fallbacks. Raw-track transform is unsupported in this exact Window run. |
| Firefox 153.0.4, DedicatedWorker | Raw-track constructors all `undefined`; `VideoFrame`, `VideoEncoder`, and `OffscreenCanvas` present | Worker raw-track path is also unsupported in this exact run. |
| Edge desktop | Not installed in the worktree | Unknown; Chromium-family similarity is not evidence. Repeat the same Window/Worker/codec probes on the supported Edge release. |
| Safari/WebKit desktop and iOS | No Safari runner in the worktree | Unknown; repeat on exact macOS/iOS builds, including canvas capture, `requestVideoFrameCallback`, WebCodecs, and effect cleanup. |
| Android Chrome and other mobile devices | No physical device was available | Unknown and outside the initial support guarantee. Thermal throttling, backgrounding, memory pressure, permission transitions, and camera characteristics need real-device runs. |

All runs were secure loopback (`isSecureContext=true`) and non-isolated (`crossOriginIsolated=false`). A production model/runtime may add CSP, CORS, asset integrity, Permissions Policy, or cross-origin-isolation requirements that this synthetic probe does not cover.

## Processing measurements

The table reports the most representative short runs. Chrome rows used a 1280x720/30 source and a nominal 300 ms warmup plus 1.5 s measurement; the harness emits a longer effective window because of virtual-time scheduling and cleanup grace. Firefox rows used the same nominal profile and real timers. CPU/RSS values are the coarse `/usr/bin/time -v` signal for the Chrome launcher process. `+heap` is the page JS-heap delta where available.

| Browser/path | Startup | Effective fps | Frame/drop signal | p95 latency | Transfer p95 | +heap | Coarse CPU/RSS | Overload/cleanup |
| --- | ---: | ---: | --- | ---: | ---: | ---: | --- | --- |
| Chrome canvas main replacement | 500.4 ms (video-start guard) | 27.4 | 96 total output frames, 9 dropped; no input gaps | 65.9 ms | — | +0.31 MiB | 0.79 user + 1.00 system s; 233,268 KiB | Tracks ended and video detached; baseline path stayed live |
| Chrome canvas main crop | 500.4 ms (video-start guard) | 25.2 | 50 total output frames, 25 dropped; no input gaps | 26.4 ms | — | +0.14 MiB | not retained | Tracks ended and video detached |
| Chrome canvas main blur | 500.4 ms (video-start guard) | 25.2 | 48 total output frames, 1 dropped; no input gaps | 135.2 ms | — | +0.20 MiB | not retained | Tracks ended and video detached |
| Chrome canvas main, synthetic overload dial 55 | 500.5 ms | 26.0 | 58 total output frames, 1 dropped; no input gaps | page p95 not reliable under virtual time | — | +0.24 MiB | 1.05 user + 1.33 system s; 233,284 KiB | Scheduler remained live; boundedness is not guaranteed by this main-thread loop |
| Chrome ImageBitmap worker transfer | 502.1 ms | 12.8 | 32 total output frames, 6 dropped; 26 input/backpressure drops | 118.8 ms | 33.1 ms | +0.16 MiB | 0.62 user + 0.61 system s; 224,080 KiB | Single in-flight frame and pending count returned to zero; worker terminated |
| Chrome ImageBitmap worker, synthetic overload dial 55 | 502.2 ms | 4.3 | 11/11 output frames; 44 input/backpressure drops | 283.4 ms | 198.1 ms | +0.14 MiB | 0.58 user + 0.57 system s; 225,860 KiB | Latest-frame queue remained bounded and cancellation completed |
| Chrome raw track + legacy generator | 9.8 ms | 27.1 | 63 total output frames, 16 dropped; no input gaps | 110.1 ms | 1 ms queue signal | +0.27 MiB | 0.64 user + 0.93 system s; 225,120 KiB | Abort settled with `AbortError`; input/output tracks ended |
| Chrome raw track, synthetic overload dial 55 | 26.6 ms | 26.0 | 62 total output frames; no input gaps or output drops in this short run | 226.9 ms | 1 ms queue signal | +0.28 MiB | 0.74 user + 1.20 system s; 234,356 KiB | Abort settled; tracks ended; page timing does not measure the finite overload loop reliably under virtual time |
| Firefox canvas main replacement | 501 ms | 25.7 | 44 output callbacks; no input or output drop signal exposed | 126.7 ms | — | unavailable | Not collected in this WebDriver run | Tracks ended and video detached |
| Firefox ImageBitmap worker transfer | 501 ms | 24.6 | 33 output callbacks; no input or output drop signal exposed | 98.9 ms | 14.5 ms | unavailable | Not collected in this WebDriver run | Single in-flight queue bounded; worker terminated |
| Firefox raw track | unsupported | — | `MediaStreamTrackProcessor`, `VideoTrackGenerator`, and legacy generator all undefined | — | — | — | — | Returned an explicit unsupported result |

The portable canvas path met or approached the 24 fps hypothesis in these software-headless synthetic runs, but Chrome output delivery still dropped frames and Firefox p95 was close enough to the 150 ms composed-effect budget that model inference and real hardware could change the result. The worker path shows why off-main-thread placement is not automatically cheaper: Chrome lost throughput to the ImageBitmap round trip in this setup, while Firefox reached 24.6 fps with a measurable 14.5 ms p95 transfer cost. The raw path is fast enough for a Chromium-specific optimization candidate but not a cross-browser baseline.

The optional Chrome interoperability smoke run created a `MediaRecorder` and one data chunk (0 bytes in the short virtual-time window) and successfully added the output track to an `RTCPeerConnection` sender (`sender.track.kind=video`). This establishes object handoff, not recorder quality; a real-time run with encoded bytes and cross-browser sender/recorder replacement remains required.

## Reproducible visual quality comparison

The quality mode renders a known oracle mask and compares candidate masks/composites against the oracle. It intentionally simulates boundary erosion, a five-frame motion lag, an occlusion error, low-light erosion, and an original-frame fallback. Chrome and Firefox scores were materially the same; the range below shows Chrome/Firefox values where they differed.

| Scenario | Mask IoU (Chrome/Firefox) | Candidate MAE (Chrome/Firefox) | Candidate PSNR dB (Chrome/Firefox) | Interpretation |
| --- | ---: | ---: | ---: | --- |
| Boundary erosion | 0.8106 / 0.8109 | 1.0650 / 1.0603 | 29.005 / 29.028 | Boundary errors are visible even when global error stays low. |
| Five-frame motion lag | 0.9258 / 0.9255 | 0.5874 / 0.5857 | 31.327 / 31.361 | Temporal stale-mask errors are measurable and should be tested separately from static IoU. |
| Occlusion | 0.4300 / 0.4440 | 10.5207 / 10.4539 | 16.172 / 16.213 | Occlusion is the hardest synthetic case and needs explicit loss/reacquisition behavior. |
| Low light | 0.8106 / 0.8109 | 0.9180 / 0.9149 | 31.171 / 31.187 | Exposure changes can reproduce a boundary-style mask degradation. |
| Original-frame fallback | 1.0000 / 1.0000 | 34.1777 / 34.1858 | 15.418 / 15.417 | Bypass preserves continuity but has a large effect/privacy gap; it is not a model-quality failure. |

The original-frame baseline MAE is the error between an unprocessed source and the oracle replacement. The oracle itself is not reported as a candidate because it is the reference. These measurements prove the comparison is repeatable across the two engines; they do not support a segmentation or face-tracking quality claim. A release-quality corpus must use approved real or synthetic-labeled scenes spanning skin tones, hair, clothing, boundary detail, motion, occlusion, lighting, multiple faces, profile views, glasses/masks, and no-face periods.

## Backpressure, cancellation, cleanup, and output implications

- Main-thread canvas rendering is broadly available and can produce a standard `MediaStreamTrack`, but it shares scheduling with React/application work. The synthetic overload run stayed live while the source timer itself did not report gaps; a production loop still needs an explicit latest-frame policy, frame-budget telemetry, cancellation, and a degraded/bypass state.
- ImageBitmap worker transfer demonstrated a bounded one-frame queue, explicit transfer costs, and cancellation. It avoided a growing queue, but dropped input frames under both normal Chrome transfer cost and deliberate overload. Worker support for `OffscreenCanvas` is present in both tested engines; raw-track transform objects are not present in the tested workers.
- Chromium's legacy raw-track path preserved timestamps and delivered standard generated tracks, but dropped output frames under a short software-headless run. The path must close every input `VideoFrame`, stop/abort the generated output, and distinguish `MediaStreamTrackGenerator` from the current `VideoTrackGenerator` name. Firefox requires a different fallback in this matrix.
- All tested canvas/worker/raw outputs could be attached to a video element, and the Chrome smoke run produced a sender track and a constructible recorder. The zero-byte short recorder result means encoding and replacement behavior are not yet validated.
- Every benchmark stopped its source and output tracks, detached the video, terminated the worker, closed transferred `ImageBitmap`s, and aborted the raw stream. The raw pipe settled with `AbortError` as expected. This is a harness invariant, not yet a React Strict Mode or five-cycle leak result.

## Browser/device limits, fallback, privacy, and security

The exact local evidence supports the following capability categories, without accepting one as the production architecture:

1. Rendered-output canvas/media-element capture is the broadest fallback category. It works in both tested engines, is standard-track interoperable, and carries main-thread copy/latency costs.
2. ImageBitmap/OffscreenCanvas worker processing is a possible off-main category. It requires bounded queues and measured transfer budgets; it does not imply raw-track worker support.
3. Raw track processor/generator is an optional fast path where exact constructors and operational frame delivery are verified. It is not available in Firefox 153.0.4 or either tested worker context.
4. When an effect is unsupported, loading, overloaded, or failed, the application needs an explicit bypass/degraded/fixed-crop policy. The original-frame fallback preserves continuity but exposes unprocessed content, as the quality table demonstrates.

Edge, Safari, iOS Safari, Android Chrome, real camera profiles, GPU acceleration, thermal behavior, background-tab lifecycle, and memory pressure are unknown from this run. The Chrome process used `--disable-gpu`; WebGL2 and WebGPU interface presence therefore do not establish hardware acceleration. Model/runtime assets were not fetched, so cold-download, CSP/CORS, integrity, offline, cache, license, and cross-origin-isolation behavior remain open. The synthetic run stayed local, did not request permission, transmitted no media, persisted no frames, and emitted no telemetry; first-party model delivery and face-tracking data-flow reviews are still required.

## Feasibility conclusion and approval-bound alternatives

The evidence supports continuing feasibility work with a portable rendered-output fallback and keeping raw-track and worker paths as measured optimizations, subject to model-integrated benchmarks. The evidence does not support a release-wide browser promise or a final execution-placement choice.

Alternatives for explicit user review:

1. **Portable canvas baseline plus optional raw-track fast path.** Maximizes standard output interoperability and gives Firefox/Safari a fallback; pays main-thread copy and latency costs, while Chromium can avoid some copies when its exact raw path passes operational checks.
2. **Worker-first ImageBitmap pipeline.** Reduces main-thread work and offers bounded cancellation, but transfer cost and queue drops are browser-dependent. The current Chrome result misses the 24 fps hypothesis; Firefox just reaches it in this synthetic no-model path.
3. **Raw-track-first pipeline.** Gives direct timestamped output in the tested Chrome Window path and low startup, but has constructor-name/context fragmentation and no tested Firefox/worker support. It would require a mandatory rendered-output fallback.
4. **Defer effect-quality support claims until model integration.** Keeps the current result honest: the browser plumbing is feasible, but segmentation and face-tracking quality, model startup, asset size, and composed-effect performance are still unknown. This may require additional spike time and reference-device runs despite the approved later initial release tradeoff.

These are recommendations and tradeoffs only. The user retains final authority over the significant product, compatibility, public API, and architecture choice. No option was recorded as accepted in Backlog Decisions.

## Acceptance-criteria evidence map

| Criterion | Evidence |
| --- | --- |
| #1 Representative transformations, scenes, and profiles | Product-contract mapping above; 1280x720/30 crop, replacement/blur-style compositor, moving subject, boundary, motion, occlusion, low-light, auto-frame crop geometry, and fallback fixtures in the harness. |
| #2 Latency, throughput, drops, CPU/memory, startup, overload recovery | Capability and processing tables; Chrome page heap plus launcher CPU/RSS signals; Firefox real-time timing; canvas/worker/raw overload runs and bounded queue/abort results. |
| #3 Reproducible visual quality against baselines | Quality mode and table compare oracle replacement, original-frame baseline, boundary, motion-lag, occlusion, low-light, and fallback scenarios. Model-quality limitation is explicit. |
| #4 Main/off-main, transfer, backpressure, cancellation, cleanup, interoperability | Canvas main, ImageBitmap worker, and raw-track paths; transfer and drop columns; bounded worker queue; raw abort; ended tracks/video detachment; MediaRecorder and RTCPeerConnection smoke handoff. |
| #5 Browser/device limits, fallback, privacy/security | Dated Chrome/Firefox Window/Worker matrix; Edge/Safari/mobile unknowns; secure/non-isolated context; canvas/raw/worker fallback categories; local-only synthetic privacy boundary and unresolved model asset/security constraints. |
| #6 Conclusion, alternatives, evidence, tradeoffs, and decision authority | Conclusion and alternatives above are presented as approval-bound recommendations; no significant decision was accepted or created. |

## Primary-source and repository context

- Accepted product and quality contract: decision-1 and doc-1.
- Capability and browser-risk baseline: TASK-1.2.
- Background-processing and model/asset comparison: TASK-1.14.
- Output interoperability and ownership baseline: TASK-1.17/doc-3.
- Browser standards carried by those records: W3C Media Capture and Streams, Media Capture Transform, Media Capture from DOM Elements, WebCodecs, WebRTC, MediaStream Recording, Web Audio, and WHATWG Page Visibility/Lifecycle.
- The harness intentionally does not select or redistribute a model, runtime, or third-party dependency.
