export const PROTOCOL = "audio-routes-v6";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const timed = async (p, ms, label) => {
  let id;
  try {
    return await Promise.race([
      p,
      new Promise((_, reject) => {
        id = setTimeout(() => reject(Error(label + " timeout")), ms);
      }),
    ]);
  } finally {
    clearTimeout(id);
  }
};
export async function capabilities() {
  const result = {
    protocol: PROTOCOL,
    userAgent: navigator.userAgent,
    isolated: crossOriginIsolated,
    secure: isSecureContext,
    sab: typeof SharedArrayBuffer,
    processor: typeof globalThis.MediaStreamTrackProcessor,
    generator: typeof globalThis.MediaStreamTrackGenerator,
    audioData: typeof globalThis.AudioData,
  };
  const worker = new Worker(new URL("./inference-worker.mjs", import.meta.url), { type: "module" });
  try {
    result.worker = await timed(
      new Promise((r) => {
        worker.onmessage = (e) => r(e.data);
        worker.postMessage({ type: "probe" });
      }),
      3000,
      "worker probe",
    );
  } finally {
    worker.terminate();
  }
  const context = new AudioContext({ sampleRate: 48000 });
  await context.resume();
  const oscillator = context.createOscillator();
  oscillator.frequency.value = 220;
  const dest = context.createMediaStreamDestination();
  oscillator.connect(dest);
  oscillator.start();
  const track = dest.stream.getAudioTracks()[0];
  if (typeof globalThis.MediaStreamTrackProcessor === "function") {
    const clone = track.clone();
    let reader;
    try {
      const p = new globalThis.MediaStreamTrackProcessor({ track: clone, maxBufferSize: 1 });
      reader = p.readable.getReader();
      const { value } = await timed(reader.read(), 1000, "audio processor read");
      result.audioProcessor = {
        ok: true,
        type: value.constructor.name,
        sampleRate: value.sampleRate,
        frames: value.numberOfFrames,
        channels: value.numberOfChannels,
        format: value.format,
      };
      value.close();
    } catch (error) {
      result.audioProcessor = { ok: false, error: String(error) };
    } finally {
      await reader?.cancel().catch(() => {});
      clone.stop();
    }
  } else result.audioProcessor = { ok: false, error: "not exposed in Window" };
  if (typeof globalThis.MediaStreamTrackGenerator === "function") {
    let gen, writer, node;
    try {
      gen = new globalThis.MediaStreamTrackGenerator({ kind: "audio" });
      node = context.createMediaStreamSource(new MediaStream([gen]));
      const gain = context.createGain();
      gain.gain.value = 0;
      node.connect(gain).connect(context.destination);
      writer = gen.writable.getWriter();
      const frame = new AudioData({
        format: "f32-planar",
        sampleRate: 48000,
        numberOfChannels: 1,
        numberOfFrames: 480,
        timestamp: 0,
        data: new Float32Array(480),
      });
      await timed(writer.write(frame), 1000, "audio generator write");
      frame.close();
      result.audioGenerator = { ok: true, kind: gen.kind };
    } catch (error) {
      result.audioGenerator = { ok: false, error: String(error) };
    } finally {
      node?.disconnect();
      gen?.stop();
      await writer?.abort().catch(() => {});
    }
  } else result.audioGenerator = { ok: false, error: "not exposed in Window" };
  track.stop();
  oscillator.stop();
  await context.close();
  return result;
}
export async function profile({ artifacts, stages }) {
  const rows = [];
  for (const [name, url] of Object.entries(artifacts)) {
    const bytes = await (await fetch(url)).arrayBuffer();
    const module = await WebAssembly.compile(bytes);
    const worker = new Worker(new URL("./inference-worker.mjs", import.meta.url), {
      type: "module",
    });
    try {
      const row = await timed(
        new Promise((resolve, reject) => {
          worker.onmessage = (e) =>
            e.data.type === "error" ? reject(Error(e.data.message)) : resolve(e.data);
          worker.onerror = (e) => reject(Error(e.message));
          worker.postMessage({ type: "profile", module, stages });
        }),
        30000,
        "stage profile",
      );
      rows.push({ name, ...row });
    } finally {
      worker.terminate();
    }
  }
  return {
    protocol: PROTOCOL,
    userAgent: navigator.userAgent,
    isolated: crossOriginIsolated,
    rows,
  };
}

async function sabRoute(
  input,
  module,
  onFault,
  { startDelaySamples = 128, capacityFrames = 4, pump = "wait" } = {},
) {
  if (!globalThis.crossOriginIsolated || typeof SharedArrayBuffer !== "function")
    throw Error("unsupported: SAB/cross-origin isolation required");
  const channel = pump === "port" ? new MessageChannel() : null;
  const control = new SharedArrayBuffer(32 * 4),
    inputRing = new SharedArrayBuffer(capacityFrames * 480 * 4),
    outputRing = new SharedArrayBuffer(capacityFrames * 480 * 4),
    c = new Int32Array(control);
  const worker = new Worker(new URL("./inference-worker.mjs", import.meta.url), { type: "module" });
  let stopped,
    stats,
    context,
    node,
    src,
    dest,
    closing = false;
  const done = new Promise((r) => (stopped = r));
  const close = async () => {
    if (closing) return {};
    closing = true;
    Atomics.store(c, 0, 1);
    Atomics.notify(c, 1);
    Atomics.notify(c, 4);
    worker.postMessage({ type: "stopRing" });
    node?.port.postMessage({ type: "stop" });
    await timed(done, 1000, "ring shutdown").catch(() => {});
    worker.terminate();
    src?.disconnect();
    node?.disconnect();
    node?.port.close();
    dest?.stream.getTracks().forEach((t) => t.stop());
    await context?.close();
    return {
      control: Array.from(c),
      stats,
      workerAcknowledged: c[6] === 1,
      contextClosed: context?.state === "closed",
    };
  };
  try {
    await timed(
      new Promise((resolve, reject) => {
        worker.onerror = (e) => reject(Error(e.message));
        worker.onmessage = ({ data }) => {
          if (data.type === "ready") resolve();
          else if (data.type === "fault" || data.type === "error")
            onFault(data.reason ?? data.message);
          else if (data.type === "stopped") {
            stats = data;
            stopped();
          }
        };
        worker.postMessage(
          {
            type: "ring",
            module,
            control,
            input: inputRing,
            output: outputRing,
            pump,
            port: channel?.port2,
          },
          channel ? [channel.port2] : [],
        );
      }),
      1000,
      "ring worker init",
    );
    context = new AudioContext({ sampleRate: 48000 });
    await context.audioWorklet.addModule(new URL("./ring-worklet.mjs", import.meta.url));
    node = new AudioWorkletNode(context, "research-denoise-ring", {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [1],
      channelCount: 1,
      channelCountMode: "explicit",
      processorOptions: {
        control,
        input: inputRing,
        output: outputRing,
        startDelaySamples,
        startupStrategy: pump === "port" ? "cadence" : "clock",
      },
    });
    if (channel) node.port.postMessage({ type: "connect", port: channel.port1 }, [channel.port1]);
    dest = context.createMediaStreamDestination();
    src = context.createMediaStreamSource(new MediaStream([input]));
    src.connect(node).connect(dest);
    const ready = new Promise((resolve, reject) => {
      node.port.onmessage = ({ data }) => {
        if (data.type === "ready") resolve();
        else if (data.type === "fault") {
          onFault(data.reason);
          reject(Error(data.reason));
        }
      };
    });
    await context.resume();
    await timed(ready, 1000, "ring output readiness");
    return {
      track: dest.stream.getAudioTracks()[0],
      metrics: () => ({ control: Array.from(c), stats }),
      close,
    };
  } catch (error) {
    await close();
    throw error;
  }
}
async function rawRoute(input, module, onFault, { bypass = false, delaySamples = 0 } = {}) {
  if (
    typeof globalThis.MediaStreamTrackProcessor !== "function" ||
    typeof globalThis.MediaStreamTrackGenerator !== "function"
  )
    throw Error("unsupported: audio processor/generator not exposed");
  const processor = new MediaStreamTrackProcessor({ track: input, maxBufferSize: 4 }),
    generator = new MediaStreamTrackGenerator({ kind: "audio" });
  const worker = new Worker(new URL("./inference-worker.mjs", import.meta.url), { type: "module" });
  let stats,
    finished,
    closing = false;
  const done = new Promise((r) => (finished = r));
  const close = async () => {
    if (closing) return {};
    closing = true;
    worker.postMessage({ type: "stopRaw" });
    await timed(done, 1000, "raw shutdown").catch(() => {});
    generator.stop();
    worker.terminate();
    return { stats, workerAcknowledged: !!stats };
  };
  try {
    await timed(
      new Promise((resolve, reject) => {
        worker.onerror = (e) => reject(Error(e.message));
        worker.onmessage = ({ data }) => {
          if (data.type === "ready") resolve();
          else if (data.type === "fault" || data.type === "error")
            onFault(data.reason ?? data.message);
          else if (data.type === "stopped") {
            stats = data;
            finished();
          }
        };
        worker.postMessage(
          {
            type: "raw",
            module,
            bypass,
            delaySamples,
            keepOpen: true,
            readable: processor.readable,
            writable: generator.writable,
          },
          [processor.readable, generator.writable],
        );
      }),
      1000,
      "raw worker initialization",
    );
    return { track: generator, metrics: () => ({ stats }), close };
  } catch (error) {
    await close();
    throw error;
  }
}
export async function routes({
  artifacts,
  inputUrl = "/research-input",
  mode = "screen",
  duration = 8,
  windows = 8,
  startDelaySamples = 128,
  cases,
}) {
  const modules = {};
  for (const [name, url] of Object.entries(artifacts))
    modules[name] = await WebAssembly.compile(await (await fetch(url)).arrayBuffer());
  const sourceContext = new AudioContext({ sampleRate: 48000 });
  const observerContext = new AudioContext({ sampleRate: 48000 });
  const contextInfo = (context) => ({
    sampleRate: context.sampleRate,
    baseLatency: context.baseLatency,
    outputLatency: context.outputLatency,
    currentTime: context.currentTime,
    state: context.state,
    outputTimestamp: context.getOutputTimestamp?.(),
  });
  const contextMetadata = {
    start: { source: contextInfo(sourceContext), observer: contextInfo(observerContext) },
  };
  const pcm = new Float32Array(await (await fetch(inputUrl)).arrayBuffer());
  const audio = sourceContext.createBuffer(1, pcm.length, 48000);
  audio.copyToChannel(pcm, 0);
  const playback = sourceContext.createBufferSource();
  playback.buffer = audio;
  playback.loop = true;
  const capture = sourceContext.createMediaStreamDestination();
  capture.channelCount = 1;
  playback.connect(capture);
  const original = capture.stream.getAudioTracks()[0];
  await observerContext.audioWorklet.addModule(new URL("./observer-worklet.mjs", import.meta.url));
  const observer = new AudioWorkletNode(observerContext, "research-output-observer", {
    numberOfInputs: 2,
    outputChannelCount: [1],
    channelCount: 1,
    channelCountMode: "explicit",
  });
  observer.connect(observerContext.destination);
  const reference = observerContext.createMediaStreamSource(capture.stream);
  reference.connect(observer, 0, 0);
  let observed = null,
    phase = "setup",
    pending = null,
    counts;
  const samples = [],
    history = [],
    results = [],
    snapshots = new Map(),
    stableBegins = new Map();
  let snapshotId = 0;
  const snapshot = () =>
    timed(
      new Promise((resolve) => {
        const id = ++snapshotId;
        snapshots.set(id, resolve);
        observer.port.postMessage({ type: "snapshot", id });
      }),
      1000,
      "observer snapshot",
    );
  const mark = (status, raw, reason) =>
    history.push({
      frame: Math.round(observerContext.currentTime * 48000),
      status,
      original: raw,
      phase,
      reason,
    });
  const bind = (track) => {
    observed?.disconnect();
    observed = observerContext.createMediaStreamSource(new MediaStream([track]));
    observed.connect(observer, 0, 1);
  };
  observer.port.onmessage = ({ data }) => {
    if (data.type === "stable") {
      stableBegins.set(data.phase, { ...data, receivedAt: performance.now() });
      return;
    }
    if (data.type === "snapshot") {
      snapshots.get(data.id)?.(data);
      snapshots.delete(data.id);
      return;
    }
    if (data.type === "counts") {
      counts = data;
      return;
    }
    if (data.type !== "window") return;
    const [a, b] = data.buffers.map((x) => new Float32Array(x));
    samples.push({ ...data, a, b, buffers: undefined });
    const recycled = [new ArrayBuffer(16000 * 4), new ArrayBuffer(16000 * 4)];
    observer.port.postMessage({ type: "recycle", buffers: recycled }, recycled);
    if (pending && data.phase === pending.phase && --pending.left === 0) {
      const resolve = pending.resolve;
      pending = null;
      resolve();
    }
  };
  const collect = async (name, count, stride = 1) => {
    phase = name;
    observer.port.postMessage({ type: "phase", phase, stride });
    await timed(
      new Promise((resolve) => (pending = { phase: name, left: count, resolve })),
      (count * stride + 10) * 1000,
      "collection",
    );
    observer.port.postMessage({ type: "phase", phase: "idle" });
  };
  playback.start();
  await sourceContext.resume();
  await observerContext.resume();
  for (const delayMs of [-30, 0, 30, 60]) {
    const delay = observerContext.createDelay(1);
    delay.delayTime.value = Math.abs(delayMs) / 1000;
    if (delayMs < 0) {
      reference.disconnect(observer, 0, 0);
      reference.connect(delay);
      delay.connect(observer, 0, 0);
      reference.connect(observer, 0, 1);
    } else {
      reference.connect(delay);
      delay.connect(observer, 0, 1);
    }
    observed = delay;
    await collect("known-" + delayMs, 3);
    delay.disconnect();
    reference.disconnect(delay);
    if (delayMs < 0) {
      reference.disconnect(observer, 0, 1);
      reference.connect(observer, 0, 0);
    }
    observed = null;
  }
  bind(original);
  mark("active", true, "original baseline");
  await collect("original", 4);
  try {
    const runtime = await import(new URL("/src/effects/audio/runtime.ts", location.origin));
    const effects = await import(new URL("/dist/effects/audio/index.js", location.origin));
    const library = await import(new URL("/dist/core/index.js", location.origin));
    const nativeNode = AudioWorkletNode;
    for (const name of cases ?? [
      "pass",
      "current-c",
      "current-zig",
      "sab-c",
      "sab-zig",
      "raw-c",
      "raw-zig",
    ]) {
      phase = "rnnoise-" + name;
      let route,
        clone,
        session,
        unsub,
        contention,
        workerFault = null,
        readyAt = null,
        ticks = 0;
      const input = original.clone(),
        began = performance.now();
      const fault = (reason) => {
        if (workerFault) return;
        workerFault = String(reason);
        bind(original);
        mark("degraded", true, workerFault);
      };
      try {
        if (name === "pass") {
          const p = await runtime.createWorkletAudioNoiseProcessor(
            input,
            "strong",
            {
              id: "research-pass",
              label: "pass",
              workletUrl: new URL("/tests/browser/audio-diagnostic-worklet.ts", location.origin)
                .href,
              processorName: "audio-evidence-pass",
              contextSampleRate: 48000,
              channelCount: 1,
              prepare: () => Promise.resolve({ delaySamples: 0 }),
            },
            { onFault: (e) => fault(e.message) },
          );
          route = {
            track: p.track,
            metrics: () => p.getMetrics(),
            close: async () => {
              p.dispose();
              return {};
            },
          };
        } else if (name === "private-raw-c") {
          const raw = await import(new URL("/src/effects/audio/raw-audio-runtime.ts", location.origin));
          const p = await raw.createRawAudioNoiseProcessor(input, "strong", { onFault: (e) => fault(e.message) });
          route = { track: p.track, metrics: () => ({...p.getMetrics(), diagnostics: p.getDiagnostics()}), close: async () => { p.dispose(); await sleep(200); return { diagnostics: p.getDiagnostics() }; } };
        } else if (name.startsWith("current") || name === "private-session-c") {
          const selected =
            modules[
              name.endsWith("next-generic")
                ? "next-generic"
                : name.endsWith("next")
                  ? "next"
                  : name.endsWith("zig")
                    ? "zig"
                    : "c"
            ];
          if (name.includes("warm")) {
            const w = new Worker(new URL("./inference-worker.mjs", import.meta.url), {
              type: "module",
            });
            try {
              await timed(
                new Promise((resolve, reject) => {
                  w.onmessage = (e) =>
                    e.data.type === "warmed" ? resolve(e.data) : reject(Error(e.data.message));
                  w.onerror = (e) => reject(Error(e.message));
                  w.postMessage({ type: "warm", module: selected });
                }),
                1000,
                "experimental module prewarm",
              );
            } finally {
              w.terminate();
            }
          }
          globalThis.AudioWorkletNode = class extends nativeNode {
            constructor(ctx, id, options) {
              super(
                ctx,
                id,
                id === "rnnoise-noise-reduction"
                  ? { ...options, processorOptions: { module: selected } }
                  : options,
              );
            }
          };
          Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
            configurable: true,
            value: () => Promise.resolve(new MediaStream([input])),
          });
          session = library.createMediaSession({ capture: { audio: true } });
          await session.start();
          unsub = session.subscribe(() => {
            const state = session.getSnapshot().processors.audio;
            if (state.status === "degraded" || state.status === "failed")
              fault(session.getSnapshot().error?.message ?? state.status);
          });
          const result = await session.setAudioEffects({
            effects: [effects.noiseReduction({ level: "strong" })],
          });
          if (result.status !== "success") throw Error(result.error?.message ?? result.status);
          if (name === "private-session-c" && (typeof globalThis.MediaStreamTrackGenerator !== "function" || !(session.getOutput("audio").track instanceof globalThis.MediaStreamTrackGenerator))) {
            throw Error("Private raw route is ineligible or its build gate is disabled; do not qualify a Worklet as raw.");
          }
          route = {
            track: session.getOutput("audio").track,
            metrics: () => session.getSnapshot().processors.audio,
            close: async () => {
              unsub();
              await session.dispose();
              return {};
            },
          };
        } else if (name.startsWith("sab"))
          route = await sabRoute(
            input,
            modules[
              name.endsWith("next-generic")
                ? "next-generic"
                : name.endsWith("next")
                  ? "next"
                  : name.endsWith("zig")
                    ? "zig"
                    : "c"
            ],
            fault,
            { startDelaySamples, pump: name.includes("-port-") ? "port" : "wait" },
          );
        else
          route = await rawRoute(
            input,
            modules[
              name.endsWith("next-generic")
                ? "next-generic"
                : name.endsWith("next")
                  ? "next"
                  : name.endsWith("zig")
                    ? "zig"
                    : "c"
            ],
            fault,
            {
              bypass: name === "raw-pass" || name === "raw-delay",
              delaySamples: name === "raw-delay" ? 1440 : 0,
            },
          );
        readyAt = performance.now() - began;
        const activeBegin = await snapshot();
        clone = route.track.clone();
        const cloneInitiallyLive = clone.readyState === "live";
        if (!workerFault) {
          bind(route.track);
          mark("active", false, "processed ready");
        }
        if (mode === "endurance")
          contention = setInterval(() => {
            const until = performance.now() + 20;
            while (performance.now() < until) {}
            ticks++;
          }, 250);
        await collect(
          phase,
          windows,
          mode === "endurance" ? Math.max(1, Math.floor(duration / windows)) : 1,
        );
        if (mode === "endurance" && !workerFault) {
          const end = stableBegins.get(phase).receivedAt + duration * 1000;
          while (performance.now() < end && !workerFault) {
            await sleep(250);
          }
        }
        clearInterval(contention);
        const activeEnd = await snapshot();
        const continuity = Object.fromEntries(
          Object.keys(activeEnd)
            .filter((k) => typeof activeEnd[k] === "number" && k !== "id")
            .map((k) => [k, activeEnd[k] - activeBegin[k]]),
        );
        const stable = stableBegins.get(phase);
        const stableContinuity = stable
          ? Object.fromEntries(
              Object.keys(activeEnd)
                .filter((k) => typeof activeEnd[k] === "number" && k !== "id")
                .map((k) => [k, activeEnd[k] - stable[k]]),
            )
          : null;
        const metrics = route.metrics();
        const closed = await route.close();
        route = null;
        await sleep(150);
        results.push({
          name,
          readyMs: readyAt,
          durationMs: performance.now() - began,
          fault: workerFault,
          continuity,
          stableContinuity,
          stableSeconds: stableContinuity?.samples / 48000,
          observerGapEvents: activeEnd.gapEvents,
          activeSeconds: continuity.samples / 48000,
          metrics,
          closed,
          cloneInitiallyLive,
          cloneLiveAfterClose: clone.readyState === "live",
          inputLiveBeforeOwnStop: input.readyState === "live",
          contentionTicks: ticks,
          outputOriginalAfterFault: !!workerFault,
        });
      } catch (error) {
        results.push({ name, error: String(error), fault: workerFault, readyMs: readyAt });
      } finally {
        clearInterval(contention);
        unsub?.();
        await route?.close().catch(() => {});
        await session?.dispose();
        globalThis.AudioWorkletNode = nativeNode;
        clone?.stop();
        input.stop();
        bind(original);
        mark("off", true, "case cleanup");
      }
    }
  } finally {
    contextMetadata.end = {
      source: contextInfo(sourceContext),
      observer: contextInfo(observerContext),
    };
    observer.port.postMessage({ type: "stop" });
    await sleep(100);
    observed?.disconnect();
    reference.disconnect();
    observer.disconnect();
    observer.port.close();
    playback.stop();
    capture.stream.getTracks().forEach((t) => t.stop());
    await sourceContext.close();
    await observerContext.close();
  }
  const encode = (v) => {
    const bytes = new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
    let s = "";
    for (let i = 0; i < bytes.length; i += 8192)
      s += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return btoa(s);
  };
  return {
    protocol: PROTOCOL,
    userAgent: navigator.userAgent,
    isolated: crossOriginIsolated,
    contextMetadata,
    latencySampling: {
      requestedWindows: windows,
      strideSeconds: mode === "endurance" ? Math.max(1, Math.floor(duration / windows)) : 1,
      warmupFrames: 48000,
      policy:
        "Fixed periodic one-second windows spanning the endurance run; all native/callback/continuity counters remain continuous; retain every exclusion",
    },
    definition:
      "original captured-track reference in independent observer context; source, processor and observer contexts form a DAG; graph-inclusive standard output difference, no graph subtraction",
    minimumLagMs: -300,
    knownDelayMs: [-30, 0, 30, 60],
    captureRate: 16000,
    sampleRate: 48000,
    history,
    results,
    counts,
    windows: samples.map((v) => ({
      ...v,
      a: encode(v.a),
      b: encode(v.b),
      encoding: "base64-f32le",
    })),
  };
}

export async function worklet({ artifacts }) {
  const context = new AudioContext({ sampleRate: 48000 });
  await context.audioWorklet.addModule(
    new URL("/tests/browser/audio-diagnostic-worklet.ts", location.origin),
  );
  await context.resume();
  const rows = [];
  try {
    for (const [name, url] of Object.entries(artifacts)) {
      const module = await WebAssembly.compile(await (await fetch(url)).arrayBuffer());
      for (const mode of ["native", "kernel", "inplace"]) {
        let node;
        try {
          const row = await timed(
            new Promise((resolve, reject) => {
              node = new AudioWorkletNode(context, "audio-evidence-profile", {
                processorOptions: { module, mode },
              });
              node.onprocessorerror = () => reject(Error("profile processorerror"));
              node.port.onmessage = ({ data }) => {
                if (data.profileProtocol !== "ac3-zig-v2")
                  reject(Error("stale Worklet diagnostic"));
                else resolve(data);
              };
              node.connect(context.destination);
            }),
            20000,
            "Worklet profile",
          );
          rows.push({
            name,
            ...row,
            engineMs: Array.from(row.engineMs),
            callbackMs: Array.from(row.callbackMs),
          });
        } finally {
          node?.disconnect();
          node?.port.close();
        }
      }
    }
  } finally {
    await context.close();
  }
  return {
    protocol: PROTOCOL,
    userAgent: navigator.userAgent,
    isolated: crossOriginIsolated,
    rows,
  };
}
