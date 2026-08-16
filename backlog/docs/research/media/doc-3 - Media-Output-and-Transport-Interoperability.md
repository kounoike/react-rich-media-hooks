---
id: doc-3
title: Media Output and Transport Interoperability
type: specification
created_date: '2026-08-16 12:34'
updated_date: '2026-08-16 12:37'
tags:
  - media
  - interop
  - transport
  - ownership
  - compatibility
---
# Media Output and Transport Interoperability

Research record for TASK-1.17, reviewed 2026-08-16.

## Authority and scope

This report is an evidence record, not an accepted product, public API, compatibility, or architecture decision. The authoritative baseline is `decision-1` and Backlog doc-1: a headless React library for local browser capture and first-party video/audio effects, with SSR-safe import behavior, explicit lifecycle and cleanup, and standards-based media objects where feasible. WebRTC/network transport, recording, transcoding, and storage remain first-release non-goals; they are analyzed here only to establish an interoperable handoff boundary for future adapters and application-owned consumers.

The report covers the approved local journeys (capture, preview, crop/auto-framing, background processing, noise reduction, and React framework integration), plus representative consumers that may receive an output: HTML media elements, `RTCPeerConnection`, `MediaRecorder`, canvas capture, Web Audio destinations, and external framework/controller boundaries.

No option below is accepted. A recommendation is labeled as a research recommendation and requires explicit user approval before it becomes a contract or implementation commitment.

## Executive findings

1. A processed `MediaStreamTrack` or `MediaStream` is the broadest browser handoff boundary. The standards list media elements, WebRTC, recording, image capture, and Web Audio as stream consumers, and a single `MediaStream` can be attached to multiple outputs. This maximizes interoperability but makes ownership, replacement, and cleanup part of the public contract.
2. Video and audio output cannot be treated as one interchangeable pipeline. The current Media Capture Transform Working Draft is worker-oriented, has no Working Group consensus on Window exposure, and has no consensus for audio processing. Web Audio plus `AudioWorklet` and `MediaStreamAudioDestinationNode` is a separate, established audio graph boundary with its own sample-rate, buffering, context, gesture, and shutdown behavior.
3. WebRTC track replacement is not the same as replacing a `MediaStream` object. `RTCRtpSender.replaceTrack()` normally avoids renegotiation, but it can reject when kind, negotiated bounds, frame/block rate, raw/pre-encoded mode, codec, or audio channel count do not fit. Adding/removing transceivers or changing direction can require negotiation. A future transport adapter must own this operation rather than silently changing it as a side effect of processor configuration.
4. `MediaRecorder` is less tolerant of changing its input track set while recording than a preview or sender. The recording specification allows an error when a track is added or removed during recording. A recording consumer should receive a stable output stream for a recording session, or explicitly stop and restart around an output change.
5. `mute`, `enabled`, and `ended` are distinct. `mute` is a temporary source-side lack of data, `enabled=false` is application-controlled zero-information output, and `ended` is terminal. Calling `stop()` sets `readyState` to `ended` without firing `ended`, so cleanup must not wait for that event.
6. A standard output does not eliminate browser gaps. Local TASK-1.2 probes on 2026-08-16 found Chrome 151 exposing legacy raw-track transform constructors in Window but none of the tested transform constructors in a DedicatedWorker; Firefox 153 exposed neither raw-track transform path. Edge and Safari were not available in the worktree. A canvas fallback and an audio-graph fallback are evidence-backed categories, not a blanket support claim.
7. The least coupled research direction is a media-kind-specific controller that can expose standard output tracks and explicit readiness/ownership, with thin React bindings and optional application-owned transport adapters. This is a recommendation for follow-up validation, not an accepted architecture.

## Approved use cases and consumer map

| Approved journey or boundary | Consumer or handoff | What the consumer needs | Interoperability risks to test |
| --- | --- | --- | --- |
| Capture and local preview | `<video>`/`<audio>` with `srcObject` | A `MediaStream`, autoplay/user-gesture policy handled by the app, and a clear detach operation | Track add/remove and inactive-stream playback, autoplay, mute/ended, SSR-safe element assignment, and not stopping an application-owned track on detach |
| Manual crop and auto-framing | Preview plus optional future sender/recorder | A video output with declared dimensions, frame rate, latency, and whether output track identity survives configuration changes | Crop quality and aspect ratio, frame drops, timestamp continuity, replacement gaps, and sender codec/resolution limits |
| Background blur or still-image replacement | Preview, `MediaRecorder`, or future WebRTC adapter | A processed video track/stream or an explicit bypass/original path | Raw transform support, canvas fallback, origin cleanliness, worker placement, model readiness, overload, and deterministic disposal |
| Voice noise reduction | Web Audio graph, `MediaStreamAudioDestinationNode`, preview meter, recorder, or future sender | A processed audio track/stream plus readiness and bypass/failure state | AudioContext suspension, user gesture, sample rate/channel conversion, buffering latency, underruns, worklet/model loading, and context closure |
| Application-selected camera/microphone switching | Existing preview and any downstream consumers | A transaction that can acquire a replacement and attach it without leaking the old resource | `replaceTrack()` versus reacquisition, exact-device failure, temporary gaps, simultaneous resource use, stale requests, and transport renegotiation |
| Framework boundary | React 18.2/19, Strict Mode, hydrated SSR, and non-React callers | Browser objects created outside render, client-only setup, stable snapshots/subscriptions, explicit controller lifetime | Effects run only on the client but Strict Mode performs a setup/cleanup stress cycle; accidental duplicate capture or premature disposal; server/client snapshot mismatch |

The source-of-truth output should remain a browser media object wherever possible. Application code can attach it to a local preview or choose a downstream consumer without requiring the capture/effects package to own a room, signaling channel, recording file, or UI component.

## Consumer contracts

### HTML media elements and local preview

`HTMLMediaElement.srcObject` accepts a `MediaStream` directly. A preview can therefore use `video.srcObject = outputStream`, then clear the property on detach. Older browser fallbacks may require an object URL, which adds URL revocation and a second cleanup path; this is a compatibility fallback rather than the preferred contract.

The Media Capture specification says consumers must handle tracks being added and removed, but the details are consumer-specific. A media element sourced from a stream can become playback-ended when the stream becomes inactive after being active. Adding tracks later does not necessarily resume playback unless autoplay is enabled or the app calls `play()` again. A controller should therefore either maintain a stable output track or expose output replacement as an observable event and leave media-element reattachment/replay to the adapter.

Preview is not ownership transfer. Assigning a stream to `srcObject` does not make the element the owner of its tracks. Detaching should set `srcObject = null`; only the layer that acquired or created a track should stop it. A shared preview must not stop an input still used by a recorder, processor, or transport.

### WebRTC peer connections

`RTCPeerConnection.addTrack(track, stream)` creates sender/transceiver state and causes negotiation. `RTCRtpSender.replaceTrack(nextTrack)` changes the sender's current source without renegotiation in the normal case, and the specification describes a seamless switch when the operation succeeds. The replacement must have the same media kind. It can fail with `InvalidModificationError` when the replacement would require negotiation and with `InvalidStateError` when the sender/transceiver is stopped.

The replacement cases called out by the standards include a resolution outside negotiated bounds, a frame rate that exceeds codec block rate, a video track changing raw versus pre-encoded form, an audio track changing channel count, or a source that cannot produce the negotiated codec. A replacement processor should preserve kind and make output dimensions, frame rate, raw/pre-encoded form, codec implications, and channel layout visible enough for an adapter to decide whether to replace, renegotiate, or bypass. The media library must not claim that changing an effect is transport-transparent.

The remote peer generally retains one receiver track when the sender uses `replaceTrack`; track IDs are not a sender/receiver identity map. Conversely, adding another transceiver can produce another remote track. A downstream adapter should keep sender identity and publication ownership separate from the library's processed-track identity.

When an input is muted or disabled, WebRTC sends zero-information content (silence for audio and black frames for video) while the track remains live. An application that needs to stop sending must use sender/ transceiver operations or `replaceTrack(null)` as appropriate; stopping a library-owned source track is not equivalent to an application-level unpublish policy.

### MediaRecorder

`MediaRecorder` receives a `MediaStream` and emits encoded `Blob` chunks through `dataavailable`. The recording specification permits recording until `stop()` or until all tracks in the input stream end. It also identifies adding or removing tracks from the stream during recording as a modification that can make recording impossible and cause an error.

The safe handoff pattern is to start a recording session with a stable output stream and keep its track set fixed. If a processor or device must be replaced, the application-owned recording adapter should either stop/finalize the current recorder before switching or create a new recording session. `MediaRecorder.isTypeSupported()` and actual constructor/start errors remain runtime checks; output MIME and codec are browser-dependent.

Cleanup ordering matters: stop the recorder and collect the final `dataavailable` event before stopping the output tracks, then release the stream/processor resources. A library should not silently retain a recorder or file buffer merely because a preview consumer remains attached.

### Canvas capture and rendered-output fallback

`HTMLCanvasElement.captureStream(frameRate)` returns a stream with one `CanvasCaptureMediaStreamTrack`. A non-zero rate requests periodic capture; rate `0` requires explicit `requestFrame()`. Capture is limited to an origin-clean canvas and throws `SecurityError` otherwise. The output is video only and follows canvas paint timing, so it is a useful video fallback but not a general replacement for raw track processing.

A media element capture stream has additional semantics: tracks can become muted when playback is paused, content is unavailable, or content becomes inaccessible to the origin; a muted video capture may retain the last frame while audio capture emits silence. It does not mirror the element's volume or hidden/visible rendering state. A rendered-output adapter must document these differences from camera tracks.

The principal costs are an extra render/copy path, main-thread scheduling unless the chosen canvas path is moved, output latency, and possible visual quality changes. It is more broadly available than raw track transforms in the observed target matrix, but it must be measured against the product latency and frame-rate hypotheses rather than assumed equivalent.

### Web Audio and audio destinations

The standard graph is `MediaStreamAudioSourceNode` -> processing nodes or `AudioWorkletNode` -> `MediaStreamAudioDestinationNode`. The destination node exposes a new `MediaStream` with an audio track that can be attached to a recorder, a peer connection, or another consumer. This makes it a practical transport-neutral output boundary for processed audio.

The `AudioContext` is a resource with a real lifecycle. `resume()`/`suspend()` and `close()` have different semantics; closing releases resources and is not reversible. User-gesture policies can leave a context suspended, and worklet/model startup is asynchronous. The context sample rate, channel count, render quantum, buffering, and device interruption behavior can change latency and quality. The output contract should expose readiness, bypass/degraded behavior, actual settings, and errors instead of presenting the destination track as immediately equivalent to the microphone track.

The WorkAdventure noise-suppression reference demonstrates a concrete handoff: a 16 kHz mono `AudioContext`, an `AudioWorklet`, `bypassUntilReady`, a destination stream track, and explicit cleanup of the worklet, source, input/output tracks, and context. It also shows that the caller can use `addTrack()` or `replaceTrack()` without the processor owning signaling. Its explicit ownership is useful evidence, but the package's low adoption and model/runtime assumptions mean it is a reference pattern rather than a selection.

### React and other framework boundaries

React requires render to remain pure; browser side effects belong in event handlers or effects. Effects run only on the client and development Strict Mode deliberately runs an extra setup/cleanup cycle. A capture/effect controller therefore should not be created during render or keyed directly to every transient object identity produced by a render. A stale request must be ignored and any late-arriving stream stopped if the controller has been disposed or superseded.

React's `useSyncExternalStore` is the official bridge for mutable browser APIs or non-React stores. It requires a stable `subscribe`/`getSnapshot`, and an optional `getServerSnapshot` for SSR/hydration. A framework-neutral controller plus a thin hook can keep media resource identity, cancellation, and cleanup outside React while exposing immutable state snapshots. This is a candidate boundary, not a required API shape.

Any framework adapter should keep these responsibilities separate:

- render: read a stable state snapshot and render application-owned UI;
- user action or client effect: acquire media, attach outputs, and start processors;
- controller: serialize or cancel requests, own resources, emit state, and dispose idempotently;
- consumer adapter: assign `srcObject`, call `replaceTrack`/negotiation, start/stop recording, or attach an audio graph;
- application: decide whether to publish, record, save, display, or transfer ownership.

## Track lifecycle, replacement, sharing, timestamps, and ownership

### Track state semantics

The browser distinguishes these dimensions:

| State or operation | Meaning | Observable output | Contract implication |
| --- | --- | --- | --- |
| `muted` / `mute` / `unmute` | The source is temporarily unable to provide data; the state is controlled by the user agent/source | No live samples; consumers receive zero-information content | Treat as degraded or interrupted, not as permanent disposal; listen for unmute and test device/OS interruption |
| `enabled = false` | Application-controlled suppression while the track remains live | Silence or black frames | Safe for user mute/pause, but it does not release the camera/microphone or necessarily stop a sender |
| `readyState = ended` from source failure or revocation | Terminal source failure; it cannot become live again | No future media; `ended` event is fired for non-`stop()` endings | Replace/reacquire or bypass explicitly; do not silently reuse the object |
| `stop()` | Application ends this track object | `readyState` becomes `ended`; no `ended` event is fired for this call | The owner must call it during cleanup; a shared source may continue while other tracks depend on it |
| `clone()` | New track object over the same source with a distinct ID and independent constraints | Both tracks can feed separate consumers | Cloning is not an ownership transfer; stopping one clone need not stop the source or other clones |

The source can be shared across tracks and consumers. A `MediaStream` can be composed from tracks from different streams, and a stream can be attached to multiple consumers. Automatic cloning is therefore not a safe default: it can multiply tracks and resource accounting, while failing to solve whether the library or application owns the shared source.

### Replacement and renegotiation

There are three distinct replacement operations:

1. Replace a track inside a `MediaStream` or create a new stream. This affects stream consumers according to their own track-set rules; a recorder may fail on a track-set mutation while a preview can continue or end playback.
2. Replace a sender's track with `RTCRtpSender.replaceTrack()`. This is asynchronous and usually avoids SDP renegotiation, but it can reject for media-kind, negotiated envelope, codec, raw/pre-encoded, frame-rate, or channel-layout reasons.
3. Add/remove a WebRTC transceiver, change direction, or publish/unpublish in a transport SDK. These are signaling/transport lifecycle operations and are outside this local-effects package.

For a device/effect switch where continuity matters, acquiring the replacement before releasing the old track reduces gaps but temporarily doubles resource use and can trigger permission/device contention. Releasing first is simpler but creates a visible gap and makes downstream replacement more likely to race an ended track. Both are alternatives for the user; neither is accepted by this task.

### Timestamps and synchronization

`MediaStreamTrack` itself does not expose a universal timestamp. Raw video and audio frames exposed by WebCodecs carry microsecond `timestamp` and optional `duration`; `VideoFrame` metadata may include an RTP timestamp for WebRTC-originated frames, but this is optional and not a cross-source clock. Frames must be closed promptly; cloning can share the underlying media resource while `close()` releases a reference.

The Media Capture Transform draft permits bounded queues and dropping the oldest frame when a processor falls behind. A transform should preserve input timestamp/duration when producing a corresponding output frame unless a deliberate re-timing operation is being performed. Dropping stale video is usually preferable to unbounded latency, but the selected policy must be measured.

Audio graphs use an `AudioContext.currentTime` clock and fixed render quanta, while video output may follow capture timestamps, canvas paint timing, or encoder timing. A `MediaStream` containing separate processed audio/video tracks does not by itself guarantee lip-sync after independent buffering. A future experiment should record source timestamp, processing completion, output presentation, recorder chunks, and sender stats; no cross-browser sync promise should be inferred from object identity alone.

### Ownership and transfer matrix

| Resource | Candidate owner | Safe default on consumer detach | Safe default on controller dispose | Open question requiring approval |
| --- | --- | --- | --- | --- |
| Application-supplied input track/stream | Application/borrowed | Detach only; do not stop | Detach only unless explicitly adopted | Whether to support an explicit `adopt`/transfer operation |
| Track acquired by the library | Library | Keep alive if another library consumer remains | Stop all owned tracks and release device | Whether a caller can take ownership of a returned capture stream |
| Processor output track/stream | Library until handed off, or application after explicit transfer | Stop/detach according to the declared owner | Stop output, close processor, release frames/workers/graphs | Whether returning a standard track implicitly transfers ownership |
| `AudioContext`, `AudioWorkletNode`, and graph | Processor/controller | Disconnect only if shared | Disconnect nodes and close context exactly once | Whether an application may share its context or must supply one |
| Worker, model/Wasm/worklet asset | Processor/controller or application loader | Cancel stale work | Terminate worker, close frame resources, cancel loads | Asset URL and cache ownership, including CSP/CORS and isolation requirements |
| Preview/recorder/sender adapter | Application or dedicated adapter | Remove listeners and detach references | Stop/finalize its consumer before owned output stops | Whether transport adapters belong in this package or a separate package |

## Compatibility, fallback, performance, and cleanup matrix

| Output path | Interoperability | Browser/support gap | Performance cost | Cleanup responsibility and fallback |
| --- | --- | --- | --- | --- |
| `MediaStreamTrackProcessor` + generator | Direct standard track output to preview, WebRTC, recorder, or other stream consumers | Current draft is worker-oriented; Window exposure and audio are unsettled. Local Chrome/Firefox observations differ by context and constructor name | Efficient frame access is possible, but worker startup, frame transfer, queue drops, GPU memory, and `VideoFrame.close()` matter | Cancel readable/writable streams, close every frame, stop generated tracks, terminate worker; fall back to canvas or original track when unsupported |
| Canvas/rendered-output capture | Standard video track, easy to attach to preview/sender/recorder | Origin-clean requirement; video only; follows paint/capture rate; no raw audio | Main-thread draw/copy and added latency; may reduce quality or frame rate | Stop capture track, cancel paint loop, release canvas/bitmap resources; bypass to original video or expose degraded state |
| Web Audio + `AudioWorklet` + destination | Standard audio track usable by recorder or WebRTC; graph can be composed | Context suspension/gesture/interruption, sample-rate/channel constraints, worklet and asset URL/CSP issues | Render-quantum buffering, model/worklet startup, CPU and possible underruns | Disconnect nodes, dispose worklet, stop destination/output and owned input tracks, close context; bypass to original audio while ready or on failure if approved |
| WebCodecs/`VideoFrame` or `AudioData` custom pipeline | Fine-grained frames and transfer to workers/encoders | Codec configuration and browser exposure vary; raw frames do not automatically become a `MediaStreamTrack` | Copies/transfer, codec startup, CPU/GPU memory, prompt close obligations | Close/transfer all frames and chunks, flush/reset encoders, terminate workers; reinject via a supported generator/canvas path or expose raw frames only as an advanced API |
| Opaque processor/consumer handle | Maximum implementation freedom | Each consumer needs a bespoke adapter; cannot be passed to browser APIs directly | May avoid unnecessary copies, but hides scheduling and backpressure | Handle owns everything by default; application cannot safely integrate without more APIs; use only if standard output is impossible |

The accepted product quality hypotheses in doc-1 require actual measurements of source-to-preview latency, frame/audio rate, warm initialization, CPU/memory stability, and deterministic cleanup. Interface presence is not a performance result. The priority experiments are TASK-1.4 for video output paths and TASK-1.5 for audio graph/processor paths; this report supplies their interoperability dimensions but does not preselect a path.

## Representative implementation comparison

The selection intentionally spans a small React capture wrapper, transport-owned React SDKs, a processor package with browser fallback, and a transport-neutral audio reference. License, stars, commit counts, and issue/release activity are dated directional maintenance signals, not quality or security certifications.

| Project | Handoff/transport pattern | License and maintenance snapshot (2026-08-16) | Selection rationale and tradeoff |
| --- | --- | --- | --- |
| [react-webcam](https://github.com/mozmorris/react-webcam) | React component calls `getUserMedia`, exposes the acquired `MediaStream` through callbacks/ref behavior, and documents recording through MediaRecorder. It is preview/capture-oriented rather than processor/transport-oriented. | MIT; GitHub showed about 1.8k stars, 382 commits, 61 issues, and 4 pull requests. | Useful minimal baseline and ergonomic counterexample: familiar JSX and direct stream handoff, but implicit ownership, small state vocabulary, and no processor or sender replacement contract. |
| [Daily React](https://github.com/daily-co/daily-react) plus [Daily JS](https://github.com/daily-co/daily-js) | `DailyProvider`/hooks wrap a call object that owns transport and device lifecycle. Daily's richer device APIs and custom input-track support are useful, but output is primarily a transport-owned publication rather than a standalone processed track contract. | BSD-2-Clause; daily-react showed 524 commits and 2 issues; daily-js showed 3,038 commits, 36 issues, and 14 pull requests. | Strong lifecycle/provider precedent and evidence that Strict Mode and instance destruction need explicit handling. It is not a local-effects API because room/signaling/transport state expands scope. |
| [LiveKit client SDK](https://github.com/livekit/client-sdk-js) plus [track-processors-js](https://github.com/livekit/track-processors-js) | A `LocalTrack` can install a processor, switch/disable it, replace its underlying track, and publish through a Room. The processor package supports background effects and Web Audio processors; its docs describe modern raw-track plumbing with a `canvas.captureStream()` fallback. | Apache-2.0; client SDK showed 1,768 commits, 646 stars, 32 issues, and 30 pull requests; processors showed 120 commits, 26 forks, 4 issues, and 4 pull requests. | Best direct precedent for an output track that remains compatible with a transport and for explicit browser support checks/passthrough mode. The tradeoff is strong coupling to LiveKit track/publication semantics and a processor compatibility surface this project must not inherit accidentally. |
| [WorkAdventure noise-suppression](https://github.com/workadventure/noise-suppression) | Creates an AudioWorklet graph and `MediaStreamAudioDestinationNode`, returns a processed audio track after `ready`, supports `bypassUntilReady`, and leaves `addTrack`/`replaceTrack` to the caller. It documents explicit disposal of worklet, graph, tracks, and context. | MIT; GitHub showed 56 commits, 6 stars, 0 forks, and 0 pull requests. | Best concrete transport-neutral audio handoff example, including readiness and bypass. Low adoption, model/runtime constraints (16 kHz mono), and package-specific asset/CSP/isolation behavior require independent validation. |
| [MediaPipe Tasks Vision](https://github.com/google-ai-edge/mediapipe) | Caller supplies frames and timestamps to model-backed detectors/segmenters; it does not own capture, React state, or standard output-track handoff. | Apache-2.0 repository; model/runtime and asset terms must be checked separately. | Useful lower-level boundary for understanding caller-owned timestamps, model/Wasm assets, and worker placement. It demonstrates why a first-party effect API should hide raw model tensors while making readiness and scheduling observable. |

The comparison supports reusing patterns, not selecting a dependency. The most portable pieces are standard track output, explicit processor readiness, passthrough/bypass, browser feature checks, and a caller-visible dispose contract. Transport-owned room state, hidden publication lifecycle, and generic raw-frame promises should not be imported merely because they exist in prior art.

## Approval-bound alternatives and tradeoffs

No significant choice is accepted by this spike. The following alternatives are ready for user review and should be converted into a Decision or a follow-up contract only after explicit approval.

### Output shape

1. **Standard output track/stream**: strongest interoperability with previews, WebRTC adapters, recording, canvas, and Web Audio; requires explicit ownership, readiness, replacement, and browser fallback semantics.
2. **Opaque effect/consumer handle**: simpler internal resource control and freedom to change pipelines; forces every consumer through a bespoke adapter and weakens the accepted standards-based composition principle.
3. **Both standard output and semantic handle**: broadest utility and observability; increases API surface, lifecycle combinations, and test burden.

Research recommendation: validate standard output first, with a semantic state/handle alongside it, without committing to names or ownership defaults.

### Output replacement

1. **Stable track identity with per-consumer replacement adapters**: can reduce preview/transport churn, but requires in-place processing or a sender-specific `replaceTrack` transaction and does not solve MediaRecorder track-set rules.
2. **New stream/track per effect or device change**: simple and honest about pipeline changes, but every consumer must detach and reattach; recorder sessions may need to restart.
3. **Stable semantic output object that emits track changes**: keeps controller identity stable, but makes consumer event ordering and stale-reference handling part of the public contract.

Research recommendation: test stable semantic identity plus explicit output-change events against a stable-track implementation in TASK-1.4/1.5; do not assume one identity strategy works for all consumers.

### Ownership and sharing

1. **Borrowed by default for supplied inputs, owned by default for acquired/created outputs**: avoids stopping caller resources and makes cleanup deterministic; requires explicit adoption/transfer when the caller wants the library to stop an input.
2. **Transfer ownership when a track is returned**: simple handoff language; a preview, recorder, or transport can unexpectedly stop a resource still used by another consumer.
3. **Automatic cloning/reference counting**: convenient multi-consumer behavior; hidden clones can retain camera/microphone resources and make stop semantics difficult to explain.

Research recommendation: require explicit owned/borrowed/adopted metadata in experiments and never infer ownership from `srcObject`, `addTrack`, or a React unmount.

### Transport boundary

1. **No transport dependency; application-owned adapters**: respects the accepted non-goal and keeps outputs useful for any future transport; asks the application to handle sender replacement, negotiation, and publication.
2. **Optional adapter package for WebRTC/recording**: can centralize tested handoff behavior without making the core depend on transport; increases package/version and compatibility surface.
3. **Direct transport integration in the core**: convenient for one ecosystem; expands scope into signaling/publication/reconnect/autoplay and makes local effect lifecycle harder to reason about.

Research recommendation: keep the core transport-neutral and reserve any WebRTC/recording adapter for a separately approved scope.

### Fallback and failure policy

1. **Bypass to original media while a processor loads or fails**: preserves continuity and matches the audio reference's `bypassUntilReady`; may briefly expose unprocessed media and can be unsuitable for an application that requires the effect.
2. **Buffer until processed output is ready**: avoids unprocessed leakage; increases startup latency and memory pressure, and can produce a visible/audio gap.
3. **Fail closed with silence/black or no output**: strongest effect guarantee; harms usability and can hide recoverable capability gaps.

Research recommendation: make bypass/degraded behavior explicit per effect and let the application choose where product policy matters; never silently fall back to another camera or microphone.

## Follow-up experiments and handoff requirements

This report does not create or update other tasks. Existing tasks already cover the next evidence work:

- TASK-1.4 should run video output experiments across raw track transforms, canvas/rendered output, and any viable frame/codec paths; record frame drops, timestamps, source-to-preview latency, output replacement behavior, and cleanup in Chrome, Edge, Firefox, and Safari or mark unknown with a reason.
- TASK-1.5 should run audio graph experiments with sample-rate/channel fixtures, AudioContext suspension/resume, worklet/model startup, bypass, underruns, sender/recorder handoff, and context/track cleanup.
- TASK-1.7 should turn the approved output/ownership observations into a public lifecycle contract only after user approval.
- TASK-1.8 should state browser and distribution requirements for worker/worklet/model assets, CSP/CORS, secure context, Permissions Policy, and any cross-origin isolation dependency only after feasibility evidence.

Required invariants for those experiments:

1. A late stream or processor result after cancellation/disposal is stopped or closed and never attached to a stale consumer.
2. The library stops only resources it owns; detaching a preview or adapter does not stop a borrowed input.
3. Every output replacement reports old/new identity, readiness, reason, and whether a gap or renegotiation is required.
4. Every frame object is closed or transferred exactly once, every audio graph is disconnected/closed exactly once, and every owned track is stopped exactly once (idempotently).
5. Browser capability checks cover both Window and DedicatedWorker contexts, exact browser build, secure context, and fallback result; constructor presence alone is not a support claim.

## Acceptance-criteria evidence map

| Criterion | Evidence in this report |
| --- | --- |
| #1 Approved use cases map to relevant consumers | The approved-use-case map covers preview, future WebRTC sender, MediaRecorder, canvas, Web Audio, device switching, and React/SSR boundaries. |
| #2 Replacement, renegotiation, cloning/sharing, mute/ended, timestamps, sync, and ownership evaluated | Consumer sections and the lifecycle/ownership sections distinguish stream replacement, sender `replaceTrack`, recorder track-set changes, clone/source sharing, state events, raw frame timestamps, cross-clock sync, and owned/borrowed resources. |
| #3 Compatibility, fallback, performance, and cleanup documented | The compatibility matrix covers raw transforms, canvas, Web Audio, WebCodecs, and opaque handles; local TASK-1.2 observations and primary W3C/MDN/React/vendor sources are linked; costs and cleanup are explicit. |
| #4 Existing libraries compared with rationale, license, maintenance context | The comparison includes react-webcam, Daily React/Daily JS, LiveKit client/processors, WorkAdventure noise suppression, and MediaPipe with handoff pattern, license, dated repository signals, and selection rationale. |
| #5 Alternatives presented without accepting decisions | Approval-bound alternatives are listed for output, replacement, ownership, transport, and fallback; no Backlog Decision was created and no architecture/public API/compatibility choice is stated as accepted. |

## Primary sources and dated observations

Browser standards and framework sources:

- [W3C Media Capture and Streams](https://www.w3.org/TR/mediacapture-streams/): stream consumers, track sets, clone/stop, mute/enabled/ended state, source sharing, and cleanup.
- [W3C WebRTC 1.0](https://www.w3.org/TR/webrtc/): sender/transceiver model, `replaceTrack`, no-renegotiation behavior, negotiated replacement limits, and remote receiver identity.
- [W3C Media Capture Transform](https://www.w3.org/TR/mediacapture-transform/): worker exposure status, bounded frame queues, drop behavior, generator output, and frame closure.
- [W3C Media Capture from DOM Elements](https://www.w3.org/TR/mediacapture-fromelement/): media-element and canvas capture, origin cleanliness, mute behavior, and frame requests.
- [W3C MediaStream Recording](https://www.w3.org/TR/mediastream-recording/): recorder input, finalization, `dataavailable`, and track-set modification failure.
- [W3C Web Audio API 1.1](https://www.w3.org/TR/webaudio-1.1/): graph output and `MediaStreamAudioDestinationNode`.
- [W3C WebCodecs](https://www.w3.org/TR/webcodecs/): raw frame timestamps, transfer/reference counting, `clone`, and `close`.
- [MDN `HTMLMediaElement.srcObject`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/srcObject), [`RTCRtpSender.replaceTrack`](https://developer.mozilla.org/en-US/docs/Web/API/RTCRtpSender/replaceTrack), [`MediaStreamTrack.clone`](https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack/clone), [`MediaStreamTrack.stop`](https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack/stop), [`MediaRecorder`](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder), [`HTMLCanvasElement.captureStream`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/captureStream), and [`AudioContext.createMediaStreamDestination`](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/createMediaStreamDestination).
- [React `useEffect`](https://react.dev/reference/react/useEffect), [React `useSyncExternalStore`](https://react.dev/reference/react/useSyncExternalStore), and [React purity rules](https://react.dev/reference/rules/components-and-hooks-must-be-pure): client-only effects, Strict Mode setup/cleanup, SSR snapshots, and render purity.

Representative implementations:

- [react-webcam](https://github.com/mozmorris/react-webcam) (MIT; direct `MediaStream` callback/ref handoff).
- [Daily React](https://github.com/daily-co/daily-react) and [Daily JS](https://github.com/daily-co/daily-js) (BSD-2-Clause; provider/call-object/device lifecycle).
- [LiveKit client SDK](https://github.com/livekit/client-sdk-js) and [track processors](https://github.com/livekit/track-processors-js) (Apache-2.0; `LocalTrack` processors, passthrough, and transport publication).
- [LiveKit video processor documentation](https://github.com/livekit/track-processors-js/blob/main/processor-docs/video-processors.md) (raw track transform with `canvas.captureStream()` fallback and switch-without-artifact guidance).
- [WorkAdventure noise suppression](https://github.com/workadventure/noise-suppression) (MIT; AudioWorklet, destination stream, `ready`, bypass, and explicit disposal).
- [MediaPipe repository](https://github.com/google-ai-edge/mediapipe) and [Image Segmenter web guide](https://developers.google.com/edge/mediapipe/solutions/vision/image_segmenter/web_js) (Apache-2.0 repository; caller-driven frames/model assets; inspect model/runtime terms separately).

Local reproducible observation carried forward from TASK-1.2 (2026-08-16): Chrome 151.0.7922.137 on secure loopback exposed `MediaStreamTrackProcessor` and legacy `MediaStreamTrackGenerator` in Window but not `VideoTrackGenerator`; the same Chrome binary exposed none of those tested raw-track transform constructors in a DedicatedWorker. Firefox 153.0.3 exposed none of the tested raw-track transform constructors in Window or DedicatedWorker. Edge and Safari were not installed in this worktree, so their results remain unknown. These observations are version/context-specific and are not release-wide support claims.
