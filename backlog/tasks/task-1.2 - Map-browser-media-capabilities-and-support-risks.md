---
id: TASK-1.2
title: Map browser media capabilities and support risks
status: Done
assignee:
  - '@codex'
created_date: '2026-08-13 20:31'
updated_date: '2026-08-16 08:16'
labels: []
dependencies:
  - TASK-1.1
parent_task_id: TASK-1
priority: high
type: spike
ordinal: 3000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Establish an evidence-backed map of the browser APIs, security constraints, compatibility gaps, and fallback choices relevant to the scoped journeys. This is research, not a selection of a production architecture.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A dated target-browser and execution-context matrix covers capture plus candidate video and audio processing capabilities
- [x] #2 Permission, secure-context, device-change, background-tab, and resource-lifecycle constraints are documented
- [x] #3 Material compatibility gaps and possible fallback categories are identified without committing to a framework or processing technology
- [x] #4 Each important claim links to a primary source or reproducible observation
- [x] #5 Potential follow-up work is presented to the user with its rationale, priority, dependencies, and measurable exit criteria; after explicit user approval, each approved item is deduplicated against existing work, created or updated through the Backlog CLI, and linked to the relevant tasks
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Establish the evidence boundary from the accepted product contract and inspect existing related tasks without modifying them.
2. Build a dated target-browser and execution-context matrix for capture plus candidate video/audio processing capabilities using primary specifications, vendor documentation, and reproducible observations.
3. Document permission, secure-context, device-change, background/lifecycle, security, and resource-ownership constraints, including material compatibility gaps and fallback categories without selecting a production technology.
4. Propose non-created follow-up work with rationale, priority, dependencies, and measurable exit criteria; deduplicate only if the user explicitly approves creation or updates.
5. Verify every acceptance criterion, run repository checks, record evidence and results in TASK-1.2, and finalize only this task.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Evidence boundary and refresh date

This research was refreshed on 2026-08-16 after the local APT upgrade. The evidence boundary remains the accepted decision-1 and product document doc-1 initial compatibility hypothesis: React 18.2 and 19, modern evergreen desktop Chrome, Edge, Firefox, and Safari, client-rendered or hydrated SSR, development Strict Mode, browser-only capture and processing after hydration and explicit user action, and mobile as feasibility input rather than an initial support guarantee. React Native, Node, legacy browsers, cloud processing, telemetry, and a final public API or runtime architecture are out of scope. This spike records alternatives and risks; it does not select a framework, processing runtime, worker strategy, acceleration backend, or transform order.

## Dated target-browser and execution-context matrix

The local observations below are dated 2026-08-16 and are environment-specific. An interface being present is not evidence that a particular codec, device, GPU adapter, throughput target, permission state, or lifecycle behavior is usable.

| Target browser and context | Capture observations | Candidate video observations | Candidate audio observations | Evidence and support posture |
| --- | --- | --- | --- | --- |
| Chrome 151.0.7922.137, Linux headless, http://127.0.0.1:8765/ loopback | isSecureContext, mediaDevices, getUserMedia, enumerateDevices, devicechange, MediaStream, MediaStreamTrack, and track.stop were present | Window: MediaStreamTrackProcessor=true, legacy MediaStreamTrackGenerator=true, current VideoTrackGenerator=false, VideoFrame, VideoEncoder, VideoDecoder, OffscreenCanvas, canvas/media captureStream, WebGL2, and navigator.gpu interface present | AudioContext, AudioWorkletNode, AudioWorklet, AudioData, AudioEncoder, and AudioDecoder present | Reproducible local observation only. The probe used --headless=new --no-sandbox --disable-gpu; WebGL2 being true here reflects software/headless behavior, not a hardware GPU guarantee. navigator.gpu=true is interface presence only; no adapter was requested. |
| Chrome 151 DedicatedWorker, same origin | Worker feature probe returned MediaStreamTrackProcessor=undefined, MediaStreamTrackGenerator=undefined, VideoTrackGenerator=undefined; VideoFrame, AudioData, and VideoEncoder were functions | Worker raw track transform exposure must be treated as a version and context risk even though the Window names were present | Worker WebCodecs raw data and codec constructor exposure was present in the probe; actual codec configuration still needs testing | Local observation under the same Chrome binary. Verify both Window and worker contexts in the feasibility spikes rather than inferring worker support from Window support. |
| Firefox 153.0.3, Linux headless, same secure loopback | The same secure-context and capture interface probes were present | Window: MediaStreamTrackProcessor=false, MediaStreamTrackGenerator=false, VideoTrackGenerator=false; VideoFrame, VideoEncoder, VideoDecoder, OffscreenCanvas, canvas/media captureStream, and WebGL2 were present; navigator.gpu=false | AudioContext, AudioWorkletNode, AudioWorklet, AudioData, AudioEncoder, and AudioDecoder were present | Reproducible local observation only. The absence of raw track transform constructors is a material compatibility gap, not a conclusion that all video processing is impossible. Firefox Bug 1749532 tracks the missing MediaStreamTrackProcessor support. |
| Firefox 153 DedicatedWorker, same origin | Worker probe returned MediaStreamTrackProcessor=undefined, MediaStreamTrackGenerator=undefined, VideoTrackGenerator=undefined; VideoFrame, AudioData, and VideoEncoder were functions | Current raw track transform path is unavailable in this tested worker context | WebCodecs raw data and codec constructor exposure was present; actual encode/decode support remains configuration-dependent | Local observation. Do not promote this result to all Firefox releases without rerunning the probe. |
| Chromium Edge desktop target | No Edge binary is installed in this Linux worktree, so no local result is claimed | Chromium family similarity is not sufficient evidence for Edge support; repeat the Window/Worker and codec probes on the supported Edge release | Repeat the same audio and lifecycle probes | Unverified target. TASK-1.6 should capture the exact Edge version, OS, flags, device, and context. |
| Safari/WebKit desktop and iOS target | No Safari runner is available in this Linux worktree, so no local result is claimed | WebKit Safari 26.4 notes include a fix for MediaStreamTrackProcessor honoring track.enabled=false; Safari 26.0 notes add WebCodecs AudioEncoder and AudioDecoder; these release notes show active compatibility change, not a blanket support guarantee | Safari 26.0 WebCodecs audio additions and Safari 26.4 AudioData.copyTo crash fix make raw audio behavior release-sensitive | Verify on the exact macOS and iOS Safari builds. WebKit 26.5 release notes were published 2026-05-11, but the local environment cannot validate that release. |
| Android Chrome and other mobile contexts | Mobile is feasibility input under doc-1, not an initial guarantee; no device was available for this probe | Test thermal throttling, background transitions, memory pressure, frame drops, codec combinations, and permission/device changes on real hardware | Test audio suspension, glitches, sample-rate/channel behavior, interruption, and cleanup on real hardware | Do not infer mobile support from Linux desktop headless observations. |

### Execution-context coverage

| Context | Required baseline or risk |
| --- | --- |
| Top-level HTTPS or loopback | Capture APIs and several processing APIs are secure-context gated. isSecureContext and each constructor or method still require runtime checks. |
| Cross-origin iframe | Camera and microphone are controlled by Permissions Policy. The embedding policy and iframe allow configuration must be part of the test fixture; a top-level success does not prove embedded success. |
| SSR, pre-hydration, and import time | Browser globals and permission prompts must not be required during server rendering or module import. Capture and processing begin only after hydration and explicit user action under doc-1. |
| Window versus DedicatedWorker | The current Media Capture Transform specification exposes different objects by context, and local Chrome 151 exposes the legacy transform names in Window but none of the tested transform constructors in DedicatedWorker. Worker support must be probed, not inferred. |
| Cross-origin isolated worker | SharedArrayBuffer and threaded Wasm paths require an appropriate isolation policy. COOP or COEP can affect third-party embeds and OAuth, so this is a compatibility option with integration cost, not a default architecture decision. |
| Hidden, frozen, or discarded page | Visibility and Page Lifecycle state can throttle, suspend, freeze, or discard work. A hidden-page result is not a realtime processing guarantee. |

## Capability map and constraints

### Capture APIs and permission behavior

- MediaDevices.getUserMedia is available only in a secure context, requests user permission, and can remain pending if the user does not respond. The implementation needs an explicit pending state and a cancellation or unmount policy rather than assuming the promise settles quickly. Relevant errors include NotAllowedError, NotFoundError, OverconstrainedError, and InvalidStateError. Source: https://www.w3.org/TR/mediacapture-streams/
- Camera and microphone are controlled by Permissions Policy. The default allowlist is self, so an embedded consumer needs an appropriate HTTP policy and iframe allow configuration. A top-level success does not prove iframe success. Source: https://www.w3.org/TR/mediacapture-streams/ and https://www.w3.org/TR/permissions-policy-1/
- enumerateDevices and device labels are privacy-sensitive. Device exposure is constrained by document activity, visibility, permission, and policy; labels become useful only after the relevant permission has been granted. Device IDs and capabilities can contribute to fingerprinting. Source: https://www.w3.org/TR/mediacapture-streams/
- devicechange indicates that the set of media input and output devices changed, but delivery can be deferred while the document is not visible. A capture layer must reconcile the device list after the event and also handle track mute and ended events, because physical disconnect, revocation, or source failure can end a track without a clean application-level selection flow. Source: https://www.w3.org/TR/mediacapture-streams/
- MediaStreamTrack.stop ends the track object; the underlying source stops only when no other track objects depend on it. Cloning therefore creates shared-source ownership questions. Authors are encouraged to stop tracks to release resources and privacy indicators. Source: https://www.w3.org/TR/mediacapture-streams/
- Permission state is not a guarantee that a subsequent getUserMedia call succeeds, and privacy indicators and user-agent permission controls remain authoritative. Capability preflight must therefore report possible, permitted, and usable as separate states. Source: https://www.w3.org/TR/mediacapture-streams/

### Candidate video processing paths

- Media Capture from DOM Elements defines HTMLCanvasElement.captureStream and HTMLMediaElement.captureStream. Canvas capture is real-time rendered output and is constrained by canvas origin cleanliness; source, playback, and track state changes can mute or end the captured track. This is a fallback category and a candidate for experiments, not a selected architecture. Source: https://www.w3.org/TR/mediacapture-fromelement/
- Media Capture Transform defines MediaStreamTrackProcessor for reading raw video frames and a generator path for writing processed frames. The current specification records DedicatedWorker exposure and lack of consensus for Window exposure and audio support; queues can drop frames, delivery depends on pending reads, and VideoFrame objects must be closed promptly. Source: https://www.w3.org/TR/mediacapture-transform/
- The current transform specification uses VideoTrackGenerator and describes writable-stream closure ending output tracks. Older Chromium implementations and vendor guidance also use MediaStreamTrackGenerator, so feature detection must distinguish the names and the execution context. Source: https://www.w3.org/TR/mediacapture-transform/ and https://developer.chrome.com/docs/web-platform/best-practices/webcodecs
- WebCodecs provides VideoFrame, AudioData, encoders, and decoders, but the specification allows an implementation to support any combination of codecs or none. Raw media objects hold reference-counted resources and should be closed promptly; transfer can avoid copies but does not remove ownership and lifecycle obligations. Sources: https://www.w3.org/TR/webcodecs/ and https://developer.chrome.com/docs/web-platform/best-practices/webcodecs
- WebGL, WebGPU, OffscreenCanvas, and Wasm are candidate execution primitives with different availability, adapter, isolation, and resource behavior. WebGPU is secure-context gated and requestAdapter can return null; GPU resources should be explicitly destroyed. No primitive is selected by this spike. Source: https://www.w3.org/TR/webgpu/ and https://www.webassembly.org/docs/portability/

### Candidate audio processing paths

- Web Audio can connect a live MediaStream to a MediaStreamAudioSourceNode and send a processed graph to a MediaStreamAudioDestinationNode. AudioWorkletNode is the current modular processing path intended for rendering-thread work; ScriptProcessorNode and AudioProcessingEvent are deprecated. Sources: https://www.w3.org/TR/webaudio-1.1/
- AudioContext has a material lifecycle cost. suspend can release some resources and pauses work; close releases resources and cannot resume; while suspended, media output can be ignored and data can be lost. Audio system errors can move a context to suspended, and AudioWorklet processor errors are observable through processorerror. Source: https://www.w3.org/TR/webaudio-1.1/
- WebCodecs AudioData, AudioEncoder, and AudioDecoder are candidate raw and codec primitives, but codec configuration, sample rate, channel layout, and hardware behavior need runtime tests. The current Media Capture Transform specification does not have consensus for audio processing, and the local Chrome and Firefox probes did not expose track transform constructors in workers. Sources: https://www.w3.org/TR/webcodecs/ and https://www.w3.org/TR/mediacapture-transform/

### Security and lifecycle constraints

- Secure Contexts gates camera, microphone, Web Audio, WebGPU, and related worker use. Feature detection should use the actual context and not assume that a development hostname, an iframe, or a worker inherits the same capability. localhost and loopback are treated as potentially trustworthy under the secure-context rules, which explains the local probe result. Source: https://www.w3.org/TR/secure-contexts/
- Page Visibility and Page Lifecycle are separate concerns. Chrome documents timer and requestAnimationFrame throttling in background tabs, and pages may be frozen or discarded without an unload callback. The lifecycle design must define what happens to capture, processing, output, and pending work when hidden, frozen, discarded, restored, or terminated. Sources: https://html.spec.whatwg.org/multipage/interaction.html#page-visibility, https://developer.chrome.com/blog/background_tabs, and https://developer.chrome.com/docs/web-platform/page-lifecycle-api
- Media Capture can defer device-related exposure and events until a document is visible or active. This makes background behavior a state transition to test, not merely a performance optimization. Source: https://www.w3.org/TR/mediacapture-streams/
- Media Capture Transform queues and WebCodecs frames create bounded-resource pressure. ReadableStream backpressure, frame dropping, prompt VideoFrame and AudioData close, generator writable closure, worker termination, and cancellation of stale asynchronous work must be measured together. Sources: https://www.w3.org/TR/mediacapture-transform/ and https://www.w3.org/TR/webcodecs/
- AudioContext, AudioWorklet ports, tracks, streams, workers, GPU objects, and canvas-backed resources each have distinct cleanup rules. The owning layer needs idempotent cleanup across mount, unmount, remount, permission denial, device loss, hidden-page transitions, processing failure, and Strict Mode development remounts. Sources: https://www.w3.org/TR/webaudio-1.1/, https://www.w3.org/TR/mediacapture-streams/, and https://www.w3.org/TR/webgpu/
- Same-origin and origin-clean rules constrain media data flow. Cross-origin VideoFrame creation can fail, and a non-origin-clean canvas cannot be captured safely. SharedArrayBuffer and threaded Wasm require cross-origin isolation; Chrome notes that COOP and COEP can affect third-party embeds and OAuth. Sources: https://www.w3.org/TR/mediacapture-transform/, https://www.w3.org/TR/mediacapture-fromelement/, https://developer.chrome.com/blog/enabling-shared-array-buffer/, and https://webassembly.org/docs/security/

## Material gaps and fallback categories

### Material compatibility and support gaps

1. API exposure is not uniform across browser versions or execution contexts. The Chrome 151 Window result uses the older MediaStreamTrackGenerator name while the current specification describes VideoTrackGenerator, and the same Chrome binary exposed none of the tested transform constructors in a DedicatedWorker. Firefox 153 exposed neither raw track transform path. This makes name-only detection and Window-only testing unsafe.
2. Capture support is conditional on secure context, Permissions Policy, document visibility and activity, permission state, and device availability. Permission granted, a successful prior call, or a non-empty device list cannot be treated as a permanent capability.
3. WebCodecs constructor presence does not guarantee a usable codec, pixel format, audio format, hardware path, or throughput. The implementation must probe configuration and handle rejection or overload.
4. Web Audio is broadly exposed in the local probes, but AudioContext suspension, audio-system errors, worklet errors, sample-rate and channel differences, and interruption behavior can change output quality and latency.
5. GPU exposure is conditional. WebGPU requestAdapter can return null, driver behavior differs, resources can exhaust GPU memory, and WebGL2 in headless software mode does not represent a production GPU. Firefox 153 had no navigator.gpu in the local probe.
6. Cross-origin isolation may be needed for some threaded Wasm or SharedArrayBuffer approaches, but COOP and COEP can break or constrain third-party embeds and OAuth. A no-isolation fallback is therefore material.
7. Canvas capture has origin-clean and rendered-output constraints. It can be a compatibility path but may add copy, latency, main-thread, and visual-quality costs.
8. Background, hidden, frozen, discarded, and mobile states can change scheduling and resource availability. A foreground desktop pass cannot establish an always-on guarantee.
9. Device unplug, browser revocation, OS interruption, and permission changes can produce mute or ended tracks and stale device lists. Recovery must be observable and idempotent.
10. Frame queues, reference-counted media objects, AudioContext resources, workers, streams, ports, and GPU objects can all leak or accumulate if ownership is unclear. Backpressure and cleanup are correctness concerns, not only performance concerns.

### Fallback categories without a technology commitment

- Preserve or return the original capture track when a requested effect is unavailable, denied, fails to initialize, or exceeds a resource budget.
- Use a rendered-output route such as canvas or media-element capture where raw track transforms are unavailable, with explicit quality, latency, origin-clean, and main-thread measurement.
- Reduce frame dimensions or frame rate, skip frames under bounded backpressure, or lower effect quality when the P0 quality hypothesis cannot be met.
- Use a CPU or Wasm path that does not require a GPU adapter or shared memory; retain a non-threaded option where cross-origin isolation is unavailable.
- Use a supported Web Audio graph and worklet category for live audio when raw audio track transforms are unavailable; if audio processing cannot remain stable, preserve the original audio or disable the effect.
- Gate each optional path with secure-context, permission-policy, constructor, codec-configuration, adapter, and resource checks. Expose a clear unavailable or degraded state instead of assuming support.
- Defer or cancel work on hidden, frozen, unmounted, or superseded requests, and reinitialize after a recoverable lifecycle transition.
- Treat asset or model loading failure as a local degraded mode; no cloud fallback is introduced because doc-1 requires local or on-device processing and no telemetry.

These are fallback categories and test dimensions only. No React framework, transform library, WebAssembly package, worker model, GPU backend, codec, or processing order is selected by TASK-1.2.

## Reproducible local observations

Date: 2026-08-16. The probe server was an ephemeral Python http.server bound to 127.0.0.1:8765 and created no repository files. Its page synchronously reported secure context, capture constructors, candidate video and audio constructors, canvas capture, WebGL2, WebGPU interface presence, workers, and SharedArrayBuffer. A second page created a same-origin DedicatedWorker and reported the constructor types inside that worker. The page sent no COOP or COEP headers, so crossOriginIsolated was false.

Version commands and results:

- google-chrome --version -> Google Chrome 151.0.7922.137
- firefox --version -> Mozilla Firefox 153.0.3
- geckodriver --version -> geckodriver 0.37.0 (2026-08-03)
- microsoft-edge and Safari binaries were unavailable in this worktree

Chrome command: google-chrome --headless=new --no-sandbox --disable-gpu --dump-dom http://127.0.0.1:8765/.
Chrome Window result: isSecureContext=true, isCrossOriginIsolated=false, mediaDevices/getUserMedia/enumerateDevices/devicechange=true, MediaStream and MediaStreamTrack=true, track.stop=true, MediaStreamTrackProcessor=true, MediaStreamTrackGenerator=true, VideoTrackGenerator=false, VideoFrame/VideoEncoder/VideoDecoder=true, AudioData/AudioEncoder/AudioDecoder=true, AudioContext/AudioWorklet=true, OffscreenCanvas/canvas capture/media capture=true, WebGL2=true, navigator.gpu=true, Worker=true, SharedArrayBuffer=false.
Chrome Worker result: MediaStreamTrackProcessor=undefined, MediaStreamTrackGenerator=undefined, VideoTrackGenerator=undefined, VideoFrame=function, AudioData=function, VideoEncoder=function.

Firefox was driven through geckodriver 0.37.0 against the same loopback page. Firefox Window result: isSecureContext=true, isCrossOriginIsolated=false, mediaDevices/getUserMedia/enumerateDevices/devicechange=true, MediaStream and MediaStreamTrack=true, track.stop=true, MediaStreamTrackProcessor/MediaStreamTrackGenerator/VideoTrackGenerator=false, VideoFrame/VideoEncoder/VideoDecoder=true, AudioData/AudioEncoder/AudioDecoder=true, AudioContext/AudioWorklet=true, OffscreenCanvas/canvas capture/media capture=true, WebGL2=true, navigator.gpu=false, Worker=true, SharedArrayBuffer=false. Firefox Worker result: MediaStreamTrackProcessor=undefined, MediaStreamTrackGenerator=undefined, VideoTrackGenerator=undefined, VideoFrame=function, AudioData=function, VideoEncoder=function.

Control observation: a Chrome data URL reported isSecureContext=false and mediaDevices=false. This is consistent with the secure-context requirement but was not used to infer behavior beyond that control. The local results are reproducible observations for these exact binaries, flags, OS, and headless contexts; they are not release-wide support claims.

## Proposed follow-up work for user approval

No follow-up task was created or updated because explicit user approval was not provided. Existing work was searched for browser, capability, and related terms; the proposals below map to existing task IDs where possible and avoid creating duplicate work.

| Existing task | Rationale | Priority and dependencies | Measurable exit criteria |
| --- | --- | --- | --- |
| TASK-1.3 Validate capture behavior across the React lifecycle | Turn the capture constraints into a lifecycle experiment covering permission pending, denial, device loss, devicechange, track mute or ended, remount, and shared ownership. | High; existing dependencies include TASK-1.1, TASK-1.2, TASK-1.13, and TASK-1.16 | For each target browser and selected Window or iframe fixture, record mount, rerender, Strict Mode remount, unmount, permission denial, device removal, mute or ended, and recovery transitions; assert no orphan tracks, listeners, streams, or pending operations after cleanup. |
| TASK-1.4 Validate browser video-processing feasibility | Measure crop, background blur or replacement, and subject framing candidates across raw track, rendered-output, WebCodecs, and CPU or GPU categories without selecting one prematurely. | High; existing dependencies include TASK-1.1, TASK-1.2, TASK-1.14, and TASK-1.17 | For a fixed 720p fixture and the documented frame-rate target, record startup, end-to-end latency, delivered and dropped frames, CPU, memory, overload behavior, quality, context exposure, and cleanup for every tested category in Chrome, Edge, Firefox, and Safari or mark the result unknown with a reason. |
| TASK-1.5 Validate browser audio-processing feasibility | Validate live voice noise-reduction candidates where Web Audio is available but raw track audio transforms are not settled. | High; existing dependencies include TASK-1.1, TASK-1.2, TASK-1.15, and TASK-1.17 | For a fixed microphone fixture and documented sample-rate and channel conditions, record startup, p50 and p95 latency, glitch counts over a fixed run, CPU, memory, overload, interruption or suspension recovery, speech quality, and cleanup for each candidate category in the target browsers. |
| TASK-1.6 Define the cross-browser verification strategy | Convert this one-time matrix into repeatable release checks and fill the missing Edge and Safari evidence. | Medium; existing task depends on the foundation spikes including TASK-1.2 | Produce a versioned probe and fixture matrix that records browser build, OS or device, flags, top-level versus iframe, secure context, permission state, Window versus Worker exposure, codec configuration, hidden-page transition, device change, and fallback result; every target row is pass, fail, or explicitly unknown with evidence. |
| TASK-1.8 Define the compatibility and distribution contract | Make browser ranges, SSR import safety, secure-context and Permissions Policy requirements, optional assets, and isolation requirements explicit before public API work. | High; existing dependencies include TASK-1.2 and TASK-1.7 | Publish a support table with minimum browser versions or an explicit feature-policy rule, SSR and hydration behavior, required headers or iframe policy, fallback behavior, and a runnable import or capability check; no supported scenario remains implied only by interface presence. |

TASK-1.13, TASK-1.14, TASK-1.15, and TASK-1.17 already cover device selection, background processing, noise reduction, and output or transport interoperability respectively. They should consume this evidence rather than be duplicated. Any new capability-harness task should first be compared with TASK-1.6 and only be created or updated after explicit approval through the Backlog CLI.

## Evidence index

The following primary specifications and browser vendor records anchor the claims above. Inline links in the capability and constraint sections identify which source supports each claim.

- Media Capture and Streams: https://www.w3.org/TR/mediacapture-streams/
- Media Capture Transform: https://www.w3.org/TR/mediacapture-transform/
- Media Capture from DOM Elements: https://www.w3.org/TR/mediacapture-fromelement/
- WebCodecs: https://www.w3.org/TR/webcodecs/
- Web Audio API 1.1: https://www.w3.org/TR/webaudio-1.1/
- WebGPU: https://www.w3.org/TR/webgpu/
- Secure Contexts: https://www.w3.org/TR/secure-contexts/
- Permissions Policy: https://www.w3.org/TR/permissions-policy-1/
- WHATWG HTML Page Visibility: https://html.spec.whatwg.org/multipage/interaction.html#page-visibility
- Chrome background-tab scheduling: https://developer.chrome.com/blog/background_tabs
- Chrome Page Lifecycle: https://developer.chrome.com/docs/web-platform/page-lifecycle-api
- Chrome WebCodecs guidance: https://developer.chrome.com/docs/web-platform/best-practices/webcodecs
- Chrome SharedArrayBuffer isolation guidance: https://developer.chrome.com/blog/enabling-shared-array-buffer/
- WebAssembly security and portability: https://webassembly.org/docs/security/ and https://webassembly.org/docs/portability/
- WebKit Safari 26.0 features: https://webkit.org/blog/17333/webkit-features-in-safari-26-0/
- WebKit Safari 26.4 features and fixes: https://webkit.org/blog/17862/webkit-features-for-safari-26-4/
- WebKit Safari 26.5 features: https://webkit.org/blog/17938/webkit-features-for-safari-26-5/
- WebKit MediaStreamTrackProcessor issue history: https://bugs.webkit.org/show_bug.cgi?id=241124
- Firefox MediaStreamTrackProcessor tracking issue: https://bugzilla.mozilla.org/show_bug.cgi?id=1749532

## Validation record

Validated on 2026-08-16 after the browser refresh:

- Reproducible probe: Chrome 151.0.7922.137 and Firefox 153.0.3 on secure loopback; Window and DedicatedWorker outputs are recorded above. Edge and Safari were explicitly left unknown because no local binaries or runner were available.
- Primary-source review: W3C Media Capture and Streams, Media Capture Transform, Media Capture from DOM Elements, WebCodecs, Web Audio 1.1, WebGPU, Secure Contexts, Permissions Policy, and WHATWG HTML; Chrome lifecycle and WebCodecs guidance; WebKit Safari notes and issue history; Firefox Bug 1749532; all are linked above.
- pnpm run backlog:dispatchable: passed; output was an empty dispatchable list because the current task is In Progress and no new worker was started.
- pnpm run validate:lifecycle: passed with Task-to-PR lifecycle policy and runbook OK.
- git diff --check: passed.
- backlog decision list --plain: decision-1 is the only accepted decision; no new architecture decision was created.
- No production source or workflow policy files were changed. The only worktree change is the TASK-1.2 task record updated through the Backlog CLI. No follow-up task was created or updated without user approval.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @codex
created: 2026-08-16 08:15
---
2026-08-16 @codex: Re-ran the capability probe after the APT upgrade. Chrome is now 151.0.7922.137; Firefox remains 153.0.3. Chrome Window exposes the legacy raw-track transform names, but the same binary did not expose the tested transform constructors in DedicatedWorker. Firefox exposes neither raw-track transform path in Window or Worker. Edge and Safari remain unverified because no local binaries or macOS runner are available. Full matrix, constraints, evidence links, fallback categories, and approval-gated follow-up proposals are in Implementation Notes.
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Completed the evidence-backed browser media capability and support-risk map, refreshed on 2026-08-16 after the APT upgrade. The task records dated Chrome 151 and Firefox 153 Window and DedicatedWorker observations, unverified Edge and Safari coverage, capture permission and secure-context rules, device-change and background lifecycle constraints, resource ownership and security risks, material compatibility gaps, and technology-neutral fallback categories. Verification used primary W3C, WHATWG, Chrome, WebKit, Firefox, and WebAssembly sources plus reproducible local probes; backlog:dispatchable, validate:lifecycle, and git diff --check passed. Existing follow-up proposals are documented with rationale, priority, dependencies, and measurable exit criteria; no follow-up task or architecture decision was created without approval.
<!-- SECTION:FINAL_SUMMARY:END -->
