---
id: TASK-1.13
title: Analyze media-device discovery and selection behavior
status: Done
assignee:
  - '@codex'
created_date: '2026-08-13 21:02'
updated_date: '2026-08-16 10:39'
labels: []
dependencies:
  - TASK-1.1
  - TASK-1.2
parent_task_id: TASK-1
priority: high
type: spike
ordinal: 4000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Determine the consumer-visible behavior required to discover, label, select, remember, switch, and recover media devices using getUserMedia and enumerateDevices. Analyze browser behavior and representative existing libraries before recommending a contract; do not implement production code or accept an architecture in this task.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A dated cross-browser flow documents device visibility and identity before and after permission, including labels, deviceId, groupId, default devices, privacy-driven identifier changes, and relevant output-device limitations
- [x] #2 Representative existing libraries are compared for discovery, selection, preference persistence, switching, fallback, device removal, and error behavior, with sources plus licensing and maintenance context
- [x] #3 Selection alternatives are evaluated for constraint handling, preferred versus exact matches, front or rear camera intent, defaults, unavailable devices, and reacquisition behavior
- [x] #4 The recommended consumer states, events, errors, and fallback rules are supported by reproducible evidence and identify implications for the React lifecycle spike
- [x] #5 Alternatives and tradeoffs are presented to the user, and no significant product or architecture decision is treated as accepted without explicit user approval
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Inspect existing task, decisions, docs, source/test conventions, and browser capability evidence.
2. Gather dated primary-source/reproducible evidence for getUserMedia, enumerateDevices, permissions, identifiers, switching, output-device limits, and cross-browser differences.
3. Compare representative maintained libraries, licensing, and behavior for discovery, selection, persistence, fallback, removal, and errors.
4. Record a research-only consumer contract proposal with alternatives, tradeoffs, evidence, and React lifecycle implications; leave significant decisions approval-gated.
5. Run repository checks, verify each acceptance criterion, and finalize TASK-1.13 only.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Research record — 2026-08-16

This is a research-only record for TASK-1.13. It does not implement production code and does not accept a public API, product, or architecture decision. The evidence boundary is the accepted initial contract in Decision 1 and TASK-1.2: React 18.2/19, browser-only after hydration and explicit user action, secure top-level/allowed iframe contexts, and modern desktop Chrome/Edge/Firefox/Safari as the target; mobile is not an initial guarantee.

### 1. Dated cross-browser flow

Normative source: W3C Media Capture and Streams (https://www.w3.org/TR/mediacapture-streams/), especially the enumerateDevices algorithm, device-information exposure, getUserMedia permission/selection, constraints, and MediaStreamTrack applyConstraints sections. enumerateDevices requires a secure context, a fully active visible document, and may expose only a redacted/default subset before permission. Labels may be empty; identifiers are opaque and exposure is permission/policy/storage-partition dependent. Re-enumeration after permission/capture is therefore part of the consumer flow; a pre-permission list must not be treated as complete.

| Flow point | Normative/consumer-visible behavior | Reproducible evidence from this run (2026-08-16) | Browser boundary |
| --- | --- | --- | --- |
| Initial discovery before permission | The UA can return only the first/default input per kind, redact labels and IDs, and withhold other devices. Output enumeration is also permission/policy sensitive. A list can be non-empty but incomplete. | Chrome 151.0.7922.137 headless with --use-fake-device-for-media-stream on secure loopback returned one audioinput, one videoinput, and one audiooutput entry with empty label, deviceId, and groupId before permission. Firefox 153.0.3 headless fake media returned audioinput and videoinput entries with all three fields empty and no output entry at this point. | Exact fake-device counts/names are environment-specific, but redaction and incomplete-list behavior are the important observation. |
| Permission and capture | getUserMedia can remain pending while the user does not answer. On grant, the UA selects devices satisfying required constraints; denial/policy, no matching device, busy hardware, or unreadable source reject with typed DOMExceptions. | In Chrome, CDP granted audio/video permission and getUserMedia({audio:true,video:true}) then re-enumeration exposed fake input/output labels and non-empty IDs/groups; track settings contained deviceId/groupId. In Firefox, fake getUserMedia then re-enumeration exposed Default Audio Device, Default Video Device, and RDP Sink, each with non-empty IDs/groups; track settings contained device IDs and video facingMode/frameRate. | These are deterministic fake-media probes, not a claim about real hardware names or every release. |
| Post-permission refresh | The consumer should enumerate again after a successful grant and reconcile by kind plus opaque deviceId. Do not parse labels or assume one global ID namespace; Media Capture defines uniqueness for an (id, kind) pair. Default pseudo-devices are normally first. | Chrome post-grant order put fake default input/output entries first. The Firefox run put its default input entries first. | Firefox Bug 1879204 reports system-default ordering/default-device-change behavior fixed in Firefox 145; exact release behavior still merits feature detection. |
| Identity over time | deviceId is opaque and origin-scoped. It may persist for the origin while a live track/stored permission exists, but can rotate after storage/cookie clearing, private browsing, partition changes, or UA privacy decisions. groupId associates physical devices in one document but is unique per document and is not a cross-session preference key. | Two Chrome 151 launches using the same temporary profile and fake flags kept the same deviceIds after permission, while groupIds changed between documents/sessions. This demonstrates why a remembered groupId must not be used as a durable key. | WebKit Bug 179220 documents historical Safari ID rotation across refresh and pre-permission dummy IDs; use this as a privacy/compatibility warning, not as a current Safari version guarantee. |
| Removal/default change | devicechange may be delayed or suppressed by visibility/privacy rules. Reconcile with enumerateDevices and independently observe active tracks' mute/ended events. A default device can change without the selected physical ID disappearing. | The local probes did not hot-unplug hardware; normative behavior and the LiveKit source comparison below provide the recovery model. | TASK-1.3 is the lifecycle experiment follow-up; this task records the consumer contract inputs only. |
| Output selection | audiooutput is distinct from input capture. setSinkId is per HTMLMediaElement, secure-context-only, and can require speaker-selection Permissions Policy and user consent; selectAudioOutput requires transient activation. The default output uses sinkId empty string. | Chrome fake enumeration exposed output after input permission; Firefox fake enumeration exposed an output after fake capture. Do not infer that non-default output is always enumerable or selectable. | Use feature detection. Safari/Firefox/Edge exact output behavior must be verified by target-browser runs; current task does not claim unobserved local results. |

Local probe setup was reproducible with Chrome launched using a temporary profile, --headless=new, --use-fake-device-for-media-stream, and secure loopback; permission was granted through CDP after the pre-permission enumeration. Firefox used Firefox 153.0.3, geckodriver 0.37.0, headless mode, and the documented fake-media preferences media.navigator.streams.fake=true and media.navigator.permission.disabled=true. The probe deliberately recorded both pre-permission and post-grant lists, then repeated Chrome with the same profile to compare IDs and group IDs. TASK-1.2 already contains the dated Chrome/Firefox API-presence matrix and explicitly marks Edge/Safari as unverified; this task consumes that evidence rather than duplicating it.

Primary privacy/permission references: W3C Media Capture and Streams — device exposure and identity (https://www.w3.org/TR/mediacapture-streams/), W3C Audio Output Devices API (https://www.w3.org/TR/audio-output/), and W3C Permissions (https://www.w3.org/TR/permissions/).

### 2. Identity, labels, defaults, output, and selection implications

The consumer-visible contract supported by the Media Capture specification is:

- Call enumerateDevices only in a secure, fully active, visible document and after the required iframe Permissions Policy is in place. Treat a pre-permission list as partial. After a successful capture grant, enumerate again because labels, IDs, and additional devices may become visible.
- Display label as opaque user-facing text when non-empty, but never parse it to infer model, camera direction, or whether a device is input/output. Use a localized placeholder such as Camera 1 or Microphone 1 when it is empty. Do not use labels, groupId, or a globally unqualified deviceId as a React key.
- Group devices by kind first. DeviceId uniqueness is scoped with kind, so an audioinput and audiooutput can legally use the same string. Preserve the UA-provided default entry and identify the default audio output by the spec-defined empty sinkId/default semantics rather than assuming every browser exposes an identical literal ID.
- Treat deviceId as a revocable, opaque preference hint, not an entitlement or hardware identity. A stored value can be missing, rotated, partitioned, or no longer enumerable. Persisting an ID is useful only as a best-effort same-origin preference and must have a fallback.
- Treat groupId as a same-document association hint (for example, a headset microphone and speaker), not a durable preference key. The same-physical-device relation can help pair devices in the current enumeration, but groupId is intentionally regenerated per document.
- A remembered deviceId should normally be passed as a bare or ideal deviceId constraint so the UA can use it when available and select a replacement/default when it is unavailable. The W3C remembered-device example specifically warns against an exact constraint for a stored preference. An explicit in-content picker should use deviceId exact and surface failure instead of silently choosing a different device.
- deviceId on applyConstraints cannot change the source to another physical device. Switching requires a new getUserMedia acquisition. Use applyConstraints only for settings supported by the already attached source.
- facingMode is an intent constraint: ideal user/environment is a graceful preference; exact environment is a hard requirement and may reject. Once an explicit device picker is shown, deviceId exact is the more direct selection signal. On mobile and some hardware, stop/release the old camera before opening another one; on desktop, acquiring the replacement first and then stopping the old track can reduce blank-video time when the platform permits it.
- Omitted deviceId means let the UA choose its default/preferred source. This is the safest fallback after a remembered ID is rejected, but it must be reported as a change if the consumer had explicitly selected another device.
- A failed reacquisition must not destroy the currently working track until the replacement succeeds where the platform allows overlap. If the current track is already ended/removed, recover with the remembered preference as a best effort, then an ordinary/default request, then a clear unavailable/error state. Do not loop indefinitely or retry a denied permission without a new user gesture.

Recommended selection alternatives (proposal, not an accepted decision):

| Alternative | Benefit | Cost/risk | Evidence-based recommendation |
| --- | --- | --- | --- |
| Bare/ideal remembered deviceId | Survives rotated/missing IDs better; lets UA choose a usable replacement | May not honor a stale preference exactly | Use for persistence across sessions/origin storage. Record the actual track settings deviceId after every successful grant. |
| exact deviceId from a visible picker | Makes explicit user intent deterministic | Fails with NotFoundError/OverconstrainedError when removed, redacted, or rotated; can fail on a different partition | Use for a current picker selection, and expose an unavailable state rather than silently switching. |
| facingMode ideal | Works before enumeration and expresses front/rear intent | UA may choose another camera; desktop semantics vary | Use for initial intent or mobile camera modes; re-enumerate and store the actual selected deviceId after success. |
| facingMode exact | Guarantees the requested facing mode or rejects | Less portable; can make a valid device request fail | Use only when the UI truly requires front/rear mode and has a recovery path. |
| applyConstraints for switching | Keeps the existing track object in APIs that support setting changes | Cannot change deviceId source; may reject as unsatisfiable | Do not use as the device-switch primitive. Reacquire with getUserMedia. |
| Omit deviceId/default | Highest chance of opening a usable source | Loses explicit preference and may change the physical device after default changes | Use as a final best-effort fallback and emit the fallback/recovery result. |

Relevant normative examples are in W3C Media Capture and Streams examples 6 (remembered IDs), 7 (explicit picker and reacquisition), 8 (rear-camera facingMode), 10 (supported constraints), plus the applyConstraints section.

### 3. Representative library comparison

The following comparison uses official repositories, source, API references, or package declarations inspected on 2026-08-16. Maintenance signals are snapshots, not support guarantees; no library behavior is being adopted as this project's contract.

| Library | License and maintenance context | Discovery and labeling | Selection and preference | Switching and removal | Fallback and errors | Consumer lesson |
| --- | --- | --- | --- | --- | --- | --- |
| react-webcam | MIT. Official GitHub repository: https://github.com/mozmorris/react-webcam . The repository was active enough to inspect current master on this date, with a modest component-scale footprint; the visible star/issue counts are only a snapshot and do not establish browser support. | The component itself does not own a device discovery model. Its README shows consumers calling enumerateDevices, filtering videoinput, and rendering label or a blank-label fallback such as Device 1. Constraints are passed through to getUserMedia. | Consumers pass audioConstraints/videoConstraints, including deviceId or facingMode. No built-in cross-session preference store or stable device identity layer is exposed. | Current source reacquires when constraints change, stops and cleans the previous stream, and guards stale/unmounted async results by stopping streams that resolve too late. It does not install devicechange or track-ended recovery for the consumer. | onUserMediaError is one callback; the app interprets DOMException names and owns unavailable-device behavior. No typed fallback/retry taxonomy is supplied. | A low-level React component can provide safe stream ownership and stale-request cleanup while leaving discovery, preference, switching policy, and recovery explicit. Official sources: README https://raw.githubusercontent.com/mozmorris/react-webcam/master/README.md and source https://raw.githubusercontent.com/mozmorris/react-webcam/master/src/react-webcam.tsx . |
| LiveKit client SDK plus React components | Apache-2.0. Official client repository: https://github.com/livekit/client-sdk-js . Official React hook docs: https://docs.livekit.io/reference/components/react/hook/usemediadeviceselect/ . The current monorepo/source was inspected on this date; it is a maintained production SDK, but its room/transport model is broader than a standalone capture hook. | Room device helpers and the React useMediaDeviceSelect hook expose device lists, activeDeviceId, permission request, selection callback, and selection errors. The hook documents that permission requests use getUserMedia to expose labels and warns that repeated requests can cause multiple prompts. Room source enumerates on devicechange, handles default ordering and browser quirks, and emits MediaDevicesChanged. | switchActiveDevice uses an exact input ID by default, while current room capture defaults/options remember the active selection for future room use. The reviewed source did not establish a cross-session local-storage persistence guarantee, so this is session/room preference behavior, not a durable ID promise. It supports explicit camera intent through restartTrack with facingMode. | Input switching updates capture tracks; output switching feature-detects HTMLMediaElement.setSinkId or an AudioContext sink and reverts options on failure. On devicechange, it re-enumerates, detects missing active devices, and moves to an available/default device as appropriate; browser-specific logic covers Safari, iOS, Firefox, and Chrome default changes. Listeners are cleaned with an AbortController/WeakRef lifecycle. | Emits MediaDevicesChanged, ActiveDeviceChanged, and MediaDevicesError. Error categories include permission denied, not found, and device in use. When an active selected ID disappears, source logic selects an available fallback rather than leaving the room permanently stuck, with exceptions for user-provided tracks and Safari output behavior. | A larger SDK demonstrates the value of an observable device store, typed errors, explicit active-device events, and devicechange reconciliation, but its automatic fallback and room defaults would need a deliberate product decision here. Official source: https://raw.githubusercontent.com/livekit/client-sdk-js/main/src/room/Room.ts . |
| Daily React plus Daily Call Client | BSD-2-Clause for daily-react. Official organization/repository context: https://github.com/daily-co/daily-react . The official Daily changelog states support for versions released in the past six months and lists daily-react 0.25.0 on 2026-04-29; this is a useful maintenance policy signal rather than a compatibility guarantee. | useDevices exposes cameras, microphones, speakers, currentCam/currentMic/currentSpeaker, refreshDevices, state, and errors. Official docs/blogs describe enumerateDevices under the hood, default-first sorting, and devicechange/call-object listeners; the provider cleans listeners on unmount. | setCamera, setMicrophone, and setSpeaker use deviceId. The reviewed hook/provider API keeps current call/provider state but did not show a cross-session persistence contract; consumers should not infer one. | Camera selection invokes getUserMedia again; the call client exposes setInputDevicesAsync and setOutputDeviceAsync. Device lists and current selection update through provider/call events. | Granular states include undefined-mediadevices, not-found, unknown, idle, pending, not-supported, granted, blocked, in-use, constraints-invalid, and constraints-none-specified. camera-error is surfaced by Daily Call Client; selected devices can be unavailable/in use and state updates accordingly. | A polished hook makes permission/device availability states first-class and gives consumers refresh/set methods, but its state vocabulary and call-client assumptions are a larger contract than a small capture hook needs. Official references: https://app.unpkg.com/%40daily-co/daily-react%400.21.3/files/dist/hooks/useDevices.d.ts , https://www.daily.co/blog/add-a-prejoin-ui-to-a-custom-video-app-with-the-daily-react-hooks-library-part-2/ , and https://docs.daily.co/reference/daily-js/daily-call-client . |

A lower-level recording hook, @wmik/use-media-recorder (MIT; https://github.com/wmik/use-media-recorder), was also checked as a negative baseline. Its official README exposes mediaStreamConstraints, getMediaStream, acquisition/recording status, and an error, but no device enumeration, selection, persistence, devicechange handling, or recovery contract. It is not a direct device-management peer and was not used to justify product behavior.

Cross-library comparison: all three substantial examples leave the browser's opaque IDs and permission model intact; none can make deviceId a durable hardware identity. The meaningful design range is from react-webcam's low-level constraints plus cleanup, through Daily's explicit state/error vocabulary, to LiveKit's observable store and automatic devicechange fallback. Automatic fallback is materially different from explicit picker semantics, so adopting it would be a product decision requiring approval.

### 4. Research recommendation for consumer-visible states, events, errors, and fallback

The following is a proposal for review, not an accepted product or architecture decision. It combines the W3C permission/exposure/reacquisition rules, the Chrome/Firefox probes above, and the state/event patterns in LiveKit and Daily.

Model capture and output separately, and model each media kind independently where possible. A useful state vocabulary is:

- unsupported: the required browser API or output capability is absent;
- idle: no request has been made;
- permission-pending: getUserMedia or selectAudioOutput is awaiting user action; this can remain pending indefinitely;
- permission-denied: the user, Permissions Policy, secure-context, or browser policy rejected access;
- devices-partial: enumerateDevices returned a redacted/incomplete pre-permission view;
- ready: a usable enumerated list exists, with labels possibly still empty;
- acquiring or switching: a request is in flight;
- active: an owned track or output sink is selected and usable;
- degraded: an active track is muted/ended, selected hardware disappeared, or the output sink became unavailable;
- ended/stopped: the consumer intentionally released its tracks/sinks;
- failed: a non-recoverable or explicitly surfaced acquisition/switch failure.

Suggested application events are devicesChanged (new list plus kind-aware diff and whether it is partial), acquisitionStarted, acquisitionSucceeded (actual track settings), acquisitionFailed, activeDeviceChanged, switchStarted, switchSucceeded, switchFailed, trackMuted, trackEnded, recoveryStarted, recoveryResult, and stopped. These are application-level names, not claims that browsers emit all of them. The browser devicechange event should trigger a fresh enumerateDevices call, but visibility/privacy rules mean it is not sufficient by itself; also observe MediaStreamTrack mute and ended. A permission query is useful as a hint, not a guarantee that a future getUserMedia call will succeed.

Normalize the raw DOMException while preserving the original name/message:

- NotAllowedError: user denial, blocked permission, insecure/policy/Permissions Policy restriction, or output speaker-selection denial;
- NotFoundError: no matching input/output or an explicit device/sink ID is unavailable;
- OverconstrainedError: required constraint cannot be satisfied; retain constraint name when present;
- NotReadableError: hardware/source exists but cannot be opened or is busy/unreadable;
- AbortError: UA/source aborted acquisition or output switching;
- InvalidStateError: document/activation/state precondition failed, including some setSinkId implementations;
- SecurityError and TypeError: unsupported/invalid context or malformed constraints;
- a library-specific category such as device-in-use may be derived only when the browser evidence supports it, not guessed from label text.

Fallback rules recommended for review:

1. Render empty labels with stable localized placeholders and mark the list as redacted/partial; never block the UI solely because labels are empty.
2. For a remembered preference, try a bare/ideal deviceId, then ordinary constraints/default; record the actual selected ID after success. For an explicit current picker choice, use exact deviceId and surface unavailable rather than silently selecting another physical device.
3. On removal/default change, reconcile by kind, preserve the user's explicit preference for a future retry, and try a bounded recovery request. Emit the fallback and recovery result. Do not silently reinterpret a selected camera as a different camera without an observable activeDeviceChanged event.
4. On switch, keep the old working track until the replacement succeeds whenever the platform permits; stop stale/rejected tracks and stop the old track exactly once after a successful handoff. Never leave a stale asynchronous request able to overwrite a newer selection.
5. For output, feature-detect setSinkId/selectAudioOutput and retain the default sink fallback. A permission/policy failure should be visible and should not be converted into a false successful selection.
6. Do not run infinite retries or repeat permission prompts automatically. Recovery can be retried after a devicechange or explicit user action, with a clear terminal state.

React lifecycle implications for TASK-1.3:

- Keep browser calls out of render and SSR module evaluation; invoke them after hydration and explicit user intent or in a guarded client effect.
- Install devicechange and track listeners with stable references; clean them on unmount, stop, disconnect, or ownership transfer. Strict Mode mount/unmount/remount should not leak listeners or duplicate capture.
- Use a request generation/abort guard. If an older getUserMedia promise resolves after a newer request or unmount, stop its tracks and do not publish it.
- Enumerate after permission success, on devicechange, after visibility/resume where useful, and after recovery. Reconcile snapshots by kind plus opaque ID; do not use labels or groupId as durable React keys.
- Decide ownership explicitly: a hook that creates a stream must stop its tracks, while a consumer-provided stream must not be stopped by the hook unless ownership is transferred.
- Handle audio and video partial success deliberately; do not report one combined success if the other kind failed. Keep output sink state separate from input capture.
- Preserve raw constraints and DOMException details for diagnostics while exposing normalized stable states to consumers.
- Treat output selection as a user-gesture-sensitive flow and do not initiate selectAudioOutput from a passive effect.

No significant decision was accepted in this research. The states/events/fallbacks above are alternatives and recommendations for explicit user review; in particular, automatic fallback versus explicit failure, cross-session preference storage, public event names, and output-device scope remain approval-gated. No new Backlog Decision was created or modified.

### 5. Validation evidence — 2026-08-16

- Local browser probes completed: Chrome 151.0.7922.137 and Firefox 153.0.3 fake-media runs on secure loopback, including pre-permission/post-grant enumerateDevices, track settings, and same-profile Chrome identifier comparison. Edge and Safari were explicitly left as unverified local observations.
- Primary-source review completed: W3C Media Capture and Streams, W3C Audio Output Devices API, W3C Permissions, Firefox Bug 1879204, and WebKit Bugs 179220 and 289529; URLs are recorded above.
- Representative-library source review completed: react-webcam (MIT), LiveKit client/React (Apache-2.0), Daily React/Call Client (BSD-2-Clause), plus the lower-level use-media-recorder baseline; official URLs and maintenance context are recorded above.
- pnpm run backlog:dispatchable passed and returned the next leaf tasks; this task was not dispatched again.
- pnpm run validate:lifecycle passed with Task-to-PR lifecycle policy and runbook: OK.
- git diff --check passed.
- No production source, workflow policy, or Backlog Decision file was changed; only this task's CLI-managed status/plan/notes/finalization fields are being updated.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Completed the TASK-1.13 research record with dated Chrome 151 and Firefox 153 fake-media probes, W3C/browser privacy and output-device evidence, and explicit Edge/Safari verification boundaries. Compared react-webcam (MIT), LiveKit (Apache-2.0), Daily React (BSD-2-Clause), and a lower-level recorder hook, then documented constraint-selection alternatives, proposed states/events/errors/fallbacks, and React lifecycle implications without accepting a product or architecture decision. Verified all five acceptance criteria, pnpm run backlog:dispatchable, pnpm run validate:lifecycle, and git diff --check; no production or workflow files changed.
<!-- SECTION:FINAL_SUMMARY:END -->
