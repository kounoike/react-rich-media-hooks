---
id: doc-6
title: Public API and Resource-Lifecycle Contract
type: specification
created_date: '2026-08-19 02:25'
updated_date: '2026-08-20 15:07'
---
# Public API and Resource-Lifecycle Contract

Status: Accepted semantic public API and resource-lifecycle contract; exact exports and type spellings remain implementation-reviewable.
Date: 2026-08-19 (Asia/Tokyo)
Task: TASK-1.7 — Define the public API and resource-lifecycle contract
Decision: [decision-2 — Accept the public API and resource-lifecycle contract](../../decisions/decision-2 - Accept-the-public-API-and-resource-lifecycle-contract.md)

## Authority and evidence boundary

The accepted baseline is decision-1 / [Initial Product and Quality Contract](../product/initial-product-quality-contract/doc-1 - Initial-Product-and-Quality-Contract.md): a headless React library for local camera and microphone capture, first-party video and audio effects, standard browser media interoperability, React 18.2/19, modern evergreen desktop browsers, and SSR-safe imports. That baseline deliberately does not choose the public API shape, processor runtime, worker strategy, acceleration path, output identity, or internal transform order.

This document records the accepted semantic contract for consumers and implementers. The words “must”, “should”, and “may” below describe accepted behavior; exact export names, generic parameters, and type spellings remain implementation-reviewable. The contract is based on:

- doc-2, Public API Ecosystem Prior Art (TASK-1.16);
- doc-3, Media Output and Transport Interoperability (TASK-1.17);
- doc-4, Capture Lifecycle Experiment Findings (TASK-1.3);
- Browser Video Processing Feasibility (TASK-1.4);
- Browser Audio Processing Feasibility (TASK-1.5);
- the browser and React boundaries accepted in doc-1.

Decision-2 records the user-approved choices below; decision-1 remains the accepted product and quality baseline. Any later material change to this contract must be reviewed and recorded with \`backlog decision create\` before dependent implementation treats it as normative.

## Contract goals and non-goals

The accepted contract lets an application:

1. explicitly start, stop, retry, switch, and release local media;
2. observe capture, processor, output, and error state without inferring it from a video element;
3. compose semantic video effects (crop, background blur/replacement, primary-subject auto-framing) independently from semantic audio effects (voice noise reduction);
4. share one explicitly owned media session across React consumers without duplicate acquisition;
5. hand standard \`MediaStreamTrack\` and \`MediaStream\` values to previews, recorders, WebRTC adapters, and other browser APIs;
6. use the same lifecycle vocabulary from a framework-neutral core and a thin React adapter;
7. import and render safely in SSR applications while deferring all browser work until hydration and explicit application action.

The contract does not include product UI, WebRTC signaling/rooms, recording/transcoding/storage, cloud processing, React Native, Node-side media processing, arbitrary model tensors, or a guarantee that every browser exposes the same processing backend. Effect implementation order, model/runtime selection, worker placement, and acceleration remain replaceable behind the semantic boundary.

## Consumer model

### Stable session identity outside render

The accepted contract uses one framework-neutral session/controller as the resource owner. A React hook subscribes to an immutable snapshot; it does not create or acquire media during render.

Illustrative names and TypeScript shapes are implementation-reviewable semantic sketches:

~~~ts
type MediaKind = 'video' | 'audio'

interface MediaSession {
  getSnapshot(): MediaSnapshot
  subscribe(listener: () => void): () => void
  getServerSnapshot(): MediaSnapshot

  start(options?: StartOptions): Promise<OperationResult>
  stop(options?: StopOptions): Promise<void>
  retry(options?: RetryOptions): Promise<OperationResult>
  switchDevice(kind: MediaKind, device: DeviceSelection): Promise<OperationResult>

  setVideoEffects(effects: VideoEffectConfig): Promise<OperationResult>
  setAudioEffects(effects: AudioEffectConfig): Promise<OperationResult>

  getOutput(kind: MediaKind): MediaOutput | null
  dispose(): Promise<void>
}
~~~

The semantic choices are accepted; final names, generic parameters, exact return types, and promise signatures remain subject to implementation-driven type review and are not silently final. The accepted properties are stable session identity, explicit actions, observable snapshots, standard outputs, and an idempotent terminal \`dispose()\`.

A session has one explicit owner. Subscribers are observers, not owners: subscribing or unsubscribing never starts or stops capture. The owner decides when the session ends. An optional React provider can make one session available to a subtree, but context is an adapter and not the resource identity.

### Capture and effect configuration

Capture configuration describes requested media and semantic options, not an implementation pipeline:

~~~ts
const session = createMediaSession({
  capture: {
    video: { deviceId: 'camera-a', width: { ideal: 1280 } },
    audio: { deviceId: 'microphone-a' },
  },
  video: {
    effects: [
      crop({ aspectRatio: 16 / 9 }),
      backgroundBlur({ strength: 'medium' }),
      autoFrame({ margin: 0.2 }),
    ],
  },
  audio: {
    effects: [noiseReduction({ level: 'standard' })],
  },
})
~~~

Applications may configure video and audio independently. The public contract describes semantic effects and observable processing state; it does not expose segmentation tensors, detector instances, audio worklet nodes, frame queues, model-specific options, or the internal order used to realize composed effects. If two effects cannot be combined on a given browser, the session reports a capability or processor error and applies the documented bypass/degraded policy rather than pretending composition succeeded.

The first-release effect set is the approved product scope. A generic third-party processor/plugin API is not required by this contract. A future extension can implement the same lifecycle boundary only after a separate compatibility and API review.

## Observable state machine

### Snapshot shape

A snapshot is immutable from the consumer's point of view. A state change creates a new snapshot and emits one notification; consumers must not read mutable internals from an output object.

~~~ts
type CapturePhase =
  | 'idle'
  | 'requesting'
  | 'active'
  | 'stopping'
  | 'ended'
  | 'disposed'

type Availability =
  | 'unknown'
  | 'ready'
  | 'denied'
  | 'unavailable'
  | 'unsupported'

type Activity = 'live' | 'muted' | 'ended'

type ProcessorStatus =
  | 'off'
  | 'loading'
  | 'active'
  | 'bypassed'
  | 'degraded'
  | 'unsupported'
  | 'failed'

interface MediaSnapshot {
  phase: CapturePhase
  availability: Availability
  activity: {
    video: Activity | 'not-requested'
    audio: Activity | 'not-requested'
  }
  processors: {
    video: ProcessorSnapshot
    audio: ProcessorSnapshot
  }
  outputs: {
    video: OutputSnapshot | null
    audio: OutputSnapshot | null
  }
  operation: OperationSnapshot | null
  error: MediaError | null
  lastTransition: TransitionRecord
}
~~~

\`phase\` describes ownership and capture lifecycle. \`availability\` preserves the difference between a denied permission, a missing/unavailable device, and a browser that cannot perform the requested operation. \`activity\` reflects track \`muted\`/ended behavior and is not collapsed into permission state. A processor can be loading, bypassed, degraded, or failed while capture remains active.

The snapshot must include enough information for accessible application UI: a stable status, whether an effect is currently applied or bypassed, a retryable error category, and the current operation reason. An application must not need to inspect \`MediaStreamTrack.readyState\` or browser exception strings to render normal state.

### Transitions and invariants

| Current state/event | Required observable result | Resource invariant |
| --- | --- | --- |
| \`idle\` + explicit \`start\` | \`requesting\`, new operation/generation | No stale request may publish into this session |
| \`requesting\` + current acquisition succeeds | \`active\`; processor states enter \`loading\`, \`off\`, or \`active\` as configured | Acquired tracks become owned by the session |
| \`requesting\` + permission/device/constraint failure | \`ended\` or \`idle\` with \`denied\`, \`unavailable\`, or \`failed\` evidence | Any provisional or partial resource is cleaned |
| \`requesting\` + cancel/stop/dispose | \`idle\`, \`ended\`, or \`disposed\` according to action | Late success is stopped/closed and never attached |
| \`active\` + track \`mute\` | active capture with \`activity = muted\` | The session does not silently replace the device |
| \`active\` + owned track \`ended\` | \`ended\` or \`degraded\` with \`device-ended\` error | Session-owned resources are released |
| \`active\` + explicit replacement | current output remains active while replacement is \`requesting\` | Old owned input remains live until replacement is ready |
| replacement succeeds | one output-change transition, new resource active | New resource is published before old owned resource is stopped |
| replacement fails | current resource remains active when possible; operation error is visible | Failed replacement resources are cleaned; no silent device fallback |
| processor \`loading\` + ready | processor \`active\`; output identity/change is observable | Every stale frame/worker/node is closed or disconnected |
| processor \`loading\` + unsupported/failure | \`bypassed\`, \`degraded\`, or \`failed\` by explicit policy | Original track may remain available; failed processor resources are cleaned |
| \`active\` + explicit \`stop\` | \`stopping\` then \`idle\`/ \`ended\` | All session-owned tracks and processor resources stop exactly once |
| any non-disposed state + \`dispose\` | terminal \`disposed\` | Disposal is idempotent and invalidates every pending operation |

A browser \`MediaStreamTrack.stop()\` call does not guarantee an \`ended\` event. The session therefore stops resources it owns directly and separately listens for browser \`ended\`/mute changes. Repeated cleanup is harmless. A consumer should treat \`disposed\` as terminal and create a new session rather than reusing it.

### Output identity and replacement

The semantic session identity remains stable while a device or processor replacement can change the underlying track. A \`MediaOutput\` exposes a current standard track/stream view plus its ownership and identity metadata:

~~~ts
interface MediaOutput {
  readonly kind: MediaKind
  readonly track: MediaStreamTrack
  readonly stream: MediaStream
  readonly id: string
  readonly ownership: 'session-owned' | 'application-owned-clone'
  clone(): MediaOutput
}
~~~

The accepted output-lifetime rule is that attaching \`output.stream\` to a preview, recorder, or sender does not change session ownership and detaching a consumer does not stop the session. An application needing an independent lifetime uses clone(), which is application-owned and independent. The session emits an output-change record whenever the current track changes; applications must reattach a preview or call their transport adapter's replacement operation as appropriate.

The core is transport-neutral:

- an HTML media element can use the current stream;
- a WebRTC integration can use sender \`replaceTrack\` and handle renegotiation constraints;
- a MediaRecorder may need to stop and recreate when its track set changes;
- canvas capture and Web Audio destinations remain application/adapter responsibilities.

The core does not promise that a recorder or sender will automatically follow a changed track. It reports the replacement and leaves transport policy to a separately tested adapter.

## Cancellation, overlap, and retries

### Logical cancellation

Every asynchronous acquisition, replacement, asset load, and processor initialization receives an operation identity and may accept an \`AbortSignal\`. Cancellation means:

1. increment or invalidate the session generation;
2. publish a cancelled/superseded operation result when it is useful to the caller;
3. abort library-controlled fetches, workers, queues, and processor setup;
4. ignore late failure from an obsolete operation;
5. stop every late stream track, close every late frame/audio object, disconnect late nodes, and terminate late workers;
6. preserve the active resource when a pending replacement is cancelled, unless the caller requested a full stop.

The browser \`getUserMedia()\` promise may remain pending after cancellation. The contract therefore never claims that cancellation aborts the browser prompt. It promises that a cancelled result cannot mutate the current session or leak resources.

~~~ts
const controller = new AbortController()
const pending = session.switchDevice('video', { deviceId: 'camera-b' }, {
  signal: controller.signal,
})
controller.abort() // logical cancellation; camera-b may still resolve later

await pending // resolves as cancelled/superseded or rejects with a stable aborted error
~~~

Operation results use tagged cancellation/supersession semantics. Exact result type names and promise signatures remain implementation-reviewable, but stale operations must not produce unhandled rejections or overwrite a newer snapshot.

### Overlapping requests

A later operation supersedes an earlier operation for the same resource domain. The session records the current operation generation. If operation A resolves after operation B has become current, A is stale: its tracks/resources are immediately disposed and its result is not attached. A stale failure is diagnostic-only and does not replace B's state.

Operations on independent domains may overlap. For example, enabling video background blur may load a video runtime while audio capture continues; an audio processor failure must not stop a healthy video output. A full \`stop()\` or \`dispose()\` invalidates all domains.

### Retry

Retry is explicit and bounded:

- \`retry()\` repeats a failed operation only when the error is marked \`retryable\`;
- retry does not loop indefinitely, reacquire on every render, or silently choose another device;
- a caller-selected device is treated as an exact user choice unless the caller requests a fallback policy;
- retry publishes a new operation/generation and retains any healthy current output during replacement;
- applications may implement backoff outside the session; the core does not hide repeated prompts or waits.

Recoverable examples include transient \`NotReadableError\`, processor asset fetch failure, worker startup failure, and device replacement failure. Permission denial, unsupported APIs, invalid constraints, and a disposed session are not made retryable merely by calling \`retry()\`; the snapshot retains the original category and cause.

## Error contract

Errors have a stable library category, the media domain, operation context, retryability, and retained browser evidence:

~~~ts
type MediaErrorCode =
  | 'permission-denied'
  | 'device-not-found'
  | 'device-unavailable'
  | 'constraint-invalid'
  | 'unsupported'
  | 'device-ended'
  | 'asset-load-failed'
  | 'processor-failed'
  | 'resource-failed'
  | 'aborted'
  | 'superseded'
  | 'disposed'
  | 'unknown'

interface MediaError {
  code: MediaErrorCode
  kind: MediaKind | 'session'
  operation: 'start' | 'stop' | 'switch' | 'processor' | 'dispose'
  retryable: boolean
  message: string
  browserName?: string
  constraint?: string
  cause?: unknown
  generation: number
}
~~~

The category mapping preserves the original \`DOMException.name\` (for example \`NotAllowedError\`, \`NotFoundError\`, \`NotReadableError\`, or \`OverconstrainedError\`) without making browser-specific names the only public contract. Processor/runtime failures preserve an implementation cause for diagnostics but do not require consumers to understand a model, worker, or worklet type. A cancelled or superseded operation does not replace a newer successful snapshot.

Errors are observable through the snapshot and operation result. The contract should also support an optional diagnostic callback/event stream, but the callback shape and logging policy remain implementation-reviewable. No telemetry or media upload occurs by default.

## Ownership, sharing, and cleanup

Capture and processor inputs originate from the session’s own acquisition; applications configure capture through session actions and do not supply tracks directly.

### Ownership categories

| Resource | Default owner | Consumer rule |
| --- | --- | --- |
| Track/stream acquired by \`start()\` | Session | Only session disposal/stop stops it |
| Processor-generated track, stream, canvas, AudioContext, worklet, worker, model/runtime handle | Session or processor instance | Owner closes/stops/releases it exactly once |
| Output attached to preview, recorder, or sender | Session | Consumer detach does not stop the source |
| Application clone of an output | Application | Application stops/releases its clone |
| Shared session subscription | Subscriber has no resource ownership | Unsubscribe only removes the observer |

Ownership is explicit: the session owns acquired and generated media and processing resources, while a consumer’s React mount or output attachment does not change that ownership. An application clone has an independent track lifetime; stopping it does not stop the session’s source or processing graph.

### Sharing

The default React pattern is one session created by an owner and passed to multiple consumers:

~~~tsx
function MediaOwner() {
  const session = useMemo(() => createMediaSession({ capture: { video: true, audio: true } }), [])
  useEffect(() => () => { void session.dispose() }, [session])

  return (
    <MediaSessionProvider session={session}>
      <Preview />
      <Controls />
      <StatusAnnouncer />
    </MediaSessionProvider>
  )
}

function Preview() {
  const { snapshot, output } = useMediaSession()
  // Attach output.stream in an effect; do not stop it from this component.
  return <video autoPlay muted playsInline data-phase={snapshot.phase} />
}
~~~

Both consumers observe one acquisition. Unmounting \`Preview\` or \`StatusAnnouncer\` only unsubscribes that consumer. The session remains live until its explicit owner calls \`stop()\` or \`dispose()\`. An application that wants independent capture creates two sessions deliberately; the library must not deduplicate unrelated sessions or prompt twice through accidental per-component hooks.

Automatic reference counting tied to React subscriptions is not accepted as the default because provider remounts and transient Strict Mode subscriptions can retain or stop hardware unexpectedly. A future scoped-lifetime helper may be added only with explicit semantics and leak tests.

### Cleanup requirements

\`stop()\`, \`dispose()\`, replacement cleanup, stale-result cleanup, and partial-failure cleanup are all idempotent. The implementation must:

- stop every owned input/output track;
- detach listeners and media-element references owned by the session;
- cancel fetches and timers;
- close \`VideoFrame\`/\`AudioData\` objects exactly once when raw-frame paths are used;
- cancel readable/writable streams and drain or discard bounded queues;
- disconnect \`AudioNode\` graphs and close owned \`AudioContext\` objects;
- terminate workers and release model/runtime resources;
- revoke object URLs created by the session;
- leave application-owned output clones under application control;
- make late completions harmless after stop/dispose.

The quality contract's inactive-resource invariant is the acceptance test: an inactive session leaves no library-owned live track, context, animation loop, worker, GPU task, or sustained processing.

## Video and audio extension boundaries

### Shared lifecycle, independent domains

Video and audio processors share the lifecycle vocabulary (\`off\`, \`loading\`, \`active\`, \`bypassed\`, \`degraded\`, \`unsupported\`, \`failed\`) and ownership/error rules, but they are independent domains:

~~~ts
interface VideoProcessor {
  readonly kind: 'video'
  readonly status: ProcessorStatus
  start(input: MediaStreamTrack, options: VideoProcessOptions): Promise<ProcessorOutput>
  update(config: VideoEffectConfig): Promise<OperationResult>
  stop(): Promise<void>
  dispose(): Promise<void>
}

interface AudioProcessor {
  readonly kind: 'audio'
  readonly status: ProcessorStatus
  start(input: MediaStreamTrack, options: AudioProcessOptions): Promise<ProcessorOutput>
  update(config: AudioEffectConfig): Promise<OperationResult>
  stop(): Promise<void>
  dispose(): Promise<void>
}
~~~

These processor boundaries describe independent session-to-processor lifecycle semantics; the initial release exposes first-party effect factories only rather than arbitrary processor classes. The critical contract is:

- each media kind can load, activate, bypass, fail, retry, replace, and dispose independently;
- a video processor never owns or stops an audio input, and vice versa;
- each processor can produce a standard track/stream output or an explicitly unsupported/degraded state;
- processor internals may change from canvas to raw track transforms, Web Audio, AudioWorklet, WASM, workers, or another validated backend without changing consumer semantics;
- processor output changes carry identity, readiness, reason, and expected gap/transport implications;
- effects can be composed semantically within a media kind; internal order is not public;
- a failed optional processor can leave the original track available if the selected bypass policy allows it;
- no processor is allowed to leak frames, audio nodes, model assets, workers, or output tracks after cancellation.

An application can therefore enable video effects while audio remains pass-through, or retry audio noise reduction while retaining a healthy video effect. The session snapshot combines both domains only for consumer convenience; domain errors and operation identities remain separate.

### Bypass and degraded behavior

A processor's readiness is observable. During loading, the session may expose the original track as \`bypassed\` when continuity is preferred. On unsupported capability or recoverable failure, the application sees \`unsupported\`, \`degraded\`, or \`failed\` plus the error code; it does not receive a silent substitution of another device. Bypass to the original media is the accepted default for recoverable first-party processor loading/failure because it preserves continuity; effect-specific fail-closed policy remains implementation-reviewable when required by a product.

The contract never promises that a processor can preserve the same underlying track identity. An output-change event is required whenever a generated track replaces the current track.

## React adapter contract

The accepted React adapter is thin and uses \`useSyncExternalStore\` semantics:

~~~tsx
function PreviewAndControls({ session }: { session: MediaSession }) {
  const snapshot = useMediaSession(session)
  const output = useMediaOutput(session, 'video')

  return (
    <>
      <video ref={useAttachMediaStream(output?.stream)} autoPlay muted playsInline />
      <button
        onClick={() => { void session.start() }}
        disabled={snapshot.phase === 'requesting' || snapshot.phase === 'disposed'}
      >
        Start camera
      </button>
      <button onClick={() => { void session.stop() }}>
        Stop
      </button>
      <Status snapshot={snapshot} />
    </>
  )
}
~~~

The final hook overloads and ref helper remain implementation-reviewable. The behavioral requirements are normative for review:

- no acquisition, processor initialization, or mutable resource creation during render;
- stable subscription and server snapshot for SSR;
- event handlers or explicit effects call session actions;
- an options/config object that is recreated on every render does not reacquire media by identity alone;
- hook cleanup removes only the subscription owned by that hook;
- the session owner, not an arbitrary consumer, controls disposal;
- output attachment is an effect and detaches the element listener/reference on cleanup;
- applications can use the controller without React.

### Required usage examples

#### Composition

~~~tsx
const session = useMemo(() => createMediaSession({
  capture: { video: true, audio: true },
  video: {
    effects: [
      crop({ aspectRatio: 16 / 9 }),
      autoFrame({ margin: 0.2 }),
      backgroundReplacement({ image: replacementImage }),
    ],
  },
  audio: { effects: [noiseReduction()] },
}), [replacementImage])

// The video and audio effects are configured together for the consumer,
// but their loading/failure/retry state remains independent.
~~~

Changing \`replacementImage\` should use an explicit effect update or deliberately create a new session; a fresh object identity alone must never trigger hidden reacquisition.

#### Stable rerendering

~~~tsx
function Controls({ session }: { session: MediaSession }) {
  const snapshot = useMediaSession(session)
  const constraints = { video: true, audio: false } // harmless to recreate

  return (
    <button onClick={() => { void session.start({ constraints }) }}>
      {snapshot.phase === 'active' ? 'Running' : 'Start'}
    </button>
  )
}
~~~

A rerender with equivalent effective inputs does not create a new request. To change a device or constraint set, the application calls an explicit switch/update action so the session can perform a generation-aware transaction.

#### Overlapping requests and cancellation

~~~tsx
async function chooseCamera(deviceId: string, signal: AbortSignal) {
  const result = await session.switchDevice('video', { deviceId }, { signal })
  if (result.status === 'superseded' || result.status === 'cancelled') return
  if (result.status === 'failed') showError(result.error)
}
~~~

If camera A is active while camera B is pending, camera A remains usable. A later camera C request supersedes B; any late B stream is stopped and never attached. The exact tagged-result versus rejected-promise spelling remains implementation-reviewable, but the stale-resource invariant is fixed.

#### Multiple consumers

~~~tsx
function App() {
  const session = useMemo(() => createMediaSession({ capture: { video: true } }), [])
  return (
    <MediaSessionProvider session={session}>
      <Preview />
      <CameraPicker />
      <AccessibleStatus />
    </MediaSessionProvider>
  )
}
~~~

All three consumers subscribe to the same snapshot and output. Unmounting one does not stop the capture. The explicit owner disposes the session when the product no longer needs it.

#### Unmounting

~~~tsx
function OwnedSession() {
  const session = useMemo(() => createMediaSession({ capture: { video: true } }), [])
  useEffect(() => () => { void session.dispose() }, [session])
  return <Preview session={session} />
}
~~~

A preview-only consumer can unmount without disposal when another owner remains. If an owner unmounts while \`getUserMedia()\` or processor setup is pending, the session invalidates the generation; any late stream or processor resource is cleaned and never published.

#### Development Strict Mode

~~~tsx
function StrictModeSafeRoot() {
  return (
    <StrictMode>
      <OwnedSession />
    </StrictMode>
  )
}
~~~

The adapter must tolerate development setup/cleanup/setup. It must not acquire in render, attach the first stale promise, stop the second session's resources during the first cleanup, or leak duplicate tracks. Explicit user action after hydration is recommended. If an application deliberately starts in an effect, duplicate development requests are permitted as browser probes but stale results must be disposed and the final observable state must be correct; the contract does not promise one browser prompt/request under Strict Mode.

## Server rendering and non-browser imports

### Import and construction

The package's public entry points must be import-safe when \`window\`, \`document\`, \`navigator\`, \`MediaStream\`, \`AudioContext\`, \`Worker\`, and \`URL.createObjectURL\` are absent. Module evaluation must not request permissions, touch media devices, create workers/worklets, load model assets, or access browser-only constructors.

Constructing a session on the server is safe if it creates only inert data/controller state. The server snapshot is stable \`idle\` with browser environment marked unavailable; calling \`start()\` server-side returns a stable \`unsupported\`/environment error and creates no media resources. This SSR-safe behavior is normative for the initial release.

### Hydration and browser activation

After hydration, capture and processing begin only from an explicit client action or an application-owned client effect. The first client snapshot must match the server snapshot so hydration does not depend on browser permission state. Browser-only assets are lazy and are loaded only when the corresponding effect is enabled.

Secure context, top-level/iframe Permissions Policy, user gesture requirements, browser capability checks, and model/worklet/worker CSP/CORS requirements are surfaced as \`unsupported\`, \`permission-denied\`, or \`asset-load-failed\` evidence. No Node media-processing fallback is implied. Client-only adapter entry points may be offered for bundlers, but the base import must remain safe.

## Accepted choices and implementation-reviewable residuals

The following alternatives record the reviewed tradeoffs. Choices marked accepted are normative semantic direction; exact export/type spellings and backend details remain implementation-reviewable.

### Composition surface

| Option | Benefits | Costs and failure modes |
| --- | --- | --- |
| Hooks-only (\`useMediaSession(config)\`) | Minimal JSX and quick adoption | Resource identity follows component lifecycle; hard to share with non-React consumers; Strict Mode and remount races become hook internals |
| Provider/store only | Natural sharing and selectors | Provider remount can destroy expensive resources; non-React use is awkward; context becomes an accidental ownership contract |
| Imperative controller only | Clear lifetime, framework-neutral tests, easy non-React use | More boilerplate in React; consumers must wire subscriptions and output attachment |
| Controller core + thin hooks, optional provider (accepted) | Stable ownership outside render, React-friendly subscriptions, shared subtree, future framework adapters | More types and lifecycle documentation; provider ownership/disposal rules must be explicit |

### Output and ownership

| Option | Benefits | Costs and failure modes |
| --- | --- | --- |
| Standard current track/stream plus semantic output-change event (accepted) | Works with preview, recorder, WebRTC, canvas, and Web Audio; preserves implementation freedom | Consumers must handle replacement and transport-specific gaps; explicit clone lifetime rules are needed |
| Opaque effect handle | Maximum internal freedom | Bespoke adapters for every consumer; conflicts with standard-object interop goal |
| Stable track identity through in-place processing | Fewer reattachments | Not available for every backend/browser; can hide gaps and complicate processor replacement |
| New track on every replacement | Honest and broadly implementable | Preview/sender/recorder consumers must reattach or replace; may cause gaps |

The accepted ownership rule is “the session owns acquired and generated resources; output attachments do not change ownership; explicit application-owned output clones have independent lifetimes.” Automatic cloning/reference counting remains a possible future helper but is not the default because it can introduce hidden retention and surprising stop timing.

### Processor readiness and failure

| Option | Benefits | Costs and failure modes |
| --- | --- | --- |
| Bypass to original media while loading/failing (accepted default) | Preserves continuity and supports graceful degradation | Briefly exposes unprocessed media; may violate an application's effect-required policy |
| Buffer until processed output | Avoids unprocessed exposure | Startup latency, memory pressure, and visible/audio gap |
| Fail closed (no output/silence/black) | Strongest guarantee that processed output is never bypassed | Poor recovery and can turn a capability gap into an unusable product |

The bypass-to-original default is accepted; per-effect policy details and fail-closed opt-ins remain implementation-reviewable.

### Operation settlement

| Option | Benefits | Costs and failure modes |
| --- | --- | --- |
| Tagged result for cancellation/supersession (accepted) | Normal control flow; avoids expected aborts becoming unhandled errors | More result types and call-site branching |
| Reject with typed \`MediaError\` | Familiar async failure shape | Expected overlap/cancel paths can create noisy unhandled rejections; callers must distinguish stale from real failure |
| Both tagged result and optional rejection | Flexible migration | Duplicated semantics and harder documentation/testing |

Tagged cancellation/supersession results are accepted; exact promise spelling and result type names remain implementation-reviewable and must preserve deterministic settlement.

## Accepted contract and implementation-reviewable residuals

The following semantic choices are accepted by decision-2 and must guide implementation:

1. **Composition surface:** framework-neutral controller core with thin React hooks and an optional provider.
2. **Ownership and outputs:** the session owns acquired/generated resources; standard track/stream outputs expose output-change events; application-owned output clones have independent lifetimes; no caller-supplied capture input, borrowed ownership, input adoption, or input transfer surface exists.
3. **Track identity:** session identity remains stable while replacement-visible track changes are reported through output-change events.
4. **Processor policy:** bypass to original media is the default recoverable behavior, with observable bypassed/degraded/unsupported/failed state and error evidence.
5. **Operation settlement:** tagged results distinguish cancellation and supersession from failure.
6. **Initial release scope:** first-party effect factories only; a generic processor/plugin contract is deferred.
7. **Exact names and type surface:** export names, generic parameters, discriminants, promise signatures, and internal processor interfaces remain implementation-reviewable and are not silently final.
8. **Compatibility:** SSR-safe import and inert server behavior are required; browser-only activation is explicit; Node and React Native remain out of scope.

Implementation may choose validated backends, worker/runtime placement, transform order, and transport adapters within these semantics. A material change to an accepted choice requires explicit user review and a new or superseding Decision; exact names must be settled through implementation type review before publication.

## Acceptance-criteria evidence map

| Criterion | Evidence in this contract |
| --- | --- |
| #1 States, transitions, cancellation, errors, retries, ownership | Snapshot/state definitions, transition table, generation-based cancellation, typed error categories, explicit retry rules, ownership matrix, sharing and cleanup sections. |
| #2 React examples | Examples cover composition, stable rerendering, overlapping requests/cancellation, multiple consumers, unmounting, and development Strict Mode. |
| #3 Independent extension boundaries | Separate video/audio lifecycle contracts, semantic effect configuration, independent failures/retries, standard per-kind outputs, and replaceable backend rules. |
| #4 SSR/non-browser behavior | Import/constructor/browser-global rules, inert server snapshot, hydration activation, secure-context/Permissions Policy/CSP errors, and no Node fallback. |
| #5 Decisions and implementation residuals | Decision-1 remains the accepted product baseline and decision-2 records the approved API/lifecycle semantics; exact names and type spellings remain implementation-reviewable residuals. |
| #6 Alternatives and approval gate | The reviewed alternatives and tradeoffs are retained, decision-2 records explicit user approval, and only exact names/type spellings and implementation details remain implementation-reviewable. |

## Validation and follow-up

The accepted contract should be validated against the same deterministic fixtures used by TASK-1.3, plus processor/output fixtures from TASK-1.4 and TASK-1.5. Before implementation is released, tests must cover:

- stale acquisition and processor completions after cancel, replacement, unmount, and dispose;
- Strict Mode setup/cleanup/setup with no stale attachment or leak;
- one shared session versus deliberately independent sessions;
- session-owned input/output cleanup and application-clone isolation;
- replacement success/failure with preview, recorder, and sender adapters;
- independently failing video/audio processors;
- SSR import, server snapshot, hydration parity, and no browser-global access at module evaluation;
- five start/stop cycles and inactive resource/retained-memory invariants.

No implementation files or production exports are changed by this contract-recording Decision. Implementation may proceed only within the accepted semantics; exact exports/types require implementation review, and any material scope change requires explicit user approval and a follow-up or superseding Decision.
