/**
 * Disposable capture/lifecycle experiment for TASK-1.3.
 *
 * This file deliberately has no dependency on the package under development.
 * It uses a deterministic MediaDevices/MediaStreamTrack double so that React
 * lifecycle and browser completion races can be replayed without a camera or
 * microphone. The `CaptureSession` methods mirror the effect setup/cleanup
 * boundaries that a future React adapter must handle; this is not production
 * library code.
 */

import assert from "node:assert/strict";

let nextSourceId = 1;
let nextStreamId = 1;
let nextTrackId = 1;
let nextRequestId = 1;

const waitForMicrotasks = () => new Promise((resolve) => queueMicrotask(resolve));

class EventTargetDouble {
  #listeners = new Map();

  addEventListener(type, listener) {
    const listeners = this.#listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.#listeners.set(type, listeners);
  }

  removeEventListener(type, listener) {
    this.#listeners.get(type)?.delete(listener);
  }

  dispatchEvent(event) {
    for (const listener of this.#listeners.get(event.type) ?? []) {
      listener.call(this, event);
    }
  }
}

class Recorder {
  entries = [];

  record(actor, event, detail = {}) {
    this.entries.push({
      at: this.entries.length + 1,
      actor,
      event,
      ...detail,
    });
  }

  count(event, predicate = () => true) {
    return this.entries.filter((entry) => entry.event === event && predicate(entry)).length;
  }

  has(event, predicate = () => true) {
    return this.count(event, predicate) > 0;
  }

  find(event, predicate = () => true) {
    return this.entries.find((entry) => entry.event === event && predicate(entry));
  }
}

class FakeSource {
  constructor(kind, recorder) {
    this.kind = kind;
    this.id = `source-${nextSourceId++}`;
    this.recorder = recorder;
    this.tracks = new Set();
  }

  createTrack() {
    const track = new FakeTrack(this, this.recorder);
    this.tracks.add(track);
    return track;
  }

  release(track) {
    this.tracks.delete(track);
    if (this.tracks.size === 0) {
      this.recorder.record("browser", "browser.source.stopped", {
        sourceId: this.id,
        kind: this.kind,
      });
    }
  }
}

class FakeTrack extends EventTargetDouble {
  constructor(source, recorder) {
    super();
    this.id = `track-${nextTrackId++}`;
    this.kind = source.kind;
    this.source = source;
    this.recorder = recorder;
    this.readyState = "live";
    this.stopCount = 0;
    this.cloneCount = 0;
  }

  stop(owner = "unknown") {
    this.stopCount += 1;
    if (this.readyState === "ended") {
      this.recorder.record("browser", "browser.track.stop.ignored", {
        trackId: this.id,
        owner,
      });
      return;
    }

    this.readyState = "ended";
    this.source.release(this);
    // Browser behavior: MediaStreamTrack.stop() does not dispatch `ended`.
    this.recorder.record("browser", "browser.track.stop", {
      trackId: this.id,
      owner,
      kind: this.kind,
    });
  }

  clone() {
    this.cloneCount += 1;
    const clone = this.source.createTrack();
    this.recorder.record("browser", "browser.track.clone", {
      from: this.id,
      to: clone.id,
      kind: this.kind,
      sourceId: this.source.id,
    });
    return clone;
  }

  endExternally(reason = "device-removed") {
    if (this.readyState === "ended") return;
    this.readyState = "ended";
    this.source.release(this);
    this.recorder.record("browser", "browser.track.event.ended", {
      trackId: this.id,
      reason,
      kind: this.kind,
    });
    this.dispatchEvent({ type: "ended", reason });
  }

  mute(reason = "device-interrupted") {
    this.recorder.record("browser", "browser.track.event.mute", {
      trackId: this.id,
      reason,
      kind: this.kind,
    });
    this.dispatchEvent({ type: "mute", reason });
  }
}

class FakeStream {
  constructor(tracks, recorder, label = "capture") {
    this.id = `stream-${nextStreamId++}`;
    this.label = label;
    this.tracks = tracks;
    this.recorder = recorder;
  }

  getTracks() {
    return [...this.tracks];
  }

  getAudioTracks() {
    return this.tracks.filter((track) => track.kind === "audio");
  }

  getVideoTracks() {
    return this.tracks.filter((track) => track.kind === "video");
  }
}

function makeStream(recorder, { audio = true, video = true, label = "capture" } = {}) {
  const tracks = [];
  if (audio) tracks.push(new FakeSource("audio", recorder).createTrack());
  if (video) tracks.push(new FakeSource("video", recorder).createTrack());
  return new FakeStream(tracks, recorder, label);
}

class FakeMediaDevices {
  constructor(recorder) {
    this.recorder = recorder;
    this.outcomes = [];
    this.pending = new Map();
  }

  queue(outcome) {
    this.outcomes.push(outcome);
  }

  get pendingRequestIds() {
    return [...this.pending.keys()];
  }

  getUserMedia(constraints) {
    const id = `request-${nextRequestId++}`;
    const outcome = this.outcomes.shift() ?? { type: "defer" };
    this.recorder.record("browser", "browser.getUserMedia.request", {
      requestId: id,
      constraints,
    });

    const promise = new Promise((resolve, reject) => {
      this.pending.set(id, { id, constraints, resolve, reject });
    });

    if (outcome.type === "resolve") {
      queueMicrotask(() => this.resolve(id, outcome.stream));
    } else if (outcome.type === "reject") {
      queueMicrotask(() => this.reject(id, outcome.error));
    } else if (outcome.type === "partial-reject") {
      queueMicrotask(() => this.reject(id, outcome.error, outcome.partialStream));
    }

    return promise;
  }

  resolve(id, stream = makeStream(this.recorder)) {
    const request = this.pending.get(id);
    assert.ok(request, `cannot resolve unknown media request ${id}`);
    this.pending.delete(id);
    this.recorder.record("browser", "browser.getUserMedia.resolve", {
      requestId: id,
      streamId: stream.id,
    });
    request.resolve(stream);
  }

  reject(id, error = new DOMException("capture failed", "NotReadableError"), partialStream) {
    const request = this.pending.get(id);
    assert.ok(request, `cannot reject unknown media request ${id}`);
    this.pending.delete(id);
    this.recorder.record("browser", "browser.getUserMedia.reject", {
      requestId: id,
      name: error.name,
      partialStreamId: partialStream?.id,
    });
    request.reject(Object.assign(error, { partialStream }));
  }
}

function stopStream(stream, owner) {
  for (const track of stream?.getTracks() ?? []) {
    track.stop(owner);
  }
}

/**
 * A deliberately small controller used only by this experiment. Its
 * generation and ownership rules are the behavior under test, not a proposal
 * for the production API.
 */
class CaptureSession {
  constructor(name, mediaDevices, recorder) {
    this.name = name;
    this.mediaDevices = mediaDevices;
    this.recorder = recorder;
    this.mounted = false;
    this.constraints = undefined;
    this.state = "idle";
    this.error = undefined;
    this.generation = 0;
    this.pending = undefined;
    this.active = undefined;
  }

  mount(constraints, { strictMode = false } = {}) {
    assert.equal(this.mounted, false, `${this.name} cannot mount twice`);
    this.mounted = true;
    this.constraints = constraints;
    this.render("mount");
    this.effectSetup("mount");

    if (strictMode) {
      // React 18/19 development Strict Mode probes effects as setup -> cleanup
      // -> setup on the initial mount. The first request remains a browser
      // promise; cleanup can invalidate library work but cannot abort it.
      this.recorder.record("react", "react.strict-mode.effect-probe");
      this.effectCleanup("strict-mode-probe");
      this.effectSetup("strict-mode-probe");
    }
  }

  rerender(nextConstraints = this.constraints) {
    assert.equal(this.mounted, true, `${this.name} must be mounted to rerender`);
    this.render("rerender");
    if (JSON.stringify(nextConstraints) === JSON.stringify(this.constraints)) {
      this.recorder.record("react", "react.effect.skipped", { session: this.name });
      return;
    }

    this.effectCleanup("dependency-change");
    this.constraints = nextConstraints;
    this.effectSetup("dependency-change");
  }

  cancel(reason = "caller") {
    assert.equal(this.mounted, true, `${this.name} must be mounted to cancel`);
    this.invalidatePending(`cancelled:${reason}`);
    this.state = this.active ? "active" : "cancelled";
    this.recorder.record("library", "library.request.cancelled", {
      session: this.name,
      reason,
    });
  }

  replace(constraints, reason = "replace") {
    assert.equal(this.mounted, true, `${this.name} must be mounted to replace`);
    this.effectCleanup(reason);
    this.constraints = constraints;
    this.effectSetup(reason);
  }

  retry(reason = "retry") {
    assert.equal(this.mounted, true, `${this.name} must be mounted to retry`);
    this.effectCleanup(reason);
    this.effectSetup(reason);
  }

  unmount() {
    if (!this.mounted) return;
    this.effectCleanup("unmount");
    this.releaseActive("library.unmount");
    this.mounted = false;
    this.state = "idle";
    this.recorder.record("react", "react.unmount", { session: this.name });
  }

  effectSetup(reason) {
    const generation = ++this.generation;
    const request = {
      generation,
      reason,
      cancelled: false,
      requestId: undefined,
    };
    this.pending = request;
    this.state = "requesting";
    this.error = undefined;
    this.recorder.record("react", "react.effect.setup", {
      session: this.name,
      generation,
      reason,
    });

    const promise = this.mediaDevices.getUserMedia(this.constraints);
    request.requestId = this.mediaDevices.pendingRequestIds.at(-1);
    promise.then(
      (stream) => this.resolve(request, stream),
      (error) => this.reject(request, error),
    );
  }

  effectCleanup(reason) {
    this.recorder.record("react", "react.effect.cleanup", {
      session: this.name,
      reason,
      generation: this.generation,
    });
    this.invalidatePending(reason);
    // Replacement deliberately retains the current stream until its new
    // request succeeds. Unmount releases it below. This makes the continuity
    // tradeoff observable instead of hiding it in effect cleanup.
  }

  invalidatePending(reason) {
    if (!this.pending) return;
    this.pending.cancelled = true;
    this.recorder.record("library", "library.request.invalidated", {
      session: this.name,
      requestId: this.pending.requestId,
      generation: this.pending.generation,
      reason,
    });
    this.pending = undefined;
  }

  isCurrent(request) {
    return this.mounted && !request.cancelled && request.generation === this.generation && this.pending === request;
  }

  resolve(request, stream) {
    if (!this.isCurrent(request)) {
      this.recorder.record("library", "library.stale-completion.discarded", {
        session: this.name,
        requestId: request.requestId,
        generation: request.generation,
        streamId: stream.id,
      });
      stopStream(stream, "library.stale-completion");
      return;
    }

    const previous = this.active;
    this.pending = undefined;
    this.active = { stream, owned: true };
    this.state = "active";
    this.error = undefined;
    this.recorder.record("library", previous ? "library.replacement.swapped" : "library.capture.attached", {
      session: this.name,
      requestId: request.requestId,
      streamId: stream.id,
      previousStreamId: previous?.stream.id,
    });
    if (previous) stopStream(previous.stream, "library.replacement");
    this.observeTracks(stream);
  }

  reject(request, error) {
    if (!this.isCurrent(request)) {
      if (error.partialStream) {
        stopStream(error.partialStream, "library.stale-partial-completion");
      }
      this.recorder.record("library", "library.stale-error.discarded", {
        session: this.name,
        requestId: request.requestId,
        name: error.name,
      });
      return;
    }

    this.pending = undefined;
    if (error.partialStream) {
      stopStream(error.partialStream, "library.partial-acquisition");
      this.recorder.record("library", "library.partial-acquisition.cleaned", {
        session: this.name,
        streamId: error.partialStream.id,
      });
    }
    this.error = { name: error.name, message: error.message };
    this.state = this.active ? "active" : "failed";
    this.recorder.record("library", "library.capture.failed", {
      session: this.name,
      requestId: request.requestId,
      name: error.name,
      replacementPreserved: Boolean(this.active),
    });
  }

  observeTracks(stream) {
    for (const track of stream.getTracks()) {
      track.addEventListener("ended", () => {
        if (this.active?.stream !== stream) return;
        this.state = "ended";
        this.recorder.record("library", "library.track.ended-observed", {
          session: this.name,
          streamId: stream.id,
          trackId: track.id,
        });
      });
      track.addEventListener("mute", (event) => {
        this.recorder.record("library", "library.track.muted-observed", {
          session: this.name,
          streamId: stream.id,
          trackId: track.id,
          reason: event.reason,
        });
      });
    }
  }

  releaseActive(owner) {
    if (!this.active) return;
    const active = this.active;
    this.active = undefined;
    if (active.owned) stopStream(active.stream, owner);
    this.recorder.record("library", "library.capture.detached", {
      session: this.name,
      streamId: active.stream.id,
      owned: active.owned,
      owner,
    });
  }

  adoptExternal(stream) {
    assert.equal(this.mounted, true, `${this.name} must be mounted to adopt an external stream`);
    this.active = { stream, owned: false };
    this.state = "active";
    this.observeTracks(stream);
    this.recorder.record("library", "library.external-track.attached", {
      session: this.name,
      streamId: stream.id,
    });
  }

  render(reason) {
    this.recorder.record("react", "react.render", {
      session: this.name,
      reason,
      state: this.state,
    });
  }
}

class SharedCapture {
  constructor(name, session, recorder) {
    this.name = name;
    this.session = session;
    this.recorder = recorder;
    this.consumers = new Set();
  }

  subscribe(consumer) {
    assert.equal(this.consumers.has(consumer), false, `${consumer} is already subscribed`);
    this.consumers.add(consumer);
    this.recorder.record("library", "library.shared.subscribe", {
      shared: this.name,
      consumer,
      count: this.consumers.size,
    });
    if (this.consumers.size === 1) {
      this.session.mount({ audio: true, video: true });
    }
  }

  unsubscribe(consumer) {
    assert.equal(this.consumers.has(consumer), true, `${consumer} is not subscribed`);
    this.consumers.delete(consumer);
    this.recorder.record("library", "library.shared.unsubscribe", {
      shared: this.name,
      consumer,
      count: this.consumers.size,
    });
    if (this.consumers.size === 0) this.session.unmount();
  }
}

class Experiment {
  assertions = 0;
  scenarios = [];

  check(condition, message) {
    this.assertions += 1;
    assert.ok(condition, message);
  }

  async scenario(name, callback) {
    const recorder = new Recorder();
    const mediaDevices = new FakeMediaDevices(recorder);
    await callback({ recorder, mediaDevices, session: (id = "capture") => new CaptureSession(id, mediaDevices, recorder), makeStream: (options) => makeStream(recorder, options) });
    this.scenarios.push({
      name,
      events: recorder.entries.length,
      browserEvents: recorder.entries.filter((entry) => entry.actor === "browser").length,
      reactEvents: recorder.entries.filter((entry) => entry.actor === "react").length,
      libraryEvents: recorder.entries.filter((entry) => entry.actor === "library").length,
      entries: recorder.entries,
    });
  }
}

async function run() {
  const experiment = new Experiment();

  await experiment.scenario("mount, unmount, remount, rerender, and Strict Mode", async ({ recorder, mediaDevices, session, makeStream }) => {
    const capture = session("lifecycle");
    mediaDevices.queue({ type: "defer" });
    mediaDevices.queue({ type: "defer" });
    capture.mount({ audio: true, video: true }, { strictMode: true });
    experiment.check(recorder.count("react.effect.setup") === 2, "Strict Mode performs two effect setups");
    experiment.check(recorder.count("react.effect.cleanup") === 1, "Strict Mode performs the probe cleanup");
    const [firstRequest, secondRequest] = mediaDevices.pendingRequestIds;
    const firstStream = makeStream({ label: "strict-stale" });
    mediaDevices.resolve(firstRequest, firstStream);
    await waitForMicrotasks();
    experiment.check(firstStream.getTracks().every((track) => track.readyState === "ended"), "late Strict Mode stream is stopped");
    experiment.check(capture.active === undefined, "stale Strict Mode stream is never attached");
    const activeStream = makeStream({ label: "strict-current" });
    mediaDevices.resolve(secondRequest, activeStream);
    await waitForMicrotasks();
    experiment.check(capture.active?.stream === activeStream, "current Strict Mode stream is attached");
    capture.rerender({ audio: true, video: true });
    experiment.check(recorder.has("react.effect.skipped"), "rerender with stable dependencies does not reacquire");
    mediaDevices.queue({ type: "defer" });
    capture.rerender({ audio: true, video: false });
    const replacementRequest = mediaDevices.pendingRequestIds[0];
    experiment.check(activeStream.getTracks().some((track) => track.readyState === "live"), "active stream remains live while replacement is pending");
    const replacementStream = makeStream({ audio: true, video: false, label: "rerender-replacement" });
    mediaDevices.resolve(replacementRequest, replacementStream);
    await waitForMicrotasks();
    experiment.check(capture.active?.stream === replacementStream, "changed constraints attach the replacement");
    experiment.check(activeStream.getTracks().every((track) => track.readyState === "ended"), "replacement stops the previous owned tracks");
    capture.unmount();
    experiment.check(replacementStream.getTracks().every((track) => track.readyState === "ended"), "unmount stops the active owned tracks");
  });

  await experiment.scenario("overlap, cancellation, and stale asynchronous completion", async ({ recorder, mediaDevices, session, makeStream }) => {
    const capture = session("races");
    mediaDevices.queue({ type: "defer" });
    capture.mount({ video: true });
    const oldRequest = mediaDevices.pendingRequestIds[0];
    mediaDevices.queue({ type: "defer" });
    capture.rerender({ video: false });
    const currentRequest = mediaDevices.pendingRequestIds.at(-1);
    const oldStream = makeStream({ audio: false, video: true, label: "obsolete" });
    mediaDevices.resolve(oldRequest, oldStream);
    await waitForMicrotasks();
    experiment.check(recorder.has("library.stale-completion.discarded"), "obsolete completion is recorded as discarded");
    experiment.check(oldStream.getTracks().every((track) => track.readyState === "ended"), "obsolete completion cannot leak a live track");
    const currentStream = makeStream({ audio: false, video: true, label: "current" });
    mediaDevices.resolve(currentRequest, currentStream);
    await waitForMicrotasks();
    experiment.check(capture.active?.stream === currentStream, "latest request wins");

    mediaDevices.queue({ type: "defer" });
    capture.replace({ video: true, deviceId: "new-device" }, "rapid-switch");
    const cancelledRequest = mediaDevices.pendingRequestIds[0];
    capture.cancel("caller-abort");
    const cancelledStream = makeStream({ audio: false, video: true, label: "cancelled-late" });
    mediaDevices.resolve(cancelledRequest, cancelledStream);
    await waitForMicrotasks();
    experiment.check(capture.active?.stream === currentStream, "cancellation preserves the existing active stream");
    experiment.check(cancelledStream.getTracks().every((track) => track.readyState === "ended"), "late cancelled stream is stopped");
    experiment.check(recorder.has("library.request.cancelled"), "caller cancellation is observable");
    capture.unmount();
  });

  await experiment.scenario("independent and explicitly shared consumers", async ({ recorder, mediaDevices, session, makeStream }) => {
    const first = session("consumer-a");
    const second = session("consumer-b");
    mediaDevices.queue({ type: "defer" });
    mediaDevices.queue({ type: "defer" });
    first.mount({ audio: true });
    second.mount({ audio: true });
    const [firstRequest, secondRequest] = mediaDevices.pendingRequestIds;
    const firstStream = makeStream({ audio: true, video: false, label: "consumer-a" });
    const secondStream = makeStream({ audio: true, video: false, label: "consumer-b" });
    mediaDevices.resolve(firstRequest, firstStream);
    mediaDevices.resolve(secondRequest, secondStream);
    await waitForMicrotasks();
    experiment.check(first.active?.stream !== second.active?.stream, "independent consumers acquire isolated streams");
    first.unmount();
    experiment.check(secondStream.getTracks().every((track) => track.readyState === "live"), "one consumer cannot stop another consumer's owned stream");
    second.unmount();
    experiment.check(secondStream.getTracks().every((track) => track.readyState === "ended"), "the second owner stops its own stream on unmount");

    const sharedSession = session("shared-source");
    const shared = new SharedCapture("shared", sharedSession, recorder);
    mediaDevices.queue({ type: "defer" });
    shared.subscribe("consumer-1");
    shared.subscribe("consumer-2");
    const sharedRequest = mediaDevices.pendingRequestIds[0];
    const sharedStream = makeStream({ audio: true, video: false, label: "shared" });
    mediaDevices.resolve(sharedRequest, sharedStream);
    await waitForMicrotasks();
    experiment.check(mediaDevices.pendingRequestIds.length === 0, "explicit sharing performs one acquisition");
    shared.unsubscribe("consumer-1");
    experiment.check(sharedStream.getTracks().every((track) => track.readyState === "live"), "detaching one shared consumer retains the source");
    shared.unsubscribe("consumer-2");
    experiment.check(sharedStream.getTracks().every((track) => track.readyState === "ended"), "shared owner stops only after the final consumer detaches");

    const cloneSource = makeStream({ audio: true, video: false, label: "clone-source" });
    const original = cloneSource.getAudioTracks()[0];
    const clone = original.clone();
    original.stop("consumer-1");
    experiment.check(clone.readyState === "live", "cloned track has independent track lifetime");
    clone.stop("consumer-2");
    experiment.check(cloneSource.getAudioTracks()[0].readyState === "ended", "underlying source ends after all cloned tracks stop");

    const externalSession = session("external-input");
    mediaDevices.queue({ type: "defer" });
    externalSession.mount({ audio: true });
    const externalPending = mediaDevices.pendingRequestIds.at(-1);
    const externalStream = makeStream({ audio: true, video: false, label: "caller-owned" });
    externalSession.adoptExternal(externalStream);
    externalSession.unmount();
    const lateOwnedByLibrary = makeStream({ audio: true, video: false, label: "external-race" });
    mediaDevices.resolve(externalPending, lateOwnedByLibrary);
    await waitForMicrotasks();
    experiment.check(externalStream.getTracks().every((track) => track.readyState === "live"), "detaching an external stream does not stop caller-owned tracks");
    experiment.check(lateOwnedByLibrary.getTracks().every((track) => track.readyState === "ended"), "a pending library request is still cleaned after external detachment");
  });

  await experiment.scenario("permission, device, removal, switching, partial acquisition, and retry", async ({ recorder, mediaDevices, session, makeStream }) => {
    const denied = session("denied");
    mediaDevices.queue({ type: "reject", error: new DOMException("permission denied", "NotAllowedError") });
    denied.mount({ audio: true });
    await waitForMicrotasks();
    experiment.check(denied.state === "failed" && denied.error.name === "NotAllowedError", "permission denial is a typed failed state");

    mediaDevices.queue({ type: "reject", error: new DOMException("device missing", "NotFoundError") });
    denied.retry();
    await waitForMicrotasks();
    experiment.check(denied.state === "failed" && denied.error.name === "NotFoundError", "missing device remains distinguishable from denial");

    const partial = session("partial");
    const provisional = makeStream({ label: "partial-provisional" });
    mediaDevices.queue({
      type: "partial-reject",
      error: new DOMException("hardware failed", "NotReadableError"),
      partialStream: provisional,
    });
    partial.mount({ audio: true, video: true });
    await waitForMicrotasks();
    experiment.check(provisional.getTracks().every((track) => track.readyState === "ended"), "partial acquisition is cleaned up on failure");
    experiment.check(recorder.has("library.partial-acquisition.cleaned"), "partial cleanup is leak-visible");

    const switching = session("switching");
    mediaDevices.queue({ type: "defer" });
    switching.mount({ video: true, deviceId: "camera-a" });
    const initialRequest = mediaDevices.pendingRequestIds[0];
    const initial = makeStream({ audio: false, video: true, label: "camera-a" });
    mediaDevices.resolve(initialRequest, initial);
    await waitForMicrotasks();
    const initialTrack = initial.getVideoTracks()[0];
    mediaDevices.queue({ type: "defer" });
    switching.replace({ video: true, deviceId: "camera-b" }, "device-switch");
    const switchRequest = mediaDevices.pendingRequestIds[0];
    experiment.check(initialTrack.readyState === "live", "replacement-first switching retains the old track while pending");
    mediaDevices.reject(switchRequest, new DOMException("camera removed", "NotFoundError"));
    await waitForMicrotasks();
    experiment.check(switching.active?.stream === initial, "failed replacement preserves a working old track");
    experiment.check(initialTrack.readyState === "live", "failed replacement does not stop the old track");
    initialTrack.endExternally("device-removed");
    experiment.check(switching.state === "ended", "device removal reaches the consumer state");
    mediaDevices.queue({ type: "resolve", stream: makeStream({ audio: false, video: true, label: "camera-c" }) });
    switching.retry("device-recovery");
    await waitForMicrotasks();
    experiment.check(switching.state === "active", "device removal can recover through an explicit retry");
    switching.unmount();

    experiment.check(recorder.has("browser.getUserMedia.reject", (entry) => entry.name === "NotAllowedError"), "browser denial is separately recorded");
    experiment.check(recorder.has("browser.getUserMedia.reject", (entry) => entry.name === "NotFoundError"), "browser missing-device rejection is separately recorded");
    experiment.check(recorder.has("browser.track.event.ended"), "browser-originated track ending is separately recorded");
  });

  await experiment.scenario("unmount while pending and browser stop semantics", async ({ recorder, mediaDevices, session, makeStream }) => {
    const capture = session("unmount-race");
    mediaDevices.queue({ type: "defer" });
    capture.mount({ audio: true, video: true });
    const request = mediaDevices.pendingRequestIds[0];
    capture.unmount();
    const late = makeStream({ label: "unmount-late" });
    mediaDevices.resolve(request, late);
    await waitForMicrotasks();
    experiment.check(late.getTracks().every((track) => track.readyState === "ended"), "unmount invalidates and stops a late stream");
    experiment.check(capture.active === undefined, "unmount prevents late attachment");
    experiment.check(recorder.count("browser.track.event.ended") === 0, "library stop does not rely on an ended event");
  });

  const eventCounts = {};
  for (const scenario of experiment.scenarios) {
    for (const entry of scenario.entries) eventCounts[entry.event] = (eventCounts[entry.event] ?? 0) + 1;
  }

  const report = {
    status: "passed",
    scenarios: experiment.scenarios.map(({ name, events, browserEvents, reactEvents, libraryEvents }) => ({
      name,
      events,
      browserEvents,
      reactEvents,
      libraryEvents,
    })),
    assertions: experiment.assertions,
    eventCounts,
    evidence: {
      strictModeEffectSequence: "setup -> cleanup -> setup",
      staleCompletionPolicy: "invalidate generation; stop any late stream; never attach it",
      replacementPolicyUnderTest: "keep current owned stream until replacement succeeds; preserve it on replacement failure",
      ownershipPolicyUnderTest: "independent acquisitions are isolated; explicit shared owner stops after final consumer; external resources are not stopped",
      stopEventObservation: "stop() transitions readyState to ended without dispatching ended; external device loss dispatches ended",
    },
  };

  console.log("CAPTURE_LIFECYCLE_EXPERIMENT_PASS");
  console.log(JSON.stringify(report, null, 2));
}

run().catch((error) => {
  console.error("CAPTURE_LIFECYCLE_EXPERIMENT_FAIL");
  console.error(error.stack ?? error);
  process.exitCode = 1;
});
