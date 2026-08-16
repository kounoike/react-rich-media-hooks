---
id: doc-2
title: Public API Ecosystem Prior Art
type: specification
created_date: '2026-08-16 12:05'
updated_date: '2026-08-16 12:05'
---
# Public API Ecosystem Prior Art

Research record for TASK-1.16, reviewed 2026-08-16.

## Authority and scope

This is an evidence report, not an accepted product or architecture decision. The alternatives and API sketches below require explicit user approval before they become a public API, compatibility contract, or implementation commitment. The accepted baseline remains `decision-1` / Backlog doc-1: a headless React library for capture and first-party local media effects, with React 18.2/19, modern evergreen desktop browsers, SSR-safe import behavior, and no implicit commitment yet to a public API shape, processing backend, worker strategy, acceleration path, or transform order.

The research asks what can be learned from APIs that already solve one or more of these problems:

- acquiring and switching local media;
- representing pending, permission, device, and failure states;
- sharing ownership across React components;
- inserting video and audio processing stages;
- exposing standard `MediaStream`/`MediaStreamTrack` outputs without coupling to a transport;
- loading browser-only or model-backed assets safely in an SSR application.

The source set deliberately combines React capture wrappers, provider-based real-time SDKs, framework-neutral processing APIs, and browser standards. Adoption and maintenance figures are directional snapshots, not proof of technical quality; they should be refreshed before release decisions.

## Representative prior art

| Subject | Composition and role | License / ecosystem signal | Why it is relevant |
| --- | --- | --- | --- |
| [react-webcam](https://github.com/mozmorris/react-webcam) | React component around `getUserMedia`, with a ref-based screenshot API and low-level stream callbacks | MIT; GitHub showed about 1.8k stars and a mature commit history; the npm listing reported version 7.2.0 and substantial weekly use, but an older recent release | Smallest familiar React capture surface; useful counterexample for state, ownership, and cancellation detail |
| [Daily React](https://github.com/daily-co/daily-react) plus [Daily JS](https://www.npmjs.com/package/@daily-co/daily-js) | `DailyProvider`, `useCallObject`, `useDevices`, and an imperative call object; broad device and lifecycle state | BSD-2-Clause; Daily JS had a current release and high npm usage at review time | Shows provider/store composition, explicit device state vocabulary, Strict Mode handling, and destroy/recreate semantics |
| [LiveKit Components](https://github.com/livekit/components-js) plus [LiveKit client SDK](https://github.com/livekit/client-sdk-js) | React hooks and context over a framework-neutral room/client core; local tracks expose replacement and processor APIs | Apache-2.0; active client and component repositories with high npm usage for the client | Strongest example of hooks plus an imperative core and of a processor insertion point, while also showing how transport assumptions can expand scope |
| [LiveKit track-processors-js](https://github.com/livekit/track-processors-js) | Prebuilt video/background and audio processors installed on local tracks | Apache-2.0; smaller companion package tied to LiveKit tracks | Concrete model for processor readiness, replacement, and transport-compatible processed tracks |
| [MediaPipe Tasks Vision](https://developers.google.com/edge/mediapipe/solutions/vision/image_segmenter/web_js) | Model-backed browser APIs such as `ImageSegmenter` and `FaceDetector`; caller drives frames and timestamps | Apache-2.0 repository; the npm package showed high usage and frequent releases, with separate model/WASM/runtime concerns | Demonstrates the low-level processing boundary, worker requirement, asset loading, and synchronous-frame failure modes |
| [@ricky0123/vad](https://github.com/ricky0123/vad) and [vad-react](https://www.npmjs.com/package/@ricky0123/vad-react) | Async factory plus imperative `start`/`pause` and speech callbacks, backed by ONNX Runtime Web and an AudioWorklet | ISC React adapter; active issue/PR activity but browser/model assets are required | Audio-side example of readiness, worklet/model assets, explicit start/stop, and a thin React adapter |
| [WorkAdventure noise-suppression](https://github.com/workadventure/noise-suppression) | AudioWorklet pipeline returning a processed track with `ready` and `dispose` | MIT; low-adoption emerging project | Useful negative/edge baseline for explicit processed-track ownership and bypass-until-ready behavior |
| [Media Capture and Streams](https://w3c.github.io/mediacapture-main/), [Web Audio](https://webaudio.github.io/web-audio-api/), and [Media Capture Transform](https://w3c.github.io/mediacapture-transform/) | Browser-level contracts for capture, audio graphs, and frame transforms | Web standards; browser support varies by API | Defines the interop boundary and the compatibility costs a wrapper cannot make disappear |

## Detailed API patterns

### react-webcam: minimal wrapper, implicit lifecycle

The public surface is a component with `videoConstraints`, `audioConstraints`, `onUserMedia`, `onUserMediaError`, and a ref method such as `getScreenshot`:

```tsx
<Webcam
  audio={false}
  videoConstraints={{ deviceId: selectedDeviceId }}
  onUserMedia={handleStreamReady}
  onUserMediaError={handleCaptureError}
  ref={webcamRef}
/>
```

The implementation starts capture in `componentDidMount`, compares serialized constraints during updates, stops all tracks and reacquires when constraints change, and stops/revokes resources on unmount. It includes an SSR guard and a request sequence check: a late `getUserMedia()` result is stopped if the component was unmounted or a newer request superseded it. `getUserMedia()` itself is not abortable, so this is an important browser-compatible cancellation pattern.

The tradeoff is a deliberately small state model: readiness is effectively a boolean, errors are callback values, there is no first-class pending/permission/device-ended state, and ownership is implicit. Device selection is an application-level `enumerateDevices()` plus constraint update; there is no provider, shared store, explicit `devicechange` policy, or distinction between a library-owned and caller-owned stream. Constraint changes can create a preview gap and may stop an externally supplied/shared track if the wrapper owns cleanup by assumption. This is a good ergonomic starting point but not sufficient evidence for a rich public lifecycle contract.

### Daily: provider plus imperative lifecycle and rich device states

Daily React exposes a provider and hooks around an imperative `DailyCall` object:

```tsx
const callObject = useCallObject({ url })
return <DailyProvider callObject={callObject}>{children}</DailyProvider>
```

`useCallObject` creates and destroys the call object and explicitly handles React Strict Mode's duplicate effect lifecycle. `useDaily()` retrieves the current imperative instance. `useDevices()` returns cameras, microphones, speakers, current selections, refresh and setter functions, the last camera error, and state values such as `pending`, `granted`, `blocked`, `in-use`, `not-found`, `constraints-invalid`, and `not-supported`. The underlying `setInputDevicesAsync()` can accept a device identifier or a custom `MediaStreamTrack`, and `destroy()` releases resources and makes the object unusable.

This gives a useful vocabulary for a local-media library: asynchronous transitions are visible, device errors are not collapsed into one callback, and caller-provided tracks are a supported input. It also exposes a compatibility cost: changing provider creation props can destroy the old instance and create a new one, and a broad call object carries room/network lifecycle that is outside this task's local processing scope. The provider pattern should therefore be considered optional composition rather than the public contract itself.

### LiveKit: framework-neutral core, React context, and track processors

LiveKit's React package supplies hooks such as `useLiveKitRoom`, `useTracks`, `useLocalParticipant`, and `useTrackToggle` over a room/client core. `RoomContext.Provider` can be used directly when an application needs lifecycle control. A local participant exposes imperative operations such as enabling the camera/microphone and switching the active device; a local track can be replaced, stopped, muted, or assigned a processor:

```ts
await localTrack.setProcessor(processor)
await localTrack.stopProcessor()
await localTrack.replaceTrack(nextTrack)
```

The client serializes pending publication operations, retains last device errors, removes listeners during disconnect, stops/unpublishes owned tracks, and supports device switching across active tracks. Track processors include video background blur/virtual background and Web Audio-based audio processors. The framework-neutral core plus thin React hooks is a strong composition precedent, as is keeping processed output as a standard track.

The cost is scope leakage: room connection, participant/publication identity, transport reconnection, autoplay, and remote tracks all appear in the state model. A local effects library should borrow the ownership and processor boundaries without importing room semantics or requiring a transport object. The LiveKit documentation also warns against repeatedly unmounting/remounting its provider because that disconnects and reconnects the room; that failure mode is relevant to any provider that owns expensive media resources.

### MediaPipe Tasks Vision: caller-driven frames, model assets, and worker responsibility

MediaPipe's web APIs create an effect/detector from options containing a model and runtime asset location, then ask the caller to supply a video frame and timestamp:

```ts
const vision = await FilesetResolver.forVisionTasks(wasmPath)
const segmenter = await ImageSegmenter.createFromOptions(vision, {
  baseOptions: { modelAssetPath },
  runningMode: 'VIDEO',
})
const result = segmenter.segmentForVideo(video, timestamp)
```

The APIs expose no React ownership model or capture device selection. The caller owns the frame loop, timestamps, model/WASM paths, result lifecycle, and worker placement. The synchronous `detectForVideo()`/`segmentForVideo()` calls can block the UI thread; the official guidance is to move them to a worker for interactive video. This is strong evidence that a high-level effect API must make readiness, asset loading, scheduling/backpressure, and failure states explicit instead of presenting a synchronous transform that looks cheap.

MediaPipe also documents a non-obvious compatibility/privacy cost: its Tasks APIs may send performance/utilization metrics to Google, and applications must obtain any required consent. That does not disqualify the runtime, but it reinforces that a first-party library should make optional assets and telemetry boundaries visible rather than hiding them inside a default path.

### VAD and browser noise suppression: audio readiness and processed-track ownership

`@ricky0123/vad` uses an asynchronous factory to load an ONNX model and worklet assets, then exposes imperative start/pause plus callbacks such as speech start/end and frame processing. The React package is a thin adapter. The design is useful for audio because initialization can be long and fail for asset/runtime reasons independently of capture permission; the public API needs readiness, explicit start/stop, asset configuration, and idempotent disposal.

The WorkAdventure noise-suppression example creates a 16 kHz `AudioContext`, inserts an `AudioWorkletNode`, routes the processed output through `MediaStreamAudioDestinationNode`, and returns a processed track plus `ready` and `dispose`. Its `bypassUntilReady` option prevents a startup gap. The caller must still disconnect nodes, stop tracks, and close the context. This is a low-adoption reference, not a recommendation, but it demonstrates why processed-track ownership and bypass/failure behavior must be specified rather than inferred from a hook unmount.

## API-dimension comparison

The table describes what the prior art makes explicit. “Partial” means an application can build it around the library but it is not a first-class contract.

| Dimension | react-webcam | Daily | LiveKit | MediaPipe / VAD / audio worklet | Browser baseline and implication |
| --- | --- | --- | --- | --- | --- |
| Acquisition | Component calls `getUserMedia` | Call object owns pre-join or joined devices | Room/local participant owns tracks | Caller supplies video/audio source or frames | `getUserMedia()` may remain pending indefinitely; capture must expose pending and stale-request handling |
| Device selection | Constraints and app-managed `enumerateDevices()` | Rich camera/mic/speaker lists, refresh, setters | Active-device switching across tracks | Outside scope | Permission and visibility filter `enumerateDevices()`; exact IDs are not always available |
| State model | `hasUserMedia` plus callbacks | Explicit device and lifecycle vocabularies | Room/participant/publication state plus last errors and pending operations | Factory/ready/error and caller-driven run state | Normalize without pretending browser states are more deterministic than they are |
| Errors | Callback string/DOMException | Device state plus camera error and promise rejection | Typed media failures and last camera/mic errors | Model/runtime/asset exceptions and callbacks | Preserve original `DOMException.name` and map to stable library categories |
| Cancellation | Request generation; stop late stream | Leave/destroy and async setters | Disconnect, unpublish/stop, pending operation guards | Caller stops loop, pauses VAD, disposes processor | No generic `getUserMedia` abort; `AbortSignal` can cancel library work while late browser results must be ignored/stopped |
| Retry | Caller remounts or changes props | Per-load retry events and explicit refresh | Reconnect/load retry policy | Caller retries factory or frame loop | Retry must be bounded/observable; do not silently reacquire on every render |
| Track ownership | Implicitly stops acquired tracks | Call object owns device tracks; custom track input exists | Local track ownership and unpublish/stop rules | Caller owns input/output unless wrapped | Explicit owned/external/borrowed semantics are needed to avoid stopping shared tracks |
| Sharing | No provider/store | Provider exposes one call object | Context shares room/client state | No React sharing | A controller/store can share state; hooks should not create duplicate capture for each consumer |
| Switching | Stop and reacquire on constraint change | Async device setter/custom track | `switchActiveDevice`, `replaceTrack`, and exact constraints | Caller changes frame/source | Old-track-first is simple; replacement-first avoids gaps but temporarily doubles resources |
| Cleanup | Unmount stops tracks and revokes URL | `destroy()` releases resources; methods then throw | Disconnect removes listeners and stops owned resources | `dispose`, `pause`, worklet disconnect, context close | Cleanup must be idempotent and distinguish detaching from stopping a shared source |
| SSR and browser boundary | Top-level guard plus lifecycle acquisition | Browser object is created in effect/hook | Browser SDK and user-gesture/autoplay constraints | Model/WASM/worklet asset paths and workers | Imports must be safe during SSR; operations belong after hydration and usually after user action |
| Processing insertion | None beyond video element/screenshot | Custom source track is accepted | `setProcessor`, `stopProcessor`, `replaceTrack` | Caller-driven raw frames or audio graph | Prefer a media-kind-specific processor contract with standard track output and explicit readiness |

## Composition models and concrete implications

| Model | Prior-art examples | Strengths | Costs and failure modes |
| --- | --- | --- | --- |
| Component-first wrapper | react-webcam | Fast adoption, small JSX surface, ref-based imperative escape hatch | Per-instance acquisition, implicit ownership, callback-shaped errors, limited shared state |
| Provider/store plus hooks | Daily React, LiveKit Components | One resource can be shared; state selectors and actions fit React; lifecycle can be centralized | Context lifecycle is easy to remount accidentally; provider may own a broad transport; Strict Mode needs deliberate creation guards |
| Imperative controller/handle plus thin hooks | Daily `useCallObject`, LiveKit's core/hooks split, browser standards | Async cancellation/disposal and resource identity live outside render; framework-neutral tests and future adapters are possible | More types and boilerplate; callers need an explicit controller lifetime |
| Framework-neutral processing core | LiveKit client/track processors, MediaPipe, VAD | Enables independent video/audio pipelines and non-React use; standard tracks can cross boundaries | Scheduling, worker, model asset, and browser compatibility become explicit API obligations |
| Raw frames or graph nodes | MediaPipe, AudioWorklet | Maximum extensibility and performance control | Leaks timestamps, backpressure, model/WASM/worklet/CSP details and makes first-party guarantees harder |

The evidence favors investigating a framework-neutral media controller with thin React hooks and an optional provider/store for sharing. A controller/handle can own capture state and cancellation while a hook subscribes to snapshots; a provider can scope one controller without forcing every app to use context. Video and audio processors can then be independently attached to owned tracks and produce standard tracks/streams, without requiring a room or network transport.

That paragraph is a recommendation for follow-up design work, not an accepted decision.

## Reusable patterns and observed failure modes

### Patterns worth carrying forward

1. Make asynchronous readiness visible. Use a small, documented state machine rather than one boolean: for example `idle`, `requesting`, `ready`, `degraded`, `failed`, and `stopped`, with device/processor substate where needed.
2. Normalize errors but retain evidence. Expose stable categories such as permission denied, not found, in use, unsupported, invalid constraints, asset/runtime failure, and aborted; retain the original browser error name and cause.
3. Separate request cancellation from browser cancellation. Accept an `AbortSignal` for library-controlled work, increment a request generation for each acquisition, and stop a stream that resolves after it is stale or disposed. Never assume `getUserMedia()` can be aborted.
4. Make ownership explicit. Each input/output should identify whether the library owns it, borrows it, or received an externally owned track. `dispose()` must be idempotent; detaching a consumer must not automatically stop a shared source.
5. Treat switching as a transaction. Keep the current track until the replacement is ready when continuity matters, report the preview gap if stopping first, and make fallback versus exact-device failure observable.
6. Give processors lifecycle controls. A processor needs readiness, bypass or degraded behavior, failure reporting, replacement/removal, and disposal. Video and audio should be independently extensible and independently disableable.
7. Keep the interop boundary standard. A processed `MediaStreamTrack`/`MediaStream` is easy to hand to a preview or later transport adapter; a raw-frame API can remain an optional lower-level escape hatch rather than the default capture contract.
8. Make browser-only work explicit. Guard SSR imports, defer device access to effects or user actions, document secure-context and Permissions Policy requirements, and keep model/WASM/worklet assets lazy and configurable.

### Failure modes the follow-up experiments must test

- React 18 Strict Mode can run effects twice. A provider/controller must not create duplicate captures or destroy the real instance during the probe cycle.
- A component can unmount, change constraints, or switch devices while `getUserMedia()` is pending. A late stream must be stopped and never attached to a stale consumer.
- A browser permission prompt can remain unresolved if the user ignores it. UI state needs a pending indicator and caller cancellation/timeout policy, even if the browser promise remains alive.
- `MediaStreamTrack.stop()` ends a track without firing an `ended` event, and a shared source may remain alive through another track. Cleanup cannot be based on the `ended` event alone.
- A processor may be loading a model or worklet while capture is already usable. The API must specify bypass, buffering, or failure isolation and avoid taking down unrelated media.
- Worker/frame APIs can block the UI or drop frames when scheduling is wrong. Backpressure, timestamps, output latency, and worker startup need evidence before choosing a transform order.
- Exact device IDs are permission- and visibility-dependent. An app must not silently switch to a different camera when its remembered exact device becomes unavailable unless that fallback is explicit.
- Replacing a track while an output/transport still references the old track can create a gap or stale publication. Output and transport experiments must define whether replacement, clone, or new-stream semantics are used.

## Compatibility and distribution costs

The public API cannot remove several browser and ecosystem constraints:

- `getUserMedia()` is secure-context-only, permission-gated, and subject to Permissions Policy. `enumerateDevices()` can hide non-default devices until permission is granted and the page is fully active/visible.
- `deviceId: { exact }` is useful for deterministic selection but fails when the device is missing or the identifier is unavailable. Ideal constraints and remembered preferences have different fallback semantics.
- `MediaStreamTrackProcessor` and Media Capture Transform have uneven browser/worker support. Web Audio and `AudioWorklet` also require a secure context and may need a user gesture for graph startup or audible output.
- Model, WASM, and AudioWorklet assets introduce URL, CSP/CORS, bundler, cache, and worker configuration. Optional effect entry points should avoid loading all runtimes on import.
- MediaPipe's model/runtime and telemetry behavior must be considered independently from the library's own source license. Third-party models and assets may have different terms.
- React 18/19 Strict Mode and SSR make render-time side effects and module-level browser access incompatible with the accepted contract.
- A generic plugin API would require a compatibility contract for worker support, frame formats, timing, resource ownership, error isolation, and potentially untrusted code. That is materially broader than a first-party effect API.

## Alternatives requiring user approval

No option in this section is accepted. The user retains final authority over each public API and compatibility choice.

### Capture surface

1. **Hook-first (`useCapture`)**: simplest JSX integration and familiar React ergonomics; risks tying acquisition, cancellation, and ownership to render/effect behavior and makes framework-neutral tests/adapters harder.
2. **Provider/store plus hooks**: supports shared capture and selectors, following Daily/LiveKit; risks context remounts, provider-owned resource surprises, and unnecessary setup for a single consumer.
3. **Framework-neutral controller/handle plus thin hooks**: isolates async lifecycle, request generations, disposal, and future adapters; costs more types and an explicit controller lifetime. This is the leading research candidate, not an approval.

### Effect/processor boundary

1. **Opaque first-party effect controls producing standard tracks**: stable semantic API, keeps model/runtime choices internal, and interoperates with previews or transport; costs less raw extensibility and requires a documented effect capability/error contract.
2. **Generic processor interface inspired by LiveKit**: allows third-party and future processors; expands the public compatibility promise around timing, workers, ownership, and failure isolation.
3. **Raw frames/tensors/AudioWorklet nodes**: maximum performance and customization; leaks browser, worker, asset, and scheduling contracts and makes first-party guarantees difficult.

### Ownership

1. **Exclusive library ownership**: simplest cleanup and failure isolation; cannot safely accept shared/external tracks without copying or transfer semantics.
2. **Explicit borrowed/external versus owned resources**: best interop and avoids stopping caller-owned tracks; requires metadata, documentation, and tests for clone/share behavior.
3. **Implicit reference counting or automatic cloning**: convenient sharing; difficult to reason about with browser sources and can retain camera/microphone resources unexpectedly.

### Device switching

1. **Stop then reacquire**: straightforward and usually compatible; preview/output gap is visible.
2. **Acquire replacement then swap**: smoother continuity; temporarily doubles camera/mic resources and increases permission/race complexity.
3. **Automatic fallback on loss**: resilient; can unexpectedly change the user's camera or microphone. Exact-device failures should likely remain observable unless the user approves a fallback policy.

### Processing output

1. **Return processed `MediaStreamTrack`/`MediaStream`**: strongest browser interoperability and transport neutrality; requires explicit ownership and replacement semantics.
2. **Return an opaque effect handle and let the library own the sink**: simpler cleanup and implementation freedom; harder to integrate with unrelated capture/transport APIs.
3. **Expose both a semantic effect handle and a standards output**: broadest utility; larger API and more lifecycle combinations to test.

## Follow-up task implications

- **TASK-1.3** should test Strict Mode duplicate effects, unmount/remount, stale acquisition, caller cancellation, shared/external tracks, device loss, and idempotent cleanup.
- **TASK-1.4** should compare video frame pipelines, workers, backpressure, timestamps, processor readiness, and output continuity across target browsers.
- **TASK-1.5** should compare AudioWorklet buffering, model/worklet asset loading, user-gesture constraints, bypass, cancellation, and disposal.
- **TASK-1.10** should build the capture vertical slice only after ownership/state alternatives are approved, with standard track output and observable device errors.
- **TASK-1.11** and **TASK-1.12** should verify that adding, removing, bypassing, or failing one processor does not reacquire or take down unrelated media.
- **TASK-1.17** should evaluate how processed tracks are handed to a future output/transport layer, including replacement, clone/share, and stop semantics.

## Acceptance-criteria mapping

| Criterion | Evidence in this report |
| --- | --- |
| 1. At least three relevant React/media libraries or standards analyzed | Representative prior-art table and detailed sections cover react-webcam, Daily, LiveKit, MediaPipe, VAD, audio worklet, and browser standards |
| 2. Public API dimensions compared | API-dimension comparison covers acquisition, devices, state, errors, cancellation, retry, ownership, sharing, switching, cleanup, SSR, and processing insertion |
| 3. Composition models compared with concrete patterns | Composition table and detailed examples cover hooks, providers, imperative handles, framework-neutral cores, and independent video/audio processing |
| 4. Recommendations with tradeoffs and examples | Reusable patterns, failure modes, compatibility costs, and approval-bound alternatives are documented |
| 5. Alternatives presented to the user without accepting significant decisions | Authority note and “Alternatives requiring user approval” explicitly leave all API/architecture choices unaccepted; coordinator/user approval is still required |

## Source register

Primary sources used for technical claims:

- [react-webcam repository](https://github.com/mozmorris/react-webcam) and [source implementation](https://raw.githubusercontent.com/mozmorris/react-webcam/master/src/react-webcam.tsx)
- [Daily React repository](https://github.com/daily-co/daily-react), [DailyProvider](https://docs.daily.co/reference/daily-react/daily-provider), [useCallObject](https://docs.daily.co/reference/daily-react/use-call-object), [useDevices](https://docs.daily.co/reference/daily-react/use-devices), [setInputDevicesAsync](https://docs.daily.co/reference/daily-js/instance-methods/set-input-devices-async), and [destroy](https://docs.daily.co/reference/daily-js/instance-methods/destroy)
- [LiveKit Components repository](https://github.com/livekit/components-js), [client SDK repository](https://github.com/livekit/client-sdk-js), [React hooks](https://docs.livekit.io/reference/components/react/hook/uselivekitroom/), [custom components and contexts](https://docs.livekit.io/reference/components/react/concepts/custom-components/), [LocalTrack](https://docs.livekit.io/reference/client-sdk-js/classes/LocalTrack.html), and [track processors](https://github.com/livekit/track-processors-js)
- [MediaPipe Image Segmenter web guide](https://developers.google.com/edge/mediapipe/solutions/vision/image_segmenter/web_js), [Face Detector web guide](https://developers.google.com/edge/mediapipe/solutions/vision/face_detector/web_js), and [MediaPipe repository](https://github.com/google-ai-edge/mediapipe)
- [VAD repository](https://github.com/ricky0123/vad) and [vad-react package](https://www.npmjs.com/package/@ricky0123/vad-react)
- [WorkAdventure noise suppression repository](https://github.com/workadventure/noise-suppression)
- [MDN `getUserMedia()`](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia), [enumerateDevices()](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/enumerateDevices), [MediaStreamTrack.stop()](https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack/stop), [MediaStreamTrack.clone()](https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack/clone), [MediaStreamTrackProcessor](https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrackProcessor), and [AudioWorklet](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorklet)

Adoption/license/release signals were checked against the linked GitHub and npm pages during this review. They are context only and must not be treated as a product-quality or security certification.
