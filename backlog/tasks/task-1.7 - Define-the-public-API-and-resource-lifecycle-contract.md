---
id: TASK-1.7
title: Define the public API and resource-lifecycle contract
status: Done
assignee:
  - '@codex'
created_date: '2026-08-13 20:31'
updated_date: '2026-08-20 15:08'
labels: []
dependencies:
  - TASK-1.3
  - TASK-1.4
  - TASK-1.5
  - TASK-1.16
  - TASK-1.17
references:
  - doc-6
  - decision-2
modified_files:
  - backlog/docs/api/doc-6 - Public-API-and-Resource-Lifecycle-Contract.md
  - >-
    backlog/decisions/decision-2 -
    Accept-the-public-API-and-resource-lifecycle-contract.md
parent_task_id: TASK-1
priority: high
type: task
ordinal: 13000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Turn validated browser and React constraints into a coherent consumer-facing contract for capture and composable processing. Focus on observable behavior and extension boundaries; defer replaceable implementation details.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The contract defines states, transitions, cancellation, errors, retries, and ownership for media resources
- [x] #2 React-facing usage examples cover composition, rerendering, overlapping requests, multiple consumers, unmounting, and development Strict Mode
- [x] #3 Extension boundaries allow video and audio processing to evolve independently while preserving a coherent consumer model
- [x] #4 Server rendering and non-browser import behavior are explicitly defined
- [x] #5 Resolved significant architectural decisions are recorded with Backlog.md Decisions, while unresolved questions remain tracked as questions or follow-up tasks
- [x] #6 Public API alternatives and tradeoffs are presented to the user, and the contract is not treated as approved until the user explicitly accepts it
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Record the user's explicit approval against existing decision-1, doc-6, TASK-1.7, and PR #14, and confirm the Backlog CLI limitation for Decision body fields. 2. Create one accepted Decision through the Backlog CLI, fill only its required body sections via the narrowly allowed new-Decision exception while preserving frontmatter exactly, and link it to TASK-1.7/doc-6. 3. Update doc-6 through backlog doc update to make the approved controller, ownership, output, replacement, processor, operation, release-scope, SSR, and approval-residual choices normative while retaining implementation-reviewable exact names and the no-external-input scope. 4. Update TASK-1.7 through the Backlog CLI with the Decision reference, approval and CLI evidence, final summary, acceptance verification, and Done status; run checks, commit the scoped records, push PR #14, and verify clean state without merging.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-08-19: Read the task and reviewed accepted decision-1 plus docs 1-5 and dependency tasks TASK-1.3, TASK-1.4, TASK-1.5, TASK-1.16, and TASK-1.17. Evidence consistently supports explicit async lifecycle/state, generation-based stale-request cancellation, session-owned media resources, standard MediaStreamTrack/MediaStream outputs, independently attachable video/audio processors, and SSR-safe import with browser-only activation; existing reports keep all public API and architecture choices approval-bound.

2026-08-19: Created Backlog doc-6, Public API and Resource-Lifecycle Contract Proposal. It defines a proposed observable state machine, generation-based logical cancellation, typed errors/retry rules, session-owned capture/output resources, explicit sharing and idempotent cleanup, independent video/audio boundaries, React examples for all required lifecycle cases, SSR-safe imports/browser-only activation, and alternatives with tradeoffs. The document is explicitly unapproved; open questions cover composition surface, output lifetime/identity, bypass policy, operation settlement, extension scope, exact types, and compatibility declaration.

Validation 2026-08-19: doc-6 was viewed through the Backlog CLI and contains the full proposal, state/transition table, cancellation/error/retry/ownership rules, React examples, independent video/audio boundaries, SSR/import contract, alternatives/tradeoffs, open questions, and acceptance-evidence map. Task-to-PR lifecycle policy and runbook: OK, {
  "schemaVersion": 1,
  "kind": "dispatchable-task-list",
  "selectedTask": {
    "id": "TASK-1.6",
    "title": "Define the cross-browser verification strategy",
    "status": "To Do",
    "type": "task",
    "priority": "medium",
    "parentTaskId": "TASK-1",
    "ordinal": 12000
  },
  "selectedTasks": [
    {
      "id": "TASK-1.6",
      "title": "Define the cross-browser verification strategy",
      "status": "To Do",
      "type": "task",
      "priority": "medium",
      "parentTaskId": "TASK-1",
      "ordinal": 12000
    }
  ],
  "tasks": [
    {
      "id": "TASK-1.6",
      "title": "Define the cross-browser verification strategy",
      "status": "To Do",
      "type": "task",
      "priority": "medium",
      "parentTaskId": "TASK-1",
      "ordinal": 12000
    }
  ]
}, , CAPTURE_LIFECYCLE_EXPERIMENT_PASS
{
  "status": "passed",
  "scenarios": [
    {
      "name": "mount, unmount, remount, rerender, and Strict Mode",
      "events": 33,
      "browserEvents": 16,
      "reactEvents": 12,
      "libraryEvents": 5
    },
    {
      "name": "overlap, cancellation, and stale asynchronous completion",
      "events": 28,
      "browserEvents": 12,
      "reactEvents": 9,
      "libraryEvents": 7
    },
    {
      "name": "independent and explicitly shared consumers",
      "events": 50,
      "browserEvents": 20,
      "reactEvents": 16,
      "libraryEvents": 14
    },
    {
      "name": "permission, device, removal, switching, partial acquisition, and retry",
      "events": 44,
      "browserEvents": 21,
      "reactEvents": 14,
      "libraryEvents": 9
    },
    {
      "name": "unmount while pending and browser stop semantics",
      "events": 12,
      "browserEvents": 6,
      "reactEvents": 4,
      "libraryEvents": 2
    }
  ],
  "assertions": 41,
  "eventCounts": {
    "react.render": 13,
    "react.effect.setup": 17,
    "browser.getUserMedia.request": 17,
    "react.strict-mode.effect-probe": 1,
    "react.effect.cleanup": 15,
    "library.request.invalidated": 5,
    "browser.getUserMedia.resolve": 13,
    "library.stale-completion.discarded": 5,
    "browser.source.stopped": 19,
    "browser.track.stop": 19,
    "library.capture.attached": 6,
    "react.effect.skipped": 1,
    "library.replacement.swapped": 2,
    "library.capture.detached": 7,
    "react.unmount": 8,
    "library.request.cancelled": 1,
    "library.shared.subscribe": 2,
    "library.shared.unsubscribe": 2,
    "browser.track.clone": 1,
    "library.external-track.attached": 1,
    "browser.getUserMedia.reject": 4,
    "library.capture.failed": 4,
    "library.partial-acquisition.cleaned": 1,
    "browser.track.event.ended": 1,
    "library.track.ended-observed": 1,
    "browser.track.stop.ignored": 1
  },
  "evidence": {
    "strictModeEffectSequence": "setup -> cleanup -> setup",
    "staleCompletionPolicy": "invalidate generation; stop any late stream; never attach it",
    "replacementPolicyUnderTest": "keep current owned stream until replacement succeeds; preserve it on replacement failure",
    "ownershipPolicyUnderTest": "independent acquisitions are isolated; explicit shared owner stops after final consumer; external resources are not stopped",
    "stopEventObservation": "stop() transitions readyState to ended without dispatching ended; external device loss dispatches ended"
  }
} (CAPTURE_LIFECYCLE_EXPERIMENT_PASS; 41 assertions). Accepted decision evidence: decision-1.

Scope narrowing 2026-08-20: The user-approved narrowing supersedes only the proposal’s caller-supplied capture-input ownership and adoption/transfer references. The historical lifecycle fixture evidence, React/SSR evidence, and unrelated proposal alternatives remain retained below; the embedded doc-6 content is the current narrowed, explicitly unapproved proposal.

---
id: doc-6
title: Public API and Resource-Lifecycle Contract Proposal
type: specification
created_date: '2026-08-19 02:25'
updated_date: '2026-08-19 18:14'
---
# Public API and Resource-Lifecycle Contract Proposal

Status: Proposal for explicit user review; not an accepted public API, compatibility contract, or architecture decision.
Date: 2026-08-19 (Asia/Tokyo)
Task: TASK-1.7 — Define the public API and resource-lifecycle contract

## Authority and evidence boundary

The accepted baseline is decision-1 / [Initial Product and Quality Contract](../product/initial-product-quality-contract/doc-1 - Initial-Product-and-Quality-Contract.md): a headless React library for local camera and microphone capture, first-party video and audio effects, standard browser media interoperability, React 18.2/19, modern evergreen desktop browsers, and SSR-safe imports. That baseline deliberately does not choose the public API shape, processor runtime, worker strategy, acceleration path, output identity, or internal transform order.

This document turns the completed evidence work into a consumer-facing contract proposal. The words “must”, “should”, and “may” below describe the proposal submitted for approval; they do not make a significant API or architecture choice accepted. The proposal is based on:

- doc-2, Public API Ecosystem Prior Art (TASK-1.16);
- doc-3, Media Output and Transport Interoperability (TASK-1.17);
- doc-4, Capture Lifecycle Experiment Findings (TASK-1.3);
- Browser Video Processing Feasibility (TASK-1.4);
- Browser Audio Processing Feasibility (TASK-1.5);
- the browser and React boundaries accepted in doc-1.

No new Backlog.md Decision is created by this document because the user has not explicitly accepted any of the alternatives below. Once the user chooses a significant option, the choice must be recorded with \`backlog decision create\` before dependent implementation treats it as normative.

## Contract goals and non-goals

The proposed contract lets an application:

1. explicitly start, stop, retry, switch, and release local media;
2. observe capture, processor, output, and error state without inferring it from a video element;
3. compose semantic video effects (crop, background blur/replacement, primary-subject auto-framing) independently from semantic audio effects (voice noise reduction);
4. share one explicitly owned media session across React consumers without duplicate acquisition;
5. hand standard \`MediaStreamTrack\` and \`MediaStream\` values to previews, recorders, WebRTC adapters, and other browser APIs;
6. use the same lifecycle vocabulary from a framework-neutral core and a thin React adapter;
7. import and render safely in SSR applications while deferring all browser work until hydration and explicit application action.

The contract does not include product UI, WebRTC signaling/rooms, recording/transcoding/storage, cloud processing, React Native, Node-side media processing, arbitrary model tensors, or a guarantee that every browser exposes the same processing backend. Effect implementation order, model/runtime selection, worker placement, and acceleration remain replaceable behind the semantic boundary.

## Proposed consumer model

### Stable session identity outside render

The proposal uses one framework-neutral session/controller as the resource owner. A React hook subscribes to an immutable snapshot; it does not create or acquire media during render.

Illustrative names and TypeScript shapes are intentionally provisional:

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

The final names, generic parameters, and exact return types require user approval and implementation-driven type review. The important proposed properties are stable session identity, explicit actions, observable snapshots, standard outputs, and an idempotent terminal \`dispose()\`.

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

This is a proposal, not a final output-lifetime model. Until the output alternative is approved, the intended safety rule is that attaching \`output.stream\` to a preview, recorder, or sender does not change session ownership and detaching a consumer does not stop the session. An application needing an independent lifetime uses clone(). The session emits an output-change record whenever the current track changes; applications must reattach a preview or call their transport adapter's replacement operation as appropriate.

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

The exact promise settlement convention (resolve with a tagged result versus reject with \`MediaError\`) is an unresolved API choice. Whichever convention is selected, stale operations must not produce unhandled rejections or overwrite a newer snapshot.

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

Errors are observable through the snapshot and operation result. The contract should also support an optional diagnostic callback/event stream, but the callback shape and logging policy remain open. No telemetry or media upload occurs by default.

## Ownership, sharing, and cleanup

Capture and processor inputs originate from the session’s own acquisition; applications configure capture through session actions and do not supply tracks directly.

### Ownership categories

| Resource | Proposed default owner | Consumer rule |
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

Automatic reference counting tied to React subscriptions is not proposed as the default because provider remounts and transient Strict Mode subscriptions can retain or stop hardware unexpectedly. A future scoped-lifetime helper may be added only with explicit semantics and leak tests.

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

These are illustrative extension boundaries, not a decision to expose arbitrary processor classes in the first release. The critical contract is:

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

A processor's readiness is observable. During loading, the session may expose the original track as \`bypassed\` when continuity is preferred. On unsupported capability or recoverable failure, the application sees \`unsupported\`, \`degraded\`, or \`failed\` plus the error code; it does not receive a silent substitution of another device. Whether bypass is the default for each first-party effect is an explicit approval question because fail-open improves continuity while fail-closed can be required by some products.

The contract never promises that a processor can preserve the same underlying track identity. An output-change event is required whenever a generated track replaces the current track.

## React adapter contract

The proposed React adapter is thin and uses \`useSyncExternalStore\` semantics:

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

The final hook overloads and ref helper are open. The behavioral requirements are normative for review:

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

If camera A is active while camera B is pending, camera A remains usable. A later camera C request supersedes B; any late B stream is stopped and never attached. The exact tagged-result versus rejected-promise spelling remains open, but the stale-resource invariant is fixed.

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

Constructing a session on the server is safe if it creates only inert data/controller state. The server snapshot is stable \`idle\` with browser environment marked unavailable; calling \`start()\` server-side returns a stable \`unsupported\`/environment error and creates no media resources. A package may instead reject server-side construction, but that alternative has a larger SSR integration cost and is not the preferred proposal.

### Hydration and browser activation

After hydration, capture and processing begin only from an explicit client action or an application-owned client effect. The first client snapshot must match the server snapshot so hydration does not depend on browser permission state. Browser-only assets are lazy and are loaded only when the corresponding effect is enabled.

Secure context, top-level/iframe Permissions Policy, user gesture requirements, browser capability checks, and model/worklet/worker CSP/CORS requirements are surfaced as \`unsupported\`, \`permission-denied\`, or \`asset-load-failed\` evidence. No Node media-processing fallback is implied. Client-only adapter entry points may be offered for bundlers, but the base import must remain safe.

## API alternatives and tradeoffs for explicit user review

The following alternatives are intentionally presented rather than silently resolved.

### Composition surface

| Option | Benefits | Costs and failure modes |
| --- | --- | --- |
| Hooks-only (\`useMediaSession(config)\`) | Minimal JSX and quick adoption | Resource identity follows component lifecycle; hard to share with non-React consumers; Strict Mode and remount races become hook internals |
| Provider/store only | Natural sharing and selectors | Provider remount can destroy expensive resources; non-React use is awkward; context becomes an accidental ownership contract |
| Imperative controller only | Clear lifetime, framework-neutral tests, easy non-React use | More boilerplate in React; consumers must wire subscriptions and output attachment |
| Controller core + thin hooks, optional provider (recommended for review) | Stable ownership outside render, React-friendly subscriptions, shared subtree, future framework adapters | More types and lifecycle documentation; provider ownership/disposal rules must be explicit |

### Output and ownership

| Option | Benefits | Costs and failure modes |
| --- | --- | --- |
| Standard current track/stream plus semantic output-change event (recommended for review) | Works with preview, recorder, WebRTC, canvas, and Web Audio; preserves implementation freedom | Consumers must handle replacement and transport-specific gaps; explicit clone lifetime rules are needed |
| Opaque effect handle | Maximum internal freedom | Bespoke adapters for every consumer; conflicts with standard-object interop goal |
| Stable track identity through in-place processing | Fewer reattachments | Not available for every backend/browser; can hide gaps and complicate processor replacement |
| New track on every replacement | Honest and broadly implementable | Preview/sender/recorder consumers must reattach or replace; may cause gaps |

For ownership, the proposal favors “the session owns acquired and generated resources; output attachments do not change ownership; explicit application-owned output clones have independent lifetimes.” Automatic cloning/reference counting remains an alternative because it can simplify consumer isolation but risks hidden retention and surprising stop timing.

### Processor readiness and failure

| Option | Benefits | Costs and failure modes |
| --- | --- | --- |
| Bypass to original media while loading/failing (recommended for review) | Preserves continuity and supports graceful degradation | Briefly exposes unprocessed media; may violate an application's effect-required policy |
| Buffer until processed output | Avoids unprocessed exposure | Startup latency, memory pressure, and visible/audio gap |
| Fail closed (no output/silence/black) | Strongest guarantee that processed output is never bypassed | Poor recovery and can turn a capability gap into an unusable product |

The consumer contract can expose a per-effect policy, but the default requires explicit user approval.

### Operation settlement

| Option | Benefits | Costs and failure modes |
| --- | --- | --- |
| Tagged result for cancellation/supersession (recommended for review) | Normal control flow; avoids expected aborts becoming unhandled errors | More result types and call-site branching |
| Reject with typed \`MediaError\` | Familiar async failure shape | Expected overlap/cancel paths can create noisy unhandled rejections; callers must distinguish stale from real failure |
| Both tagged result and optional rejection | Flexible migration | Duplicated semantics and harder documentation/testing |

The implementation must settle every operation deterministically, but the exact promise spelling is unresolved.

## Open questions and required approval

The following questions must be answered explicitly before this proposal becomes a public contract or a new accepted Decision:

1. **Primary composition surface:** approve controller core + thin hooks + optional provider, or choose hooks-only/provider-only/controller-only.
2. **Output ownership:** approve session-owned standard outputs with explicit clone/lifetime rules, or choose a different default model.
3. **Track identity:** approve output-change events with potentially new tracks, or require a stable track strategy where feasible.
4. **Processor failure policy:** choose bypass, buffer, fail-closed, or a per-effect policy as the default.
5. **Operation settlement:** choose tagged results, typed rejection, or both for cancellation/supersession.
6. **First-release extension scope:** confirm whether first-party effect factories only are sufficient, or whether a public custom processor/plugin contract is required now.
7. **Exact names and type surface:** approve the final exports and state/error discriminants after implementation type review.
8. **Compatibility declaration:** confirm that SSR-safe import plus browser-only activation is required for the initial package and that Node/React Native remain out of scope.

Until these are answered, implementation may use disposable internal names in experiments but must not publish them as stable exports. If approval changes scope, create a follow-up task for the changed work rather than silently expanding TASK-1.7.

## Acceptance-criteria evidence map

| Criterion | Evidence in this proposal |
| --- | --- |
| #1 States, transitions, cancellation, errors, retries, ownership | Snapshot/state definitions, transition table, generation-based cancellation, typed error categories, explicit retry rules, ownership matrix, sharing and cleanup sections. |
| #2 React examples | Examples cover composition, stable rerendering, overlapping requests/cancellation, multiple consumers, unmounting, and development Strict Mode. |
| #3 Independent extension boundaries | Separate video/audio lifecycle contracts, semantic effect configuration, independent failures/retries, standard per-kind outputs, and replaceable backend rules. |
| #4 SSR/non-browser behavior | Import/constructor/browser-global rules, inert server snapshot, hydration activation, secure-context/Permissions Policy/CSP errors, and no Node fallback. |
| #5 Decisions and unresolved questions | The only accepted baseline is decision-1; no new significant choice is accepted here. Open questions 1-8 are tracked in this proposal and must be resolved by user approval or follow-up tasks. |
| #6 Alternatives and approval gate | Composition, output/ownership, processor failure, and operation-settlement alternatives include tradeoffs; status and authority explicitly require user acceptance before this proposal becomes normative. |

## Validation and follow-up

This proposal should be reviewed against the same deterministic fixtures used by TASK-1.3, plus processor/output fixtures from TASK-1.4 and TASK-1.5. Before a final contract is accepted, tests must cover:

- stale acquisition and processor completions after cancel, replacement, unmount, and dispose;
- Strict Mode setup/cleanup/setup with no stale attachment or leak;
- one shared session versus deliberately independent sessions;
- session-owned input/output cleanup and application-clone isolation;
- replacement success/failure with preview, recorder, and sender adapters;
- independently failing video/audio processors;
- SSR import, server snapshot, hydration parity, and no browser-global access at module evaluation;
- five start/stop cycles and inactive resource/retained-memory invariants.

No implementation files or production exports are changed by this proposal. The next action is explicit user review; after approval, update TASK-1.7 through the Backlog CLI, create/supersede the required Decision, and then implement only the approved contract.

Historical validation continuity: Only accepted decision-1 exists; no new significant API or architecture decision was created. The proposal remains explicitly unapproved pending user review, satisfying the approval boundary rather than inferring acceptance.

Recovery validation 2026-08-20: Restored the parent structured notes/evidence/final sections through the Backlog CLI and compared the resulting task record with 7105ea0; unrelated lifecycle, React, SSR, fixture, and approval-boundary evidence is retained, while the embedded doc-6 content reflects the current narrowed proposal. pnpm run validate:lifecycle, pnpm run backlog:dispatchable, node --check/run experiments/capture-lifecycle/run.mjs (41 assertions), backlog document/decision checks, git diff --check, task-structure checks, and PR #14 metadata checks passed.

Approval and Decision evidence 2026-08-20: The user explicitly approved the narrowed TASK-1.7 recommendations: controller core with thin hooks/optional provider; session-owned acquired/generated resources; standard track/stream outputs with output-change events; application-owned output clones; stable session identity with visible replacement changes; independent video/audio processor domains; bypass-to-original as the recoverable default; tagged cancellation/supersession results; first-party effect factories only; and SSR-safe browser-only activation with Node/React Native out of scope. The no-caller-input, no-borrowed-ownership, and no-input-adoption/transfer boundary remains preserved.

Decision CLI limitation 2026-08-20: backlog --version reports 1.50.1; backlog decision --help and backlog decision create --help expose only Decision title/status creation and no body-section input/update fields. Created accepted decision-2 through the CLI, then used the narrowly allowed direct-edit exception only for its new body sections; frontmatter remained unchanged. Required body sections Context, Decision Drivers, Considered Options, Decision, Consequences, and Related Tasks are non-empty and reference TASK-1.7/doc-6; no Supersedes section applies because decision-1 remains in force.

Validation 2026-08-20: Objective checks passed after recording approval: pnpm run validate:lifecycle (OK); pnpm run backlog:dispatchable (OK; TASK-1.7 is not dispatchable); node --check experiments/capture-lifecycle/run.mjs (OK); node experiments/capture-lifecycle/run.mjs (CAPTURE_LIFECYCLE_EXPERIMENT_PASS; 41 assertions); git diff --check (OK). Document/Decision checks passed: backlog doc list includes doc-6 Public API and Resource-Lifecycle Contract; backlog decision list shows decision-1 and accepted decision-2; decision-2 frontmatter is unchanged and all required body sections are non-empty; doc-6 accepted status, decision-2 reference, implementation-reviewable residuals, and no-external-input boundary are present. backlog doctor reports the pre-existing duplicate doc-5 IDs in unrelated research directories; no unrelated records were changed.

Final wording validation 2026-08-20: Updated doc-6 through backlog doc update to replace residual “remains open” wording with explicit implementation-reviewable language while preserving all accepted semantic choices. Re-ran lifecycle, dispatchable, fixture (41 assertions), document/Decision, frontmatter/body, working-tree and staged git diff checks successfully; TASK-1.7 remains Done and no merge was performed.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @codex
created: 2026-08-19 02:48
---
Ready for review: doc-6 presents the proposed controller/hooks/provider, standard output and ownership, processor failure, and operation-settlement alternatives with tradeoffs. No public API, compatibility, distribution, or architecture choice is accepted; user approval is required before any proposal becomes normative.
---

author: @codex
created: 2026-08-19 18:06
---
Applying the user-approved scope narrowing to PR #14: remove only the external-input/borrowed/adoption surface and its stale task evidence while preserving session-owned lifecycle, standard outputs, processor cleanup, independent video/audio boundaries, SSR behavior, and the unapproved proposal status.
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Recorded the user's explicit approval in accepted decision-2 and updated doc-6 to the accepted semantic contract: framework-neutral controller core with thin React hooks/optional provider, session-owned resources, standard outputs and output-change events, independent application-owned clones, replacement-visible identity changes, independent processors with bypass default, tagged cancellation/supersession results, first-party-only effects, and SSR-safe browser activation. Preserved the no-caller-input, no-borrowed-ownership, no-input-adoption/transfer boundary and kept exact exports/types implementation-reviewable; TASK-1.7 references decision-2 and records the CLI body-field limitation and allowed new-Decision body fill. Verified all six acceptance criteria, lifecycle, dispatchable, document/decision, fixture (41 assertions), frontmatter/body, and git diff checks; the duplicate doc-5 diagnostic is pre-existing and unrelated, and PR #14 remains unmerged.
<!-- SECTION:FINAL_SUMMARY:END -->
