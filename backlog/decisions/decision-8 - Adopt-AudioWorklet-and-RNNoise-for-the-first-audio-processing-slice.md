---
id: decision-8
title: Adopt AudioWorklet and RNNoise for the first audio-processing slice
date: '2026-11-20 12:54'
status: accepted
---
## Context

Restored on 2026-11-20 through Backlog CLI from the retained task-1-12-audio-processing workspace after coordinator message msg_3a1d2a0d5250 reaffirmed the existing user approval. The original Decision metadata is preserved in that workspace; the new CLI-generated metadata records this restoration. No new architectural approval is inferred.
Decision-1 places voice noise reduction in P0 and sets the quality direction: at least 6 dB noise reduction with no more than 0.03 degradation on the selected intelligibility metric, no more than 40 ms p95 added latency over the browser-reported baseline, local warm initialization within 1 s, and compressed model assets no larger than 5 MiB. These are validation gates and hypotheses, not claims about unmeasured browser/device combinations.

Decision-2 defines session-owned capture and generated media, standard media outputs, application-owned clones, independent audio/video lifecycle, cancellation and supersession, SSR-safe imports, and original-media bypass with an observable degraded state when processing is unavailable or fails recoverably. The existing capture path obtains the microphone once and exposes a one-track session output; the audio API already describes `noiseReduction({ level })` and `setAudioEffects`, but audio processing is not implemented. TASK-1.5 provides an AudioWorklet/destination-node smoke baseline, while TASK-1.15 provides adjacent application context.

The Web Audio API supports custom processing in `AudioWorkletProcessor` on the rendering thread, including WebAssembly. Its [processor error behavior](https://www.w3.org/TR/webaudio-1.1/#AudioWorkletNode-processorerror) is significant: an uncaught processor exception fires `processorerror` and the node outputs silence for its lifetime, so the implementation must trap/report processor failure and switch to Decision-2 bypass behavior. The [W3C Media Capture Transform specification](https://www.w3.org/TR/mediacapture-transform/) explicitly does not establish audio track processing or generated audio tracks as a cross-browser standard, making that path a weaker default for this slice.

## Decision Drivers

- Implement the approved P0 voice-noise-reduction slice through the existing capture session without reacquiring the microphone or disturbing video capture.
- Preserve Decision-2 lifecycle, cancellation, output ownership, SSR import, standard `MediaStreamTrack`/`MediaStream` output, and original-media bypass semantics.
- Use a first-party, local algorithm and bounded real-time work; keep processing and model execution local to the browser.
- Preserve existing effect naming and level options, making only the approved additive bypass configuration change; do not assert a broader compatibility or browser-support promise without evidence.
- Gate support claims on representative speech/noise quality, added latency, and output continuity measurements for each browser/device cell.

## Considered Options

1. **Web Audio `AudioWorklet` plus RNNoise WASM (selected).** Xiph describes [RNNoise](https://github.com/xiph/rnnoise) as a recurrent-neural-network noise suppressor; its [RNNoise 0.2 header](https://github.com/xiph/rnnoise/blob/main/include/rnnoise.h) provides the frame processing API. The [Shiguredo WASM wrapper](https://github.com/shiguredo/rnnoise-wasm) packages RNNoise for browser use and its [2025.1.5 release](https://github.com/shiguredo/rnnoise-wasm/releases/tag/2025.1.5) uses RNNoise 0.2. A source → worklet → destination graph can preserve the already captured microphone while yielding a standard destination track. It adds a maintained WASM dependency, sample-rate/channel conversion, frame buffering, worklet deployment/CSP considerations, and real-time scheduling risk; all require validation. The wrapper is Apache-2.0 and the upstream RNNoise notices/license must also be preserved.
2. **`MediaStreamTrackProcessor`/`MediaStreamTrackGenerator` with RNNoise.** This offers a direct frame pipeline, but the [W3C Media Capture Transform specification](https://www.w3.org/TR/mediacapture-transform/) does not standardize audio transforms/generated audio tracks and browser exposure is not a reliable cross-browser baseline. It is not selected for the first supported path.
3. **Browser `getUserMedia` noise suppression constraints.** This avoids bundling a model, but leaves the algorithm and behavior browser/device-owned, does not implement the approved first-party processor, and changing constraints can require a separate capture operation. It remains only a possible baseline for experiments, not the implementation.
4. **A third-party AudioWorklet wrapper or heavier worker/WebCodecs pipeline.** `@sapphi-red/web-noise-suppressor` offers an AudioWorklet integration but introduces wrapper/build-tool coupling and older patched RNNoise WASM lineage. A separate worker or larger model pipeline adds queue/transfer and startup/latency questions without evidence of a cross-browser advantage. Neither is needed for the approved representative slice.

## Decision

Adopt a local first-party noise-reduction transformation for TASK-1.12 using the already captured microphone track as the source of a Web Audio graph: `MediaStreamAudioSourceNode` → `AudioWorkletNode` → `MediaStreamAudioDestinationNode`. Lazily load and pin `@shiguredo/rnnoise-wasm` 2025.1.5, which wraps Xiph RNNoise 0.2. Do not add a separate Worker. Explicitly downmix and resample input to 48 kHz mono and process bounded 480-sample (10 ms) frames; do not allow an unbounded queue to accumulate.

Reuse the existing `noiseReduction({ level })` effect and `setAudioEffects` API. Add the approved optional `bypass` property to `AudioEffectConfig`; retain `light`, `standard`, and `strong` as semantic tiers and calibrate their mappings against the selected corpus instead of assuming preset values. Keep the current standard session output and clone ownership contract. Follow Decision-2 for bypass during load/failure, visible state, cancellation/supersession, SSR-safe construction, and session-owned teardown. Do not change the wider compatibility/distribution promise.

Only document a browser/device support cell after it has evidence for noise attenuation, intelligibility, p50/p95 added latency against the browser-reported baseline, and output continuity/underruns, along with the tested browser, device, sample rate, and configuration. Apply Decision-1's quality, p95 latency, warm-start, and asset-size gates; unsupported or failing cells must expose the Decision-2 fallback state rather than a support claim.



## Consequences

The implementation adds one lazily loaded pinned WASM dependency and an additive optional API property. It must preserve upstream license notices and ship assets locally; processing must not send captured media to a service. Worklet errors, overload, cancellation, and teardown must be observable and recover to the original-media path whenever possible. Browser measurements, corpus calibration, SSR-safe import tests, consumer documentation, and cleanup verification are required before TASK-1.12 can meet its acceptance criteria. This Decision authorizes the implementation choice only; it does not authorize merging, which remains in the manual review lane.

## Related Tasks

- TASK-1.12 — implement and validate the approved representative audio transformation.
- TASK-1.5 — use its AudioWorklet/destination-node smoke evidence as a limited baseline, then collect RNNoise-specific measurements.
- TASK-1.15 — preserve adjacent consumer application lifecycle expectations.
- Decision-1 and Decision-2 — retain their product-quality and lifecycle contracts.
