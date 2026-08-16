---
id: doc-4
title: Capture Lifecycle Experiment Findings
type: specification
created_date: '2026-08-16 16:31'
updated_date: '2026-08-16 16:36'
---
# Capture Lifecycle Experiment Findings

Date: 2026-08-17 (Asia/Tokyo)
Task: TASK-1.3 — Validate capture behavior across the React lifecycle
Status: Research evidence only; no production API or architecture decision is accepted by this report.

## Scope and evidence boundary

This is a disposable experiment for learning how a future capture adapter must behave. It does not import production code, add package dependencies, or select a public API. The accepted product contract in doc-1 requires React 18.2/19, browser-only capture after hydration and explicit user action, SSR-safe imports, deterministic ownership, retry, cancellation, and cleanup. The device identity and browser support constraints in TASK-1.2 and TASK-1.13 are treated as inputs, not repeated or changed here. The prior-art alternatives in doc-2 remain approval-gated.

The deterministic harness uses fake MediaDevices, streams, tracks, and deferred promises so that a camera or microphone is not required. The browser page additionally renders a real React 18.3.1 development Strict Mode root and uses the same style of fake media controls. Fake results establish ordering, ownership, and cleanup invariants; they are not claims about every physical device or browser.

## Disposable artifact and reproduction

The artifact is under experiments/capture-lifecycle:

- run.mjs is a dependency-free Node harness. It runs five scenarios and 41 assertions covering lifecycle transitions, races, ownership and sharing, failure/retry, device loss, replacement, partial cleanup, and unmount.
- index.html is a manual browser witness. It loads React 18.3.1 development UMD scripts from unpkg.com, renders a real React.StrictMode root, and exposes controls for resolving or rejecting pending requests, changing constraints, device removal, and mount/unmount.
- README.md contains the short reproduction guide and explains why this directory is not production code.

Deterministic command from the repository root:

~~~sh
node --check experiments/capture-lifecycle/run.mjs
node experiments/capture-lifecycle/run.mjs
~~~

Observed on 2026-08-17:

- node --check passed.
- The harness printed CAPTURE_LIFECYCLE_EXPERIMENT_PASS, completed 5 scenarios, and passed 41 assertions.
- The report counted 17 fake getUserMedia requests, 5 stale completions discarded, 2 successful replacements, 4 typed failures, 1 partial-acquisition cleanup, 1 externally ended track, and 19 track stops.
- google-chrome --headless=new --no-sandbox --disable-gpu --dump-dom http://127.0.0.1:6421/index.html loaded the page successfully with Chrome 151.0.7922.137. The initial DOM event log contained two getUserMedia requests and the Strict Mode effect sequence setup, cleanup, setup.
- The browser witness requires a local HTTP server and network access for its React CDN scripts. It is supplementary; the deterministic harness is the repeatable acceptance evidence.

## Scenario matrix

| Scenario | Reproduction | Observation | Responsibility boundary |
| --- | --- | --- | --- |
| Mount, remount, rerender, Strict Mode | Mount under a React Strict Mode root; resolve the first and second probe requests; rerender once with stable constraints and once with changed constraints; unmount | Development Strict Mode performs effect setup, cleanup, setup. Stable dependencies do not reacquire. Changed constraints invalidate the old request. | React schedules render/effect work. Browser promises may outlive an effect. Library must identify the current generation and own cleanup. |
| Overlap, cancellation, stale completion | Start request A, change constraints to start B, resolve A after invalidation, resolve B, then cancel a pending replacement and resolve it late | A late stream is never attached and all of its tracks are stopped. Cancellation preserves the active stream and disposes a late result. | Browser has no generic getUserMedia abort in this experiment. Library cancellation is logical invalidation plus late-result disposal. |
| Independent consumers | Mount two sessions and resolve separate requests | Separate getUserMedia calls produce isolated streams. Unmounting consumer A does not stop consumer B. | Each session owns only the tracks it acquired. |
| Explicitly shared consumers | Subscribe two consumers to one shared owner, then release them one at a time | Sharing performs one acquisition. The source remains live after the first unsubscribe and stops after the final unsubscribe. | Sharing requires an explicit owner/reference policy; a consumer must not stop a shared track directly. |
| Cloned and external resources | Clone a track and stop each clone separately; attach a caller-owned stream and unmount | Cloned tracks have separate track lifetimes while the fake underlying source remains until all clones stop. External tracks remain live when the library detaches. | Clone and external semantics must be explicit. The library stops only resources it owns. |
| Permission and missing device | Reject initial and retry requests with NotAllowedError and NotFoundError | Failures retain their DOMException names and are distinguishable. Retry is explicit rather than an endless reacquisition loop. | Browser supplies typed evidence. Library normalizes stable categories while retaining the original name/cause. |
| Device removal and switching | Attach camera A, start a replacement for camera B, reject it, end camera A externally, then retry camera C | The old track remains live while replacement is pending and remains live when replacement fails. External loss dispatches ended and reaches consumer state. Explicit retry recovers. | Browser emits track loss. Library chooses replacement transaction and retry policy; no silent device fallback is accepted here. |
| Partial acquisition | Reject with a provisional stream attached to the injected error | Every provisional track is stopped on rejection, including a stale partial rejection. | getUserMedia normally resolves one stream or rejects; partial resources can still exist in multi-step library orchestration and must have an owner/cleanup path. |
| Unmount while pending | Start a deferred request, unmount, then resolve the request | The late stream is stopped and never attached. Library stop sets readyState to ended without relying on an ended event. | React cleanup invalidates the consumer. Browser promise completion still requires library disposal. |

## Findings

### React behavior

1. Development Strict Mode is an intentional effect probe. The real browser fixture observed two acquisition calls with setup, cleanup, setup on initial mount. A future adapter must be idempotent across this probe and must not treat the first cleanup as proof that the second setup is obsolete.
2. Effect cleanup can run while getUserMedia is still pending. Unmount and dependency changes therefore cannot be implemented as a boolean UI reset only; the completion callback must carry a generation or equivalent identity.
3. A rerender with stable acquisition inputs does not need a new request. A rerender with changed constraints must invalidate the old request before starting a new one. React ordering alone does not stop a browser promise from resolving later.
4. Cleanup work can be invoked more than once in development and through caller retries. Resource release must be idempotent. The harness records ignored repeated track stops instead of treating them as a fatal state.
5. A consumer component is not a safe resource identity by itself. A component can remount while a parent or provider continues to represent the same logical capture, so ownership must live in an explicit controller/store boundary if sharing is needed.

Primary reference: React Strict Mode documentation at https://react.dev/reference/react/StrictMode.

### Browser behavior

1. getUserMedia is asynchronous and can remain pending while the user ignores a permission prompt. A library-level AbortSignal or cancel action can stop publication of the result, but cannot assume that the browser promise itself was aborted.
2. Permission denial, missing devices, and unreadable hardware are different DOMException categories. The harness records NotAllowedError, NotFoundError, and NotReadableError separately. The stable consumer state can normalize them, but the original name and cause remain useful diagnostics.
3. getUserMedia normally returns one complete MediaStream or rejects; it does not expose a partial stream to a caller. The partial scenario intentionally injects a provisional stream into a rejection to represent resources created by a future multi-step controller or processor. Those resources still need deterministic cleanup.
4. MediaStreamTrack.stop() sets the track to ended without dispatching an ended event. External device removal is a different path: the harness changes readyState and dispatches ended, which the session observes. Cleanup must therefore stop owned tracks directly and also listen for externally caused track loss.
5. Track cloning gives consumers independent track objects, but it does not make source ownership implicit. In the harness, the source stays live until the original and clone both stop. A shared track object and cloned tracks are different sharing contracts.
6. Device switching is reacquisition, not applyConstraints on the existing track. TASK-1.13 records the cross-browser device identity and fallback constraints. This experiment adds lifecycle evidence: acquire-then-swap avoids stopping a working track when the replacement is unavailable, at the cost of temporarily holding both resources.

Primary references: Media Capture and Streams at https://www.w3.org/TR/mediacapture-streams/, MediaDevices.getUserMedia at https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia, MediaStreamTrack.stop at https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack/stop, MediaStreamTrack ended event at https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack/ended_event, and MediaStreamTrack.clone at https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack/clone.

### Library responsibilities indicated by the evidence

The following are constraints for future design work, not an accepted API:

- Give every acquisition a request generation or equivalent identity. Invalidate it on unmount, cancellation, replacement, and changed constraints. A late success must stop every track and never update active state; a late failure must not overwrite a newer result.
- Make cancellation observable and separate from browser abort. Preserve an active stream when a pending replacement is cancelled, unless the caller explicitly requests a full stop.
- Define resource ownership per input and output. Acquired streams are owned by the acquiring controller; external streams are borrowed; shared capture has one explicit owner that releases the source after the last consumer.
- Make replacement transactional when continuity matters: keep the old owned stream until the replacement succeeds, then swap and stop the old tracks. Preserve the old stream after replacement failure. The experiment does not choose whether the public API exposes this as a transaction, switch method, or effect policy.
- Normalize errors into stable categories while retaining DOMException name, constraint/device context, and cause. Expose denial, unavailable, ended, retryable, and processor/resource failure states without collapsing them into one string.
- Treat cleanup as idempotent and leak-visible. Stop owned tracks on every success, stale success, replacement, partial failure, and unmount path; detach borrowed resources without stopping them.
- Keep React responsibilities narrow: render state and subscribe to an explicit lifecycle owner. Do not make render itself acquire media, and do not rely on component mount identity to provide sharing.

## Approval-gated API implications

No public API, compatibility promise, ownership model, switching policy, or architecture decision is accepted by this experiment. The evidence should be presented to the user before dependent implementation. The main alternatives and tradeoffs are:

1. Effect-scoped stop/reacquire versus acquire-then-swap. Stop/reacquire is simpler and releases hardware quickly but produces a preview gap and can discard a working track before a replacement failure is known. Acquire-then-swap preserves continuity and supports recovery but temporarily doubles resources and requires request identity and explicit replacement semantics. The harness exercises acquire-then-swap as a research candidate only.
2. Independent capture per consumer versus an explicitly shared controller. Independent capture isolates ownership but may prompt twice and consume two devices. A shared controller avoids duplicate acquisition but needs provider/controller lifetime and final-subscriber cleanup. Automatic cloning or implicit reference counting is convenient but can retain hardware unexpectedly.
3. Exclusive ownership versus borrowed/external tracks. Exclusive ownership is easiest to clean up. Borrowed tracks are required for interoperability but must never be stopped by a consumer that did not acquire them. The harness exercises both; it does not select the public type shape.
4. Browser abort versus logical cancellation. Assuming browser abort is portable would leave late-stream leaks. Generation invalidation plus late disposal is portable in the experiment, while an AbortSignal can still stop library work such as retries or processing initialization.
5. Silent fallback versus observable replacement failure. Falling back to a default device can recover more often but can surprise the user after an explicit selection. TASK-1.13 recommends treating remembered IDs as hints and explicit picker IDs as exact; this task leaves the public fallback policy unaccepted.

## Browser, React, and library distinction

| Evidence | Browser behavior | React behavior | Future library responsibility |
| --- | --- | --- | --- |
| Pending request | Permission-gated promise can remain unresolved; no generic abort assumed | Effect may be cleaned up before settlement | Invalidate request, expose pending/cancelled state, stop late stream |
| Strict Mode | Browser sees two ordinary requests | Development probe runs setup, cleanup, setup | Make setup/cleanup idempotent and prevent stale first result from attaching |
| Track cleanup | stop sets readyState to ended without ended event | Unmount invokes cleanup but does not know track internals | Stop owned tracks directly and listen for external ended/mute |
| Device loss | Track can end or mute externally; replacement requires a new acquisition | React does not infer physical device state | Surface ended/degraded state and apply an explicit retry/switch policy |
| Multiple consumers | Separate calls and clones have distinct browser resource behavior | Components can mount independently or share a provider | Define ownership, sharing, clone, and final-release semantics |
| Failure | DOMException name identifies broad cause | State update can race a newer render/unmount | Preserve evidence, classify errors, reject stale failure, clean partial resources |

## Acceptance-criteria evidence mapping

- #1: run.mjs scenario “mount, unmount, remount, and Strict Mode” plus the real React Strict Mode witness reproduces setup/cleanup/setup, stable rerender, changed-constraint rerender, unmount, and remount instructions in README.md.
- #2: the overlap scenario starts two generations, resolves the obsolete one late, cancels a replacement, resolves it late, and asserts that stale streams are stopped and never attached.
- #3: the consumer scenario asserts isolated streams for separate acquisitions, one acquisition for an explicit shared owner, final-subscriber cleanup, independent clone lifetimes, and borrowed external tracks that remain live after detach.
- #4: the failure scenario records permission denial, missing device, device removal, failed switching, partial acquisition, and explicit retry with typed names and state assertions.
- #5: the report counts cleanup of stale success, successful replacement, unmount, partial failure, shared final release, and borrowed detach; it also asserts stop-versus-ended event semantics.
- #6: the report has separate React, browser, and library findings plus the responsibility table above.
- #7: experiments/capture-lifecycle contains the disposable artifact and README.md reproduction steps; this document records observations, evidence, limitations, and approval-gated API implications.

## Validation record

- node --check experiments/capture-lifecycle/run.mjs: passed.
- node experiments/capture-lifecycle/run.mjs: passed; CAPTURE_LIFECYCLE_EXPERIMENT_PASS; 5 scenarios; 41 assertions.
- Browser fixture smoke test: passed in Chrome 151.0.7922.137 from a local HTTP origin; initial Strict Mode setup/cleanup/setup and two pending requests were visible in the dumped DOM.
- No production package files, dependencies, public exports, or Backlog Decisions were changed by this task.
