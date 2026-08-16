---
id: TASK-1.15
title: Analyze browser noise-reduction approaches
status: Done
assignee:
  - '@kounoike'
created_date: '2026-08-13 21:02'
updated_date: '2026-08-16 10:39'
labels: []
dependencies:
  - TASK-1.1
  - TASK-1.2
references:
  - 'https://github.com/shiguredo/media-processors'
parent_task_id: TASK-1
priority: high
type: spike
ordinal: 6000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Determine feasible approaches for suppressing background noise and improving captured speech in browser real-time audio. Compare browser-provided capture processing with custom processing and representative existing implementations, including shiguredo/media-processors, before recommending what should be validated. Do not implement production code or accept an architecture in this task.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Browser-provided noise suppression, echo cancellation, automatic gain control, and related constraint behavior are documented across target browsers, including capability detection and interactions
- [x] #2 shiguredo/media-processors is analyzed as a mandatory comparison target for its noise-suppression API, processing model, integration boundary, runtime needs, browser coverage, asset delivery, licensing, and maintenance characteristics
- [x] #3 Other representative libraries and SDKs are compared against the same criteria, with the selection rationale and primary sources documented
- [x] #4 Candidate custom-processing categories are evaluated for latency, buffering, sample rates, channel layouts, speech quality, noise attenuation, artifacts, CPU, memory, startup cost, overload behavior, and cleanup
- [x] #5 A repeatable evaluation corpus and objective plus listening-based comparison method are proposed, with privacy, offline, content-security, and fallback constraints documented
- [x] #6 Alternatives and tradeoffs are presented to the user, and no significant product or architecture decision is treated as accepted without explicit user approval
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Search existing Backlog decisions, documents, related tasks, and repository audio/media conventions before selecting comparison scope.
2. Collect dated primary or reproducible evidence for browser capture constraints, shiguredo/media-processors, and representative open/commercial processing options.
3. Synthesize a criteria-aligned comparison covering capture behavior, processing models, runtime/integration/licensing/maintenance tradeoffs, custom-processing categories, and evaluation methodology without accepting a product or architecture decision.
4. Record evidence, alternatives, tradeoffs, and validation recommendations in TASK-1.15 through Backlog CLI; run repository-appropriate read-only checks and git diff validation.
5. Read task-finalization, verify every acceptance criterion objectively, and mark only TASK-1.15 Done with a final summary.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Research findings: scope, browser capture, and reproducible evidence (2026-08-16)

This is a research record only. It does not select a production algorithm, public API, runtime, worker strategy, acceleration backend, or transform order. It follows the accepted product and quality contract in decision-1/doc-1: local on-device processing, no media transmission or persistence by default, first-party voice noise reduction, modern evergreen desktop browsers as the initial target, mobile as feasibility-only, and fallback to the original audio track on failure.

### Browser capture contract

The W3C Media Capture and Streams specification (accessed 2026-08-16) defines the browser-provided capture controls but does not define one uniform algorithm or quality level:

- The relevant audio constraints are sampleRate, sampleSize, channelCount, latency, echoCancellation, autoGainControl, and noiseSuppression. getSupportedConstraints() reports constraint names recognized by the user agent; it is a capability-detection hint, not proof that a requested mode is supported or that quality is good. getCapabilities() reports source ranges or lists, while getSettings() reports the selected target settings, not measured attenuation or intelligibility.
- Boolean capture controls are requestable as true or false. The user agent may choose the implementation. echoCancellation also supports all and remote-only modes in the current specification: all removes all system audio for privacy, while remote-only removes incoming WebRTC audio but permits local accompaniment. A true request does not guarantee identical behavior across user agents or devices.
- ideal is a preference. exact, min, and max can reject the request with OverconstrainedError. Unknown constraint names can be discarded by WebIDL, so a required unknown property is not a reliable feature test. Permission, policy, device, and lifecycle failures also need explicit handling, including NotAllowedError and NotReadableError.
- Constraint evaluation occurs before and after permission. A device may become unsuitable after permission. Multiple tracks can share a source, and applying a source constraint can affect all tracks from that source; this makes per-track experiments and baseline isolation important.
- Tracks can mute or end when input is interrupted, permission is revoked, or a device is removed. Capture resources are costly and privacy-sensitive, so the app must stop tracks during teardown. A source track is the browser-processed capture boundary; custom processing occurs after this boundary and can therefore receive already processed audio.

Primary source: https://www.w3.org/TR/mediacapture-streams/

### Browser-specific and local reproducible evidence

The TASK-1.2 local capability probe was refreshed on 2026-08-16 and is the reproducible evidence for this worktree. It used secure loopback http://127.0.0.1:8765/ and headless Linux browsers:

- Chrome 151.0.7922.137 exposed getUserMedia, AudioContext, AudioWorklet, AudioData, AudioEncoder, and AudioDecoder. Window exposed the legacy raw video MediaStreamTrackProcessor and MediaStreamTrackGenerator constructors; no tested transform constructors were exposed in a DedicatedWorker. The probe did not have a real microphone or measure suppression quality, so constructor presence is not a performance or quality claim.
- Firefox 153.0.3 in the TASK-1.2 record exposed capture, AudioContext, AudioWorklet, AudioData, AudioEncoder, and AudioDecoder, but no raw track processor or generator constructors in Window or Worker. Firefox capability and constraint behavior is supported by the current Mozilla test source, which checks autoGainControl, echoCancellation, and noiseSuppression support and exercises true/false combinations with a loopback test device: https://searchfox.org/firefox-main/source/dom/media/webrtc/tests/mochitests/test_getUserMedia_audioConstraints.html
- Current Firefox media source shows browser-specific coupling: the WebRTC audio engine derives AGC and noise suppression settings with echo cancellation as a gate, and clamps channel count to device limits. This is source-level evidence for interaction risk, not a guarantee for every Firefox release: https://searchfox.org/firefox-main/source/dom/media/webrtc/MediaEngineWebRTCAudio.cpp
- Chromium WebRTC VoiceEngine maps echo cancellation, automatic gain control, and noise suppression options to its AudioProcessing configuration, and can select built-in AEC/AGC paths when available rather than a single guaranteed software implementation. This supports measuring both requested and actual behavior on each target: https://webrtc.googlesource.com/src/+/753b02bc45155b1c7418bab5732b73c44e6edded/media/engine/webrtc_voice_engine.cc
- Edge is Chromium-based but was not locally verified in this worktree. Safari and Safari iOS were not locally verified because no macOS or iOS runner is available. WebKit release notes show release-sensitive behavior: Safari 26.4 documents multiple-microphone capture with intelligent echo cancellation management and a fix where disabling echo cancellation could affect existing tracks: https://webkit.org/blog/17862/webkit-features-for-safari-26-4/
- The support posture is therefore: built-in capture constraints are the cross-browser baseline to test; Web Audio and AudioWorklet are the broad custom-processing candidate; raw audio track transforms are an opt-in Chromium experiment until exact browser versions prove otherwise. The accepted target contract does not promise mobile, so real-device routing, interruption, thermal, and background behavior remain required feasibility checks rather than compatibility claims.

### Capture-constraint interaction matrix

| Control or condition | What can be requested | Main interaction or unknown | Required validation |
| --- | --- | --- | --- |
| echoCancellation | false, true, all, remote-only where implemented | AEC can alter speech and music; all versus remote-only changes playback privacy; Firefox source shows AGC/NS coupling | Run capture-only and custom baselines with each supported mode; inspect getSettings and listen for artifacts |
| noiseSuppression | false or true | Browser algorithm, aggressiveness, and artifacts are user-agent/device dependent; custom NS after browser NS can double-process | Compare browser NS on/off against one custom path; report attenuation, intelligibility, and residual artifacts |
| autoGainControl | false or true | Level pumping/clipping and coupling with AEC/NS vary by browser/device | Normalize input level and measure level variance, clipping, SNR, and speech quality |
| sampleRate/sampleSize/channelCount | ideal or exact/min/max requests | Requested values may be ignored or reject; algorithm assumptions may be 48 kHz mono while capture is 44.1/48 kHz and 1/2 channels | Record getSettings; explicitly test conversion, mono downmix, stereo rejection, and timestamp continuity |
| latency and lifecycle | preference plus track mute/ended and context suspension | Background/frozen documents, interruptions, device changes, suspended AudioContext, and queue pressure can create gaps | Measure p50/p95 latency, drops, underruns, recovery, and deterministic cleanup over repeated start/stop |
| capability and permission | getSupportedConstraints, getCapabilities, getSettings, errors | API exposure is not sufficient; policy, permission, device, and exact constraint failure have different outcomes | Gate on actual construction/configuration; preserve original track and expose degraded state on failure |

The W3C source for the track-transform boundary is https://www.w3.org/TR/mediacapture-transform/ (accessed 2026-08-16). The current specification is based on WebCodecs and Streams, exposes MediaStreamTrackProcessor in DedicatedWorker, has no Working Group consensus for Window exposure or audio use, and specifies a video-only VideoTrackGenerator. Its bounded queue can drop frames when full or under UA resource pressure, and applications must keep reads pending and close AudioData or VideoFrame promptly. This makes the legacy Window audio transform used by shiguredo a browser-specific path, not a general cross-browser audio contract.

The Web Audio API provides the more portable custom boundary: AudioWorkletNode runs a processor in the audio rendering path and MediaStreamAudioDestinationNode returns a MediaStream for an audio element, recorder, or peer connection. Destination channel configuration must be explicit, especially for mono denoisers. AudioContext suspend and close release or stop rendering resources, so cleanup must disconnect nodes, stop source and destination tracks, terminate workers, and close the context: https://www.w3.org/TR/webaudio-1.1/ (accessed 2026-08-16). WebCodecs AudioData is exposed in Window and DedicatedWorker and has explicit format, sample rate, channel, timestamp, transfer, and close semantics, but it does not by itself provide a cross-browser capture-to-audio-transform bridge: https://www.w3.org/TR/webcodecs/ (accessed 2026-08-16).

### Mandatory comparison: shiguredo/media-processors

The mandatory target was inspected from the repository and package sources on 2026-08-16:

- Project overview and support posture: https://github.com/shiguredo/media-processors
- Noise suppression package and API: https://github.com/shiguredo/media-processors/tree/develop/packages/noise-suppression
- Package source: https://github.com/shiguredo/media-processors/blob/develop/packages/noise-suppression/src/noise_suppression.ts
- Package metadata: https://raw.githubusercontent.com/shiguredo/media-processors/develop/packages/noise-suppression/package.json
- Release history: https://github.com/shiguredo/media-processors/releases
- RNNoise WASM dependency: https://github.com/shiguredo/rnnoise-wasm
- RNNoise upstream: https://github.com/xiph/rnnoise

The project README describes browser media processing for virtual background, background blur, noise suppression, and MP4. It states latest Chrome and Edge as the general support posture, with Safari support for virtual background and blur, and provides client-only samples. It is Apache-2.0 licensed. Support is intentionally limited to Japanese Discord discussion and the project does not promise support or accept uncoordinated issue/PR work, so maintenance and escalation risk must be treated as a product integration concern rather than inferred from repository activity.

The package is @shiguredo/noise-suppression, version 2025.1.0 in the inspected package metadata. The documented API constructs NoiseSuppressionProcessor, calls startProcessing(track) to obtain a processed MediaStreamTrack asynchronously, and calls stopProcessing(). The README recommends getUserMedia preferences of sampleRate ideal 48000, sampleSize ideal 480, and channelCount exact 1, then places the processed track in a new MediaStream. These are algorithm-friendly preferences, not guarantees that capture will satisfy them.

The source implementation is a raw MediaStreamTrack Insertable Streams or Breakout Box pipeline:

- static isSupported checks global MediaStreamTrackProcessor and MediaStreamTrackGenerator.
- startProcessing lazily awaits Rnnoise.load(), constructs a DenoiseState, reads the input with MediaStreamTrackProcessor, and writes a generated audio track through a TransformStream to MediaStreamTrackGenerator.
- The transform accumulates AudioData until RNNoise frames of 480 samples at 48 kHz, requires f32-planar format and mono input, converts floating point samples to the 16-bit scale expected by RNNoise, calls processFrame, converts back, emits AudioData with the source sample rate and timestamp, and closes consumed AudioData.
- Processing is therefore tied to the 48 kHz, 480-sample, mono contract. Sample-rate conversion, channel selection, format conversion, timestamp continuity, partial-frame flush behavior, and output cadence must be measured rather than assumed.
- stopProcessing aborts the processing streams and destroys the denoise state but intentionally does not stop the original input track; the caller owns the original track. Stream error handling logs and cancels the pipeline, so the integration layer needs an explicit health/fallback policy instead of assuming all failures reject startProcessing.
- Release metadata for noise-suppression-2025.1.0 records removal of modelPath and assetsPath, an rnnoise-wasm update to 2025.1.5, and a Vite build migration. Asset loading and bundler behavior must therefore be inspected from the current built package and tested under the library CSP; do not rely on old examples that configure modelPath or assetsPath.

Criteria comparison for this target:

| Criterion | shiguredo/media-processors finding | Risk or validation |
| --- | --- | --- |
| API and integration boundary | Promise-based original track to processed track; output can be used in MediaStream, WebRTC, or media element | Simple downstream integration, but raw audio track transform is not the Web Audio graph boundary |
| Processing model | AudioData frames through Processor, TransformStream, and Generator; RNNoise state per processor | Queue drops, cancellation, frame assembly, and close discipline affect real-time behavior |
| Browser coverage | README states latest Chrome and Edge for general media processing; current W3C transform spec has no consensus for audio or Window exposure; local Chrome 151 exposed legacy Window constructors while Firefox did not | Chromium-only proof burden; exact Edge versions and feature policies still need testing |
| Runtime needs | ESM JavaScript, WASM RNNoise dependency, asynchronous first-load, browser raw-track transform APIs | Bundler, module, worker, CSP, WASM, and offline cache requirements need an app-host experiment |
| Asset delivery | Current package removed configurable modelPath/assetsPath; Rnnoise.load loads the WASM dependency path | Measure emitted JS/WASM size and startup fetch/cache behavior; pin package and asset hashes |
| Audio assumptions | Mono, f32-planar, 48 kHz, 480-sample frames; recommended input constraints use exact mono and ideal rate/size | Rejection or resampling is possible; test 44.1 kHz, stereo, device changes, and constrained devices |
| Licensing | Apache-2.0 for media-processors and rnnoise-wasm wrapper; generated RNNoise WASM points to upstream RNNoise COPYING | Keep notices and verify the exact distribution tree before adoption |
| Maintenance | Versioned package and release history, but support/escalation is Discord-centered and browser support is narrow | Pin and periodically re-evaluate; do not assume upstream support SLA |

Upstream RNNoise is a recurrent neural-network noise suppressor whose reference command line takes raw 16-bit mono PCM at 48 kHz; the upstream README references Valin 2018 and BSD-3-Clause licensing: https://raw.githubusercontent.com/xiph/rnnoise/main/README. The shiguredo wrapper provides browser WASM lifecycle and frame conversion but does not remove the underlying 48 kHz mono and model-startup constraints.

Conclusion for the mandatory comparison: shiguredo is a useful Chromium raw-track reference and a concrete RNNoise integration, not sufficient evidence for a cross-browser architecture. It should be benchmarked on Chromium with built-in capture processing explicitly on and off, and compared with a Web Audio candidate; no adoption decision is accepted by this task.

### Other representative libraries and SDKs

Selection rationale: one open Web Audio package exposes several algorithm families under one integration boundary, one official commercial SDK publishes runtime and operational measurements, and upstream RNNoise supplies an algorithm reference. This avoids treating one implementation as representative of the whole custom-processing space. The sources do not provide one shared corpus or directly comparable quality scores, so superiority is unknown until the proposed evaluation is run.

#### Open Web Audio and WASM comparison: web-noise-suppressor

Source and README: https://github.com/sapphi-red/web-noise-suppressor and https://raw.githubusercontent.com/sapphi-red/web-noise-suppressor/main/README.md
Package metadata: https://github.com/sapphi-red/web-noise-suppressor/blob/main/package.json

The package is MIT licensed, ships ESM/CJS/types, and provides AudioWorklet nodes for NoiseGate, Xiph RNNoise through shiguredo/rnnoise-wasm, SpeexDSP preprocess, and GTCRN. The README shows adding a worklet module to AudioContext, loading a WASM binary URL as an app asset, connecting MediaStreamAudioSourceNode to the selected processor, and routing to a MediaStreamAudioDestinationNode. It therefore represents a graph-based custom path with explicit worklet and WASM asset delivery rather than a raw track transform.

Tradeoffs: the shared AudioWorklet boundary is a strong cross-browser candidate where AudioWorklet is available, and the gate/Speex/RNNoise/GTCRN choices permit algorithm-family experiments. The README and metadata do not publish a browser matrix, noise attenuation corpus, latency percentiles, CPU budget, or maintenance SLA; those are empirical unknowns. The package and all WASM variants still require channel/sample-rate conversion, strict CSP and offline asset tests, worklet error handling, and resource cleanup.

#### Commercial SDK comparison: Krisp Web Browser SDK

Primary documentation: https://sdk-docs.krisp.ai/docs/introduction
Integration guide: https://sdk-docs.krisp.ai/docs/getting-started-js
API reference: https://sdk-docs.krisp.ai/docs/api-reference
Platform support: https://sdk-docs.krisp.ai/docs/supported-platforms
All pages accessed 2026-08-16.

The vendor describes JavaScript/WASM noise cancellation for WebRTC and Web Audio, with neural inference in WASM and a dedicated worker. Published browser SDK measurements use Chrome v120 and report 10 ms processing frames, supported rates from 8 through 96 kHz except documented Safari 8 kHz limitations, about 12 MB package size, about 100 MB memory, and about 1.5 to 2 ms frame processing. The numbers are vendor benchmarks, not a guarantee for this library hardware or browser matrix.

The getting-started guide requires downloading SDK assets from the vendor portal into app assets, loading model files from app URLs, and calling init. It documents optional SharedArrayBuffer use with cross-origin-isolation requirements, bufferOverflowMS and bufferDropMS overload controls, error events, and a browser matrix including Chrome, Firefox, and Safari 17.4.1 or later. It recommends disabling browser echoCancellation, noiseSuppression, and autoGainControl when using browser voice processing to avoid double processing. The SDK is proprietary and commercial terms, redistribution rights, model hosting, and support commitments must be confirmed with the vendor rather than inferred from docs.

Tradeoffs: this is a valuable quality and operations reference because it publishes runtime, memory, frame, asset, overload, and browser details. It has package and model size, CPU/memory, vendor lock-in, licensing, security-review, and supply-chain costs, and it does not satisfy the default first-party local implementation by itself. It is a comparison or benchmark option pending explicit product and procurement approval, not an accepted dependency.

### Criteria-normalized comparison

| Option | Boundary and browser posture | Runtime/assets | Quality and operations unknowns | Licensing/maintenance tradeoff |
| --- | --- | --- | --- | --- |
| Browser capture NS/AEC/AGC | getUserMedia track; broadest target coverage but UA/device-specific | No app model or WASM; lowest app startup cost | No portable attenuation or intelligibility guarantee; browser interactions and double-processing risk | Browser-maintained; app controls are limited |
| shiguredo RNNoise | raw audio track Processor/Generator; Chromium latest posture | ESM plus RNNoise WASM; lazy load; 48 kHz mono 480-frame assumptions | Queue drops, frame delay, conversion, Chromium-only path, exact quality and CPU unmeasured | Apache-2.0; narrow support/escalation posture |
| web-noise-suppressor | AudioWorklet graph; candidate for modern browsers with worklet | Worklet modules plus selectable WASM assets; app CSP/cache ownership | Algorithm-specific latency, memory, channels, browser parity, and artifacts unmeasured | MIT; dependency maintenance and notices are app responsibility |
| Krisp Web Browser SDK | AudioWorklet/WebRTC-oriented proprietary pipeline; documented Chrome/Firefox/Safari support | Vendor package plus model assets; optional SharedArrayBuffer; worker and buffer controls | Vendor publishes useful baseline but independent corpus validation and failure behavior still required | Commercial/proprietary; confirm terms, support, and supply chain |
| RNNoise upstream | Algorithm reference, not complete browser integration | Native/WASM wrapper and model lifecycle required | Useful 48 kHz mono reference; no browser quality/latency claim in README | BSD-3-Clause upstream; wrapper and model notices must be tracked |

### Candidate custom-processing categories and tradeoffs

The following categories are evaluated for the same dimensions. This is a validation order proposal, not an architecture decision.

| Category | Latency and buffering | Sample rate and channels | Quality, CPU, and memory | Startup, overload, and cleanup |
| --- | --- | --- | --- | --- |
| A. Browser capture constraints only | Usually no app buffer or model startup; browser adds opaque processing latency | Capture settings are UA/device-selected; mono or stereo may vary | Lowest app CPU and memory; quality, attenuation, pumping, and artifacts are browser/device specific; no portable metric | Minimal app assets; still handle permission, mute/ended, device change, and track stop |
| B. AudioWorklet plus WASM or JS | Audio render path can support low fixed buffering; worklet and destination queues must be measured under contention | Explicit resampling and channel layout conversion; start with mono and test 44.1/48 kHz and stereo | Gate, RNNoise, Speex, GTCRN, and commercial neural models cover different quality/CPU/memory points; no cross-library conclusion yet | Worklet module, WASM, and model fetch/cache; strict CSP and offline load; handle worklet error, AudioContext suspension, node disconnect, worker/model destruction |
| C. Raw audio track Processor/Generator | Direct frame pipeline avoids a graph destination but has bounded queues, 480-frame assembly, timestamp and backpressure/drop behavior | shiguredo requires f32-planar mono and 48 kHz style frames; conversion must be explicit | Potentially efficient but Chromium-specific; measure frame drops, allocation, queue growth, CPU, WASM memory, and artifacts | Lazy WASM load; no general audio transform consensus; abort streams, close AudioData, destroy state, stop caller-owned input |
| D. WebCodecs AudioData plus custom worker | Worker transfer and explicit frame queues can isolate CPU, but capture bridge and queue policy are app-owned | Full format/sample-rate/channel conversion responsibility; useful for deterministic frame experiments | Can benchmark algorithms independently; actual real-time browser viability is unknown; memory grows with queues | Worker/WASM lifecycle, AudioData close/transfer, cancellation and fallback are substantial |
| E. Offline or pre/post processing oracle | Not a live output path; deterministic offline processing is useful for regression and corpus scoring | Normalize corpus to controlled 48 kHz mono and preserve original variants | Makes quality/attenuation comparisons repeatable without real-time scheduling confounders | No production startup or overload behavior; use only to explain live-path deltas |
| F. Remote/cloud or native bridge | Out of scope for local browser real-time baseline; network or platform IPC adds latency and failure | Transport and platform format constraints | Could provide other quality/CPU characteristics but violates default local/offline/privacy contract | Requires external service or native integration and significant product approval; excluded from initial validation |

Every live category must report: end-to-end p50/p95 and jitter, algorithmic frame delay, queue depth, frame drops and underruns, sample-rate conversion, channel layout, noise attenuation in dB, speech intelligibility and naturalness, residual noise and musical artifacts, clipping and level pumping, CPU and JS/WASM memory, first-use asset/model startup, steady-state behavior, overload response, and complete cleanup.

Particular compatibility hazards to test:

- Do not infer actual noise reduction from getSupportedConstraints or getSettings. Compare requested and selected settings to measured waveform and listening outcomes.
- Do not stack browser noise suppression or AGC with a custom equivalent without a deliberate matrix. AEC may remain enabled while custom NS is evaluated, but the combination must be measured because browser source code and vendor documentation show coupling and double-processing risks.
- Normalize all candidates to the same capture device, gain, browser, output route, frame clock, corpus, and CPU load. Record browser version, OS, device, constraints, selected settings, algorithm/package/model hashes, asset sizes, and feature gates.
- AudioWorklet must be tested with suspended, resumed, interrupted, background, and denied contexts. Raw track transforms must be tested with queue pressure, dropped frames, closed data, device changes, and cancellation.
- The original capture track remains the fallback. A custom path must not make the microphone unavailable when loading fails, the browser is unsupported, the context is suspended, the model cannot load offline, or overload persists.

### Repeatable corpus and comparison method

The proposed corpus and protocol are intended for a later validation task. No production code or media is added by TASK-1.15.

Corpus construction:

1. Use licensed or consented clean speech from multiple speakers, dialects, ages, and speaking styles; maintain speaker IDs, source licenses, content hashes, and a versioned manifest without storing personal identity. Supplement with locally recorded consented speech only when needed.
2. Add stationary noise such as HVAC, fan, road, and cafe bed; nonstationary noise such as keyboard, door, dog, music, and competing speech; and room impulse responses or device frequency responses. Xiph RNNoise public data at https://media.xiph.org/rnnoise/data/ is a seed reference, not automatic permission to redistribute every file; verify each license and retain only an offline manifest or approved copies.
3. Mix clean speech and noise at controlled SNR values such as -5, 0, 5, 10, and 20 dB. Include silence, VAD transitions, double-talk and echo playback, input-level variation, 44.1 and 48 kHz, mono and stereo, and fixed 10 ms and 20 ms frame variants. Keep unprocessed reference, noisy input, expected alignment markers, and output hashes.
4. Run capture-only baseline, browser built-in processing on and off, each custom category that is supported, and combined browser/custom matrices. Execute on identical browser versions, device routes, permissions, and CPU conditions. Report unsupported cells instead of silently substituting another path.

Objective measurements:

- Align input and output using timestamps plus known synthetic markers. Report algorithmic and end-to-end latency p50, p95, maximum, jitter, queue depth, frame drops, underruns, and recovery time.
- Report segmental SNR delta or noise attenuation dB, speech activity retention, clipping, level variance, gating, spectral distortion, and artifact counts. Use STOI or ESTOI for intelligibility where the corpus and license permit; use word error rate only as a supplemental ASR indicator. Treat PESQ and POLQA as optional because their licensing and applicability need review.
- Capture browser performance traces for CPU and real-time factor, JS heap and WASM memory, AudioContext and worker counts, first-use fetch/compile/model startup, and ten-minute steady-state operation. Repeat at least five start/stop cycles and verify tracks, nodes, workers, streams, WASM states, and contexts are released.
- Inject CPU contention and deliberate queue pressure. Record queue growth, drops, underruns, error events, fallback time, and whether original audio remains available. Measure cold load, warm cache, offline cache, failed asset, unsupported feature, permission, interruption, device removal, and context suspension cases separately.

Listening comparison:

- Use a blinded randomized A/B or MUSHRA-like internal study with the same speech/noise slices and browser/device normalization. Do not represent it as formal standards compliance.
- Ask listeners to rate speech naturalness, intelligibility, residual noise, musical or watery artifacts, level pumping, and preference. Use headphones, a short calibration sample, randomized condition order, and report per-condition distributions and confidence intervals rather than only a mean.
- Use roughly 10 to 20 listeners for an initial directional screen, with hearing consent and no collection of identifying voice data. A later quality gate should increase the sample or justify its power and confidence target.
- Keep raw media offline or in approved storage. Publish configuration, algorithm/model/package hashes, browser and device versions, metric scripts, and aggregate results so another worker can reproduce the comparison.

Privacy, offline, and security constraints:

- Default to on-device processing with no upload, media persistence, telemetry, or external model fetch after assets are installed. Self-host version-pinned JS/WASM/model assets under the application origin or an explicitly reviewed CDN, and keep integrity metadata where supported.
- Test strict Content Security Policy including script-src, worker-src, connect-src, media-src, WASM execution policy, and cross-origin-isolation requirements. Test both SharedArrayBuffer and non-SharedArrayBuffer paths; do not make cross-origin isolation a hidden requirement because COOP/COEP can break embeds and authentication flows.
- Verify a clean offline run after the required asset cache is populated. Asset and model fetch failure must produce a clear loading or degraded state, retain the original track, permit bypass or retry, and avoid silent upload.
- Teardown must stop only tracks owned by the feature, disconnect graph nodes, close destination and source resources as appropriate, abort raw-track streams, close AudioData, terminate workers, destroy denoise state, and close AudioContext. Device mute/ended and page visibility or suspension must be observable in the test logs.

### Alternatives, validation order, and approval boundary

The feasible alternatives are:

1. Use browser capture NS/AEC/AGC as the lowest-cost baseline. It offers broadest availability and no model asset, but quality and interactions remain opaque and browser/device dependent.
2. Validate AudioWorklet plus a small WASM/custom algorithm as the principal cross-browser custom candidate. It provides a stable graph boundary and explicit assets but incurs model startup, CPU/memory, CSP, and conversion work.
3. Validate shiguredo/media-processors as the mandatory Chromium raw-track comparison. It offers a concise RNNoise track API and Apache-2.0 implementation, but current browser/spec evidence makes it a Chromium-specific reference with 48 kHz mono frame constraints.
4. Compare web-noise-suppressor algorithm families and optionally Krisp as an open and commercial quality/operations reference. Neither is selected or accepted as a dependency.
5. Keep WebCodecs worker processing and offline processing as experimental measurement tools, not production recommendations, until a capture bridge and cross-browser evidence exist.
6. Exclude cloud or native bridges from this local-first task because they conflict with the accepted privacy, offline, and browser scope.

Recommended validation sequence, pending explicit user approval for any production choice: first establish built-in constraint baselines; next test an AudioWorklet/WASM path with mono and sample-rate conversion; then test shiguredo on Chromium with the exact raw-track feature gate; finally use the same corpus and metrics for open and commercial reference candidates. The choice of algorithm, runtime, worker strategy, public API, and transform order remains open and must be approved explicitly before being recorded as a significant architecture decision.

This task presents alternatives and tradeoffs only. No product or architecture decision is accepted, no new Backlog Decision is created, and no implementation is added.

### Evidence index and limits

Primary or reproducible evidence accessed 2026-08-16:

- W3C Media Capture and Streams: https://www.w3.org/TR/mediacapture-streams/
- W3C Media Capture Transform: https://www.w3.org/TR/mediacapture-transform/
- W3C Web Audio API: https://www.w3.org/TR/webaudio-1.1/
- W3C WebCodecs: https://www.w3.org/TR/webcodecs/
- Firefox audio constraints test: https://searchfox.org/firefox-main/source/dom/media/webrtc/tests/mochitests/test_getUserMedia_audioConstraints.html
- Firefox audio engine source: https://searchfox.org/firefox-main/source/dom/media/webrtc/MediaEngineWebRTCAudio.cpp
- Chromium WebRTC VoiceEngine source: https://webrtc.googlesource.com/src/+/753b02bc45155b1c7418bab5732b73c44e6edded/media/engine/webrtc_voice_engine.cc
- WebKit Safari 26.4 release notes: https://webkit.org/blog/17862/webkit-features-for-safari-26-4/
- shiguredo/media-processors: https://github.com/shiguredo/media-processors
- shiguredo noise suppression README/source/package: https://github.com/shiguredo/media-processors/tree/develop/packages/noise-suppression ; https://github.com/shiguredo/media-processors/blob/develop/packages/noise-suppression/src/noise_suppression.ts ; https://raw.githubusercontent.com/shiguredo/media-processors/develop/packages/noise-suppression/package.json
- shiguredo releases: https://github.com/shiguredo/media-processors/releases
- rnnoise-wasm: https://github.com/shiguredo/rnnoise-wasm
- Xiph RNNoise README and data seed: https://raw.githubusercontent.com/xiph/rnnoise/main/README ; https://media.xiph.org/rnnoise/data/
- web-noise-suppressor: https://github.com/sapphi-red/web-noise-suppressor ; https://raw.githubusercontent.com/sapphi-red/web-noise-suppressor/main/README.md
- Krisp Web Browser SDK docs: https://sdk-docs.krisp.ai/docs/introduction ; https://sdk-docs.krisp.ai/docs/getting-started-js ; https://sdk-docs.krisp.ai/docs/api-reference ; https://sdk-docs.krisp.ai/docs/supported-platforms

Limitations: Edge and Safari hardware behavior was not locally executed; local probes had no real microphone quality corpus; current browser source snapshots are not release guarantees; published vendor benchmarks are not directly comparable; and no noise attenuation or listening result is claimed before the proposed evaluation runs.

### Validation record (2026-08-16)

- Read backlog instructions task-finalization before final review.
- Research-only scope verified: no production source, dependency, CI, release, workflow-policy, or Backlog Decision files were changed; git status shows only the TASK-1.15 task record modified.
- pnpm run backlog:dispatchable passed (exit 0) and returned the existing leaf candidates TASK-1.13, TASK-1.14, TASK-1.16, and TASK-1.17; no other task was started or changed.
- pnpm run validate:lifecycle passed (exit 0): Task-to-PR lifecycle policy and runbook: OK.
- git diff --check passed (exit 0).
- Objective evidence for AC #1: dated W3C capture, transform, Web Audio, and WebCodecs specifications; current Firefox and Chromium source references; WebKit release notes; and the dated TASK-1.2 local Chrome 151 and Firefox 153 capability probe are recorded above. The matrix documents NS, AEC, AGC, capabilities, settings, exact versus ideal constraints, interactions, lifecycle, and unverified Edge/Safari cells.
- Objective evidence for AC #2: shiguredo project, package README, package metadata, source implementation, release history, rnnoise-wasm, and Xiph RNNoise primary links are recorded above, including API, raw-track boundary, 48 kHz mono frame assumptions, runtime and assets, browser coverage, licensing, maintenance, and failure/cleanup risks.
- Objective evidence for AC #3: web-noise-suppressor and official Krisp Web Browser SDK sources are recorded above with selection rationale and the same boundary/runtime/asset/quality/operations/licensing criteria; upstream RNNoise is included as an algorithm reference.
- Objective evidence for AC #4: categories A-F and the criteria table cover latency, queues, sample rates, channel layouts, speech quality, attenuation, artifacts, CPU, memory, startup, overload, cleanup, and unsupported/unknown measurements.
- Objective evidence for AC #5: a versioned licensed corpus, controlled SNR mixes, objective metrics, blinded listening method, browser/device normalization, offline/no-upload rules, CSP and cross-origin-isolation checks, cache/fetch failure behavior, and original-track fallback are specified above.
- Objective evidence for AC #6: alternatives, tradeoffs, and a validation order are explicitly presented as proposals; the notes state that no product or architecture decision is accepted and explicit approval is required before any significant choice.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Completed TASK-1.15 as research only. Recorded dated W3C, browser-source, WebKit, shiguredo/media-processors, web-noise-suppressor, Krisp, and RNNoise evidence; compared browser capture, AudioWorklet/WASM, raw track transforms, and worker/offline categories; and proposed reproducible objective and blinded listening evaluation with offline, CSP, privacy, overload, and original-track fallback requirements. Verified with pnpm run backlog:dispatchable, pnpm run validate:lifecycle, and git diff --check; all passed, and no production or workflow files or architecture decisions were changed.
<!-- SECTION:FINAL_SUMMARY:END -->
