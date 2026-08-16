---
id: doc-5
title: Browser Audio Processing Feasibility
type: specification
created_date: '2026-08-16 18:40'
updated_date: '2026-08-16 18:49'
tags:
  - research
  - audio
  - browser
  - feasibility
  - approval-bound
---
# Browser Audio Processing Feasibility

Research record for TASK-1.5, reviewed 2026-08-17 (Asia/Tokyo). This report is a disposable-spike result, not a production implementation or an accepted processor, public API, compatibility promise, runtime, worker strategy, acceleration backend, or transform order.

## Authority and evidence boundary

The accepted baseline is decision-1 and Backlog doc-1, Initial Product and Quality Contract. The first release is local and headless at the React API boundary, with first-party voice noise reduction, modern evergreen desktop Chrome, Edge, Firefox, and Safari as the initial compatibility hypothesis, and mobile as feasibility input rather than a support guarantee. The contract asks for no more than 40 ms p95 beyond the browser-reported audio baseline, no sustained underruns on reference hardware, intelligible speech, documented effect quality, deterministic cleanup, and an original-audio fallback.

TASK-1.15 already compared browser NS/AEC/AGC constraints, shiguredo/media-processors, web-noise-suppressor, Krisp, and RNNoise, and proposed the corpus and listening protocol. TASK-1.2 supplied the dated browser capability matrix. TASK-1.17 supplied standard output, ownership, handoff, and cleanup constraints. This task validates the runtime boundary and measurements that those research records require; it does not duplicate their library survey or accept their approval-bound recommendations.

## Scope and representative workload definitions

The experiment uses the following workload families. Every candidate must be compared with the same capture settings, input route, browser build, device tier, corpus version, and output consumer.

| Workload | Purpose | Required variants |
| --- | --- | --- |
| Capture-only baseline | Establish browser processing and graph overhead before custom DSP | Browser NS/AEC/AGC each on and off where requestable; actual `getSettings()`; clean speech, silence, and noisy speech |
| Pass-through graph | Measure `MediaStreamAudioSourceNode` to `AudioWorkletNode` to `MediaStreamAudioDestinationNode` without DSP | 44.1 and 48 kHz contexts; mono request, stereo request, and actual 1/2 channel layouts; preview/recorder/sender consumers |
| Filter-shaped workload | Represent a deterministic low-cost effect with bounded state and no model asset | One-pole or Biquad low-pass/high-pass, 250 Hz/4.8 kHz/8 kHz cutoffs, impulse, tone sweep, speech, and silence; 128-frame render quantum and any available render-size hint |
| Noise-reduction workload | Validate the first-party voice hypothesis without choosing the final algorithm | Stationary HVAC/fan/road noise; non-stationary keyboard/door/dog/music/competing speech; SNR -5/0/5/10/20 dB; clean speech and double-talk |
| Frame-conversion workload | Expose assumptions made by RNNoise-like processors | 44.1 to 48 kHz and 48 to 44.1 kHz; mono downmix and stereo preservation; f32-planar, interleaved, 16-bit, 10/20 ms and 480-sample frames; timestamp continuity |
| Overload workload | Test bounded queues and recovery rather than only a nominal happy path | CPU contention, model/WASM compile during capture, deliberate worklet load, queue pressure, suspended/resumed context, interruption, device end, and cancellation during startup |

The repeatable corpus should contain licensed or consented clean speech from multiple speakers, ages, dialects, speaking rates, and input levels. Keep a versioned manifest, source license, content hash, speaker pseudonym, and alignment marker without retaining identity. Mix the speech with stationary and transient noise at controlled SNR values, include silence and VAD transitions, and retain noisy input plus clean reference for objective scoring. Xiph RNNoise data is a seed for corpus design only; its individual redistribution terms must be checked before copying media.

The live harness should prepend a deterministic marker or use a scheduled impulse in a separate graph. It must preserve source and output timestamps, capture settings, browser/OS/device/GPU/power mode, requested constraints, selected settings, algorithm/package/model hashes, asset sizes, and feature gates. Unsupported cells are reported as unsupported or unknown, never silently substituted by another path.

## Measurement protocol

### Latency, continuity, and overload

Measure each of these separately and do not hide asset transfer or permission time in processing latency:

1. Capture request resolution and selected input settings.
2. Context creation, `AudioWorklet.addModule`, model/WASM load/compile, context resume, and first processed output.
3. Algorithmic input-to-output delay using a timestamped marker or impulse at the graph input and detection at the destination or recorder input.
4. Browser-reported `MediaStreamTrack.getSettings().latency`, `AudioContext.baseLatency`, and `AudioContext.outputLatency`, with the caveat that base latency excludes graph and hardware portions and headless output latency is not a real-device measurement.
5. End-to-end p50, p95, maximum, jitter, render-quantum delay, queue depth, and recovery time over repeated runs.

For each real-time run calculate expected render quanta from duration, sample rate, and quantum size. Record missing or duplicate markers, AudioWorklet process errors, context state changes, output track `mute`/`ended`, MediaRecorder errors, queue drops, underruns, and whether the original track stayed available. Exercise suspend/resume and cancellation while worklet/model startup is pending. During overload, record queue growth, output continuity, time to bypass or recover, and whether cleanup is still idempotent.

### CPU, memory, startup, and endurance

Record browser performance traces or equivalent per-process CPU, audio-thread real-time factor, JS heap, WASM/model memory, worker/context/node counts, first-use network/compile/startup, and ten-minute steady state. Repeat at least five start/stop cycles and compare retained heap to the inactive post-warm-up baseline. `performance.memory` is a Chrome-only JS heap signal and must not be treated as total process or WASM memory. `AudioContext.renderCapacity` is optional and must be recorded as unavailable when absent. Host process profiling is required for the final reference matrix because an AudioWorklet cannot expose a portable CPU percentage.

### Objective quality

Align clean reference, noisy input, and output using timestamps and synthetic markers. Report segmental SNR/noise attenuation in dB, speech activity retention, clipping, level variance, gating, spectral distortion, residual noise, and artifact counts. Use STOI or ESTOI for intelligibility when the corpus and license permit. Treat ASR word error rate as supplemental only, and treat PESQ/POLQA as optional pending licensing and applicability review. Aggregate scores are insufficient: report demographic, noise, device, browser, sample-rate, and channel slices.

### Listening comparison

Run a blinded randomized A/B or MUSHRA-like internal comparison with normalized browser/device playback. Rate speech naturalness, intelligibility, residual noise, musical or watery artifacts, level pumping, and preference. Use a calibration sample, randomized condition order, headphones, consent, and distributions/confidence intervals instead of only a mean. An initial directional screen may use roughly 10 to 20 listeners; it is not formal standards compliance. Keep raw speech offline or in approved storage and publish only aggregate results and reproducibility metadata.

## Disposable local browser probe

On 2026-08-17 JST (2026-08-16T18:39Z), a temporary same-origin HTTP page and AudioWorklet module were run and removed after the probe. The page used Chrome DevTools Protocol to grant microphone permission, then launched Chrome 151.0.7922.137 headless on secure loopback with fake media, no GPU, and no repository fixture retained. Host details were Linux 6.18 WSL2, AMD Ryzen 9 5900X, 24 logical CPUs, and 31 GiB RAM; this is a harness host, not a release reference tier.

The probe ran five profiles: pass-through baseline, one-pole denoise plus 4.8 kHz Biquad low-pass, exact-mono request, an explicit 48 kHz `AudioContext` fed by the selected 44.1 kHz capture, and bounded CPU stress. Each profile created a fresh capture stream/context/worklet/destination, scheduled a graph impulse, suspended for 250 ms, resumed, recorded approximately 400 ms through MediaRecorder, and closed all nodes, tracks, and context resources. This is a smoke measurement with one run per profile; it does not establish p95, ten-minute endurance, noise attenuation, speech intelligibility, or real-device CPU.

### Measured Chrome results

| Profile | Actual input settings | Context rate | Capture / worklet module | Base latency | Marker offset | Continuity and cleanup |
| --- | --- | --- | --- | --- | --- | --- |
| Baseline | 44.1 kHz, 2 channels, 10 ms track latency, NS/AEC/AGC false | 44.1 kHz | 66.4 ms cold capture; 7.8 ms module | 11.61 ms; output latency 0 in headless | 0 samples in this scheduled graph marker | 650 quanta / 83,200 frames, zero measured gaps/errors; suspend produced zero quanta; context closed and tracks ended |
| Filter-shaped | Same 44.1 kHz, 2 channels | 44.1 kHz | 3.8 ms capture; 6.2 ms module after browser warm-up | 11.61 ms; output latency 0 headless | 0 samples | 650 quanta / 83,200 frames, zero measured gaps/errors; context closed and tracks ended |
| Exact-mono request | The UA still selected 44.1 kHz, 2 channels despite exact channelCount 1 in the fake-device run | 44.1 kHz | 3.4 ms capture; 5.1 ms module | 11.61 ms; output latency 0 headless | 0 samples | 650 quanta / 83,200 frames, zero measured gaps/errors; destination remained 2-channel, so explicit downmix cannot be assumed |
| Explicit 48 kHz context | Capture remained 44.1 kHz, output/context 48 kHz | 48 kHz | 4.8 ms capture; 7.3 ms module | 11.625 ms; output latency 0 headless | 0 samples | 700 quanta / 89,600 frames, zero measured gaps/errors; resampling path constructed successfully |
| Stress | Same 44.1 kHz, 2 channels | 44.1 kHz | 3.3 ms capture; 6.4 ms module | 11.61 ms; output latency 0 headless | 0 samples | 900 quanta / 115,200 frames, zero measured gaps/errors; 700.2 ms wall stress versus 708.2 ms context progression; context closed and tracks ended |

Additional measured signals:

- The fake capture capabilities advertised sample rates 44.1 to 48 kHz, channel counts 1 to 2, and boolean NS/AEC/AGC. The selected settings were 44.1 kHz and 2 channels even when 48 kHz was preferred and exact mono was requested. This is evidence that conversion/downmix must be an explicit pipeline stage, not an assumption from requested constraints.
- `AudioContext` and `AudioWorklet` construction succeeded for all five profiles. `MediaStreamAudioDestinationNode` produced a live output track. MediaRecorder accepted each output as `audio/webm;codecs=opus`; baseline and filter outputs were 275 bytes, mono 305 bytes, and stress 2,499 bytes in the short fake run. Recorder acceptance demonstrates handoff shape only, not audio quality.
- The scheduled impulse traversed the synthetic graph with zero sample offset at the analyzer threshold in this headless run. Combining this with the selected 10 ms capture latency and 11.61 to 11.625 ms context base latency gives an approximately 21.6 ms browser-reported lower-bound signal, not a source-to-preview p95 claim. Headless `outputLatency: 0` cannot stand in for a speaker, headset, or real microphone path.
- JS heap rose during each short profile from approximately 0.85 MiB at the first profile start to approximately 1.30 MiB before the final stress cleanup. These are cumulative same-page allocations, not a leak diagnosis; the probe did not perform the required five-cycle retained-heap comparison or measure WASM/native memory.
- Context suspension was observable and paused worklet quanta. Resume restored processing. The stress loop did not produce a detectable gap or error, but its load was bounded and the host had spare capacity; this is not overload-recovery proof.

### Browser matrix and limits

| Browser/context | Evidence | Feasibility implication |
| --- | --- | --- |
| Chrome 151.0.7922.137 Window, secure loopback | This task's AudioWorklet/MediaStreamAudioDestinationNode smoke probe succeeded. TASK-1.2 also exposed AudioData, AudioEncoder, and AudioDecoder. | Web Audio is a viable prototype boundary on this exact headless build. Validate real hardware and output consumers before support claims. |
| Chrome 151 DedicatedWorker | TASK-1.2 exposed WebCodecs raw constructors but no tested MediaStreamTrackProcessor/Generator constructors in the worker. | A worker raw-track audio path cannot be inferred from Window support. AudioWorklet remains the measured custom candidate. |
| Firefox 153.0.3 in TASK-1.2 (153.0.4 installed when this task ran) | Existing probe exposed AudioContext, AudioWorkletNode, AudioData, AudioEncoder, and AudioDecoder, but no raw track transform constructors in Window or DedicatedWorker. | Web Audio deserves a real Firefox run; raw audio Processor/Generator is not a cross-browser baseline. The version difference is recorded rather than silently merged. |
| Edge desktop | No Edge binary or runner in this worktree. | Unknown; Chromium similarity is not evidence of exact Edge behavior. Repeat the same page and device matrix. |
| Safari/macOS/iOS | No macOS or iOS runner in this worktree. WebKit release notes are source evidence only. | Unknown; test AudioWorklet suspension, sample-rate/channel behavior, worklet assets, interruption, and output handoff on the target Safari releases. |
| Mobile | No real device. | Feasibility-only follow-up for permissions, interruption, thermals, backgrounding, and memory pressure; not an initial support guarantee. |

### Offline corpus objective smoke

To complement the live fake-device smoke, an offline, deterministic oracle was run on 2026-08-17 against one external local LibriSpeech `dev-clean` utterance (`84-121550-0001`, 7.975 s, source SHA-256 `247e369979ea804e60027e88710bfa4e8ab1b8f651a355c524715ba7861e6686`; the source was not copied into this repository). The clip was decoded and resampled to 48 kHz mono, normalized, mixed with seeded white noise at 0 dB and 10 dB SNR, and evaluated with pass-through, one-pole alpha-0.15 filtering, and a 10 ms frame gate with 0.2 attenuation. The metrics are an objective filter/gate smoke, not a claim that either simple algorithm is the final denoiser.

| Input SNR | Candidate | Effective output SNR | SNR delta | Speech error RMS | Clean/output correlation | Clipped samples |
| ---: | --- | ---: | ---: | ---: | ---: | ---: |
| 0 dB | Pass-through | 0.000 dB | 0.000 dB | 0.100000 | 0.70677 | 0 |
| 0 dB | One-pole alpha 0.15 | 7.345 dB | +7.345 dB | 0.042930 | 0.90616 | 0 |
| 0 dB | 10 ms gate, attenuation 0.2 | 0.000 dB | 0.000 dB | 0.100000 | 0.70677 | 0 |
| 10 dB | Pass-through | 10.000 dB | 0.000 dB | 0.031623 | 0.95346 | 0 |
| 10 dB | One-pole alpha 0.15 | 9.610 dB | -0.390 dB | 0.033074 | 0.94372 | 0 |
| 10 dB | 10 ms gate, attenuation 0.2 | 10.000 dB | 0.000 dB | 0.031623 | 0.95346 | 0 |

This oracle shows why attenuation cannot be treated as intelligibility: the low-pass improved effective SNR in the 0 dB synthetic mix but changed speech error/correlation, and the simple gate did not improve this clip. It is repeatable evidence for the measurement pipeline and filter-shaped workload only. No listener panel or human perceived-quality result was run in this headless worker; the blinded listening protocol above remains required before a release-quality claim. The lack of subjective evidence is recorded as a limitation rather than filled with an automated proxy.
## Execution-category comparison

| Category | Feasibility and tradeoffs | Current evidence / required follow-up |
| --- | --- | --- |
| Browser capture NS/AEC/AGC | Broadest availability and no app model, but UA/device quality, coupling, and artifacts are opaque; stacking custom NS can double-process. | TASK-1.15 records W3C, Firefox, Chromium source evidence. Measure actual attenuation and intelligibility with each requested/selected setting. |
| AudioWorklet plus JS/WASM | The measured Chrome path handles capture, graph processing, destination-track handoff, context suspend/resume, and cleanup. It requires worklet/WASM/model assets, explicit conversion, and audio-thread overload discipline. | Best cross-browser custom candidate for the next disposable validation, subject to Firefox/Edge/Safari real runs, CSP/offline tests, and quality/CPU corpus evidence. No selection is accepted. |
| Raw audio `MediaStreamTrackProcessor`/Generator | Direct frames can avoid graph copies and fit shiguredo's RNNoise wrapper, but current Media Capture Transform draft has no Working Group consensus for audio use and local Window/Worker exposure is inconsistent. | Mandatory Chromium comparison only. Measure 48 kHz mono 480-sample framing, f32-planar conversion, timestamps, queue/drop behavior, AudioData closure, abort, and fallback. |
| WebCodecs AudioData in a worker | Useful for offline and algorithm benchmarks with explicit format/timestamp/close controls, but there is no general capture-to-track bridge and queue policy is application-owned. | Benchmark tool, not production recommendation until a cross-browser output bridge is demonstrated. |
| Offline oracle | Best for deterministic quality, attenuation, and listening comparison without browser scheduler noise. | Required companion to live runs; cannot prove startup, latency, overload, or cleanup. |
| Cloud/native bridge | Could change quality and device constraints but conflicts with local-first privacy, offline behavior, browser-only scope, and product cost. | Excluded from the initial feasibility conclusion unless the user approves a scope change. |

## Threading, buffering, formats, cancellation, and cleanup constraints

- AudioWorklet processing runs in the audio rendering path. A processor must finish within its render-quantum budget and avoid allocation or unbounded queues. Any model or WASM startup belongs outside the steady-state audio callback, with an explicit loading/bypass state.
- AudioWorklet input channel count may be upmixed/downmixed by node configuration. The fake Chrome result shows that an exact mono capture request can still expose a two-channel selected track, so denoisers requiring mono must downmix explicitly and report the chosen layout.
- A 44.1 kHz input into a 48 kHz context succeeded in the smoke run, but conversion quality, timestamp drift, and CPU were not measured. A processor with 480-sample/48 kHz assumptions must own and test resampling and partial-frame flush behavior.
- `AudioContext.suspend()` pauses rendering and `resume()` restarts it. Device interruption, page backgrounding, output-device change, and permission/device loss can produce equivalent gaps or ended tracks. The library must expose these as diagnosable states and preserve an original-track fallback.
- Cancellation must abort pending asset loads, ignore late worklet/model results, disconnect stale nodes, and never attach a late output to a disposed consumer. Supplied input tracks are borrowed unless explicitly adopted; the library stops only acquired/created resources it owns.
- Cleanup is idempotent: disconnect nodes, stop owned destination/output tracks, close AudioData where a raw-frame path is used, terminate workers, destroy model state, abort streams, and close the AudioContext exactly once. The smoke run verified context `closed` and input/output tracks `ended` after cleanup.
- Standard destination streams can be handed to `MediaRecorder`, an HTML media element, or a WebRTC sender, but replacement and recorder track-set behavior remain separate interoperability tests. TASK-1.17 records those consumer constraints.

## Privacy, security, and fallback constraints

The default remains on-device with no media upload, persistence, or telemetry. Model/WASM/worklet assets must be version-pinned, disclosed, integrity-reviewed, and tested with strict `script-src`, `worker-src`, `connect-src`, `media-src`, and WASM policies. A cross-origin-isolated SharedArrayBuffer path may be an optimization, but COOP/COEP must not become an undocumented requirement because it can break embedding and authentication. Secure context, top-level/iframe Permissions Policy, explicit user action, and browser permission state must be tested independently.

Fallback alternatives are approval-bound, but the evidence supports this candidate policy for review: retain the original capture track while a processor loads where product policy permits; bypass to original audio on unsupported execution, model/asset failure, suspended context, persistent overload, or cancellation; expose loading, unsupported, degraded, and failed states with retry; never silently upload or substitute another input device. Built-in browser NS/AEC/AGC should be compared as a separately labeled baseline rather than silently stacked with custom processing.

## Feasibility conclusion and approval-bound alternatives

The browser audio path is feasible for a disposable prototype: Chrome 151 successfully connected a captured track through AudioWorklet and a filter-shaped workload to a standard destination track, survived suspend/resume and bounded stress, produced a MediaRecorder-compatible output, and closed all tested resources. The local signal is encouraging for the approved 40 ms hypothesis because selected input latency plus context base latency was approximately 21.6 ms before real-device and graph-specific p95 costs.

The evidence is not sufficient for a release claim. The fake device has no human speech or noise, the probe is one short run on one headless Chromium host, CPU/WASM/native memory and p95 were not measured, `outputLatency` is meaningless in headless mode, Edge/Safari were not run, and the exact-mono request was not honored by the fake capture source. Speech quality, attenuation, artifacts, thermal behavior, device interruption, strict CSP/offline loading, and five-cycle/ten-minute retention remain open.

The alternatives to present for explicit user review are:

1. **AudioWorklet plus a first-party JS/WASM processor:** measured prototype boundary and likely broadest custom portability; costs worklet/model assets, conversion, CPU/memory, CSP, and overload handling.
2. **Chromium raw-track processor/generator:** direct frame handoff and a concrete shiguredo/RNNoise comparison; costs browser-specific support, 48 kHz mono framing, queue/drop, and raw frame lifecycle risk.
3. **Browser capture processing only:** lowest cost and broadest fallback baseline; does not satisfy first-party noise-reduction quality ownership or provide portable quality guarantees.
4. **WebCodecs worker/offline processing:** useful benchmark and quality oracle; no demonstrated cross-browser capture/output bridge, so not a production recommendation.

Recommendation for the next evidence loop, pending user approval of any significant implementation choice: use browser capture processing as the labeled baseline, validate AudioWorklet with the repeatable corpus and explicit sample-rate/channel conversion, then compare shiguredo on Chromium behind an exact capability gate. Do not create an accepted Backlog Decision from this recommendation. The public API, processor, runtime, worker strategy, acceleration path, fallback default, and compatibility promise remain unresolved until the user reviews the alternatives and the missing corpus/device evidence.

## Acceptance-criteria evidence map

| Criterion | Evidence |
| --- | --- |
| #1 Workloads, noise, speech, input profiles | Workload table and corpus definition cover capture baseline, filter, noise-reduction, frame conversion, SNR -5/0/5/10/20 dB, silence/double-talk, 44.1/48 kHz, mono/stereo, frame formats, and approved first-release voice journey. |
| #2 Latency, glitches/underruns, CPU/memory, startup, overload recovery | Measurement protocol defines p50/p95/jitter, graph markers, browser latency, quantum/drop/underrun counters, traces, startup stages, stress/recovery. Chrome smoke results record base latency, marker offset, module/capture startup, quanta, zero observed gaps/errors, suspend/resume, stress wall/context timing, and JS heap signals; limitations are explicit. |
| #3 Attenuation, intelligibility, quality, artifacts | Objective SNR/attenuation, intelligibility, clipping, spectral/artifact metrics, and a blinded listening protocol are defined; the offline LibriSpeech smoke reports repeatable SNR, correlation, error, and clipping values for filter/gate workloads. No listener panel was available in this worker, so perceived-quality evidence is explicitly pending and no release claim is made. |
| #4 Threading, buffering, channel/rate, loading, cancellation, cleanup | AudioWorklet/raw-track/WebCodecs comparison and constraints cover render budget, queues, worklet/model loading, 44.1/48 conversion, exact-mono mismatch, suspend/resume, cancellation, ownership, closure, and idempotent cleanup. |
| #5 Browser/device/fallback/privacy/security | Dated Chrome smoke and TASK-1.2 Firefox evidence are separated from unverified Edge/Safari/mobile rows. Secure context, Permissions Policy, CSP/WASM, isolation, local-only processing, original-track fallback, and device limits are documented. |
| #6 Conclusion, alternatives, tradeoffs, approval boundary | Conclusion and four alternatives are presented as recommendations only. This report and TASK-1.5 explicitly state that no processor, API, compatibility, distribution, or architecture decision is accepted and no new Backlog Decision is created. |

## Evidence index

- Accepted baseline: `decision-1`, `doc-1`, and TASK-1.1.
- Existing browser matrix and reproducible probes: TASK-1.2, including Chrome 151.0.7922.137 and Firefox 153.0.3 Window/Worker results.
- Noise-reduction analysis, mandatory shiguredo comparison, corpus, and listening protocol: TASK-1.15.
- Output ownership and MediaStream/recorder/WebRTC handoff constraints: TASK-1.17 and `doc-3`.
- W3C Media Capture and Streams: https://www.w3.org/TR/mediacapture-streams/
- W3C Web Audio API 1.1: https://www.w3.org/TR/webaudio-1.1/
- W3C Media Capture Transform: https://www.w3.org/TR/mediacapture-transform/ (the current draft notes no Working Group consensus for audio use cases)
- W3C WebCodecs: https://www.w3.org/TR/webcodecs/
- MDN AudioContext base latency: https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/baseLatency
- Firefox audio constraints test: https://searchfox.org/firefox-main/source/dom/media/webrtc/tests/mochitests/test_getUserMedia_audioConstraints.html
- Firefox WebRTC audio engine: https://searchfox.org/firefox-main/source/dom/media/webrtc/MediaEngineWebRTCAudio.cpp
- Chromium WebRTC VoiceEngine: https://webrtc.googlesource.com/src/+/753b02bc45155b1c7418bab5732b73c44e6edded/media/engine/webrtc_voice_engine.cc
- WebKit Safari 26.4 notes: https://webkit.org/blog/17862/webkit-features-for-safari-26-4/
- shiguredo/media-processors: https://github.com/shiguredo/media-processors
- shiguredo noise suppression package/source: https://github.com/shiguredo/media-processors/tree/develop/packages/noise-suppression
- web-noise-suppressor: https://github.com/sapphi-red/web-noise-suppressor
- Krisp Web Browser SDK: https://sdk-docs.krisp.ai/docs/introduction
- Xiph RNNoise: https://github.com/xiph/rnnoise
