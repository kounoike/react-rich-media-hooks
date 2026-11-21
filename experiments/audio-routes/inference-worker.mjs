// Disposable diagnostics/prototypes. Never imported by package entrypoints.
const PROTOCOL = "audio-routes-v6";
const send = (data) => self.postMessage({ protocol: PROTOCOL, ...data });
const info = () => ({
  processor: typeof globalThis.MediaStreamTrackProcessor,
  generator: typeof globalThis.MediaStreamTrackGenerator,
  videoGenerator: typeof globalThis.VideoTrackGenerator,
  audioData: typeof globalThis.AudioData,
  sab: typeof SharedArrayBuffer,
  isolated: globalThis.crossOriginIsolated,
});
const distribution = (a) => {
  const v = Array.from(a).sort((x, y) => x - y);
  return {
    count: v.length,
    p50: v[Math.ceil(v.length * 0.5) - 1],
    p95: v[Math.ceil(v.length * 0.95) - 1],
    p99: v[Math.ceil(v.length * 0.99) - 1],
    max: v.at(-1),
  };
};
self.onmessage = async ({ data }) => {
  try {
    if (data.type === "stopRing") {
      self.ringStop?.();
      return;
    }
    if (data.type === "stopRaw") {
      self.rawStop?.();
      return;
    }
    if (data.type === "ring") {
      if (data.pump === "port") runRingPort(data);
      else runRing(data);
      return;
    }
    if (data.type === "raw") {
      await runRaw(data);
      return;
    }
    if (data.type === "probe") {
      send({ type: "probe", ...info() });
      return;
    }
    if (data.type === "warm") {
      const { e, warmupMs, warmupFrames } = native(data.module, 80);
      e.engine_dispose();
      send({ type: "warmed", warmupMs, warmupFrames });
      return;
    }
    if (data.type === "profile") {
      const frames = data.frames ?? 320,
        warm = 80,
        total = frames + warm,
        n = data.stages.length;
      const inclusive = new Float64Array(n * frames),
        exclusive = new Float64Array(n * frames),
        counts = new Uint32Array(n);
      const starts = new Float64Array(64),
        children = new Float64Array(64),
        ids = new Int32Array(64);
      let depth = 0,
        index = -1;
      const mark = (id, enter) => {
        const now = performance.now();
        if (enter) {
          ids[depth] = id;
          starts[depth] = now;
          children[depth] = 0;
          depth++;
        } else {
          depth--;
          if (ids[depth] !== id) throw Error("Unbalanced stage stack");
          const dt = now - starts[depth];
          if (depth) children[depth - 1] += dt;
          if (index >= 0) {
            inclusive[index * n + id] += dt;
            exclusive[index * n + id] += dt - children[depth];
            counts[id]++;
          }
        }
      };
      const e = new WebAssembly.Instance(data.module, { probe: { mark } }).exports;
      e._initialize();
      if (e.engine_init() !== 0) throw Error("Native init");
      const pcm = new Float32Array(e.memory.buffer, e.engine_frame_ptr(), 480),
        times = new Float64Array(frames),
        source = Float32Array.from(
          { length: 480 },
          (_, i) => 2100 * Math.sin(i * 0.13) + 200 * Math.cos(i * 1.37),
        );
      let checksum = 0;
      for (let f = 0; f < total; f++) {
        index = f - warm;
        pcm.set(source);
        const begin = performance.now();
        e.engine_process();
        if (index >= 0) times[index] = performance.now() - begin;
        checksum += pcm[f % 480];
      }
      e.engine_dispose();
      send({
        type: "profile",
        clock: "Worker performance.now",
        input: "same deterministic 480-sample voiced/noise frame",
        engineMs: distribution(times),
        checksum,
        stages: data.stages.map((s, id) => ({
          ...s,
          calls: counts[id],
          inclusiveMs: distribution(
            Array.from({ length: frames }, (_, f) => inclusive[f * n + id]),
          ),
          exclusiveMs: distribution(
            Array.from({ length: frames }, (_, f) => exclusive[f * n + id]),
          ),
          totalInclusiveMs: Array.from({ length: frames }, (_, f) => inclusive[f * n + id]).reduce(
            (a, b) => a + b,
            0,
          ),
          totalExclusiveMs: Array.from({ length: frames }, (_, f) => exclusive[f * n + id]).reduce(
            (a, b) => a + b,
            0,
          ),
        })),
      });
      return;
    }
    throw Error("Unknown worker message");
  } catch (error) {
    send({ type: "error", message: String(error), stack: error.stack });
  }
};

function native(module, warm = 0) {
  const started = performance.now();
  const e = new WebAssembly.Instance(module).exports;
  e._initialize();
  if (e.engine_init() !== 0) throw Error("engine init failed");
  const frame = new Float32Array(e.memory.buffer, e.engine_frame_ptr(), 480);
  for (let j = 0; j < warm; j++) {
    for (let i = 0; i < 480; i++) frame[i] = 2100 * Math.sin(i * 0.13) + 200 * Math.cos(i * 1.37);
    e.engine_process();
  }
  if (warm) {
    e.engine_dispose();
    if (e.engine_init() !== 0) throw Error("warm reset");
  }
  return { e, frame, warmupMs: performance.now() - started, warmupFrames: warm };
}
function runRing(data) {
  const c = new Int32Array(data.control),
    input = new Float32Array(data.input),
    output = new Float32Array(data.output),
    cap = input.length;
  const { e, frame, warmupMs, warmupFrames } = native(data.module, data.warmup ?? 80),
    times = new Float64Array(72000);
  let count = 0;
  send({ type: "ready", warmupMs, warmupFrames });
  try {
    while (!Atomics.load(c, 0)) {
      const iw = Atomics.load(c, 1),
        ir = Atomics.load(c, 2),
        ow = Atomics.load(c, 3),
        or = Atomics.load(c, 4);
      if (iw - ir < 480) {
        Atomics.wait(c, 1, iw, 100);
        continue;
      }
      if (cap - (ow - or) < 480) {
        Atomics.wait(c, 4, or, 100);
        continue;
      }
      for (let i = 0; i < 480; i++) frame[i] = input[(ir + i) % cap];
      Atomics.store(c, 2, ir + 480);
      const begin = performance.now();
      const probability = e.engine_process();
      times[count++] = performance.now() - begin;
      if (!Number.isFinite(probability) || count >= times.length)
        throw Error("invalid native result or trial capacity");
      for (let i = 0; i < 480; i++) {
        const value = frame[i] / 32768;
        if (!Number.isFinite(value)) throw Error("nonfinite native output");
        output[(ow + i) % cap] = Math.max(-1, Math.min(1, value));
      }
      Atomics.store(c, 3, ow + 480);
      Atomics.add(c, 9, 1);
      Atomics.store(c, 12, Math.max(Atomics.load(c, 12), ow + 480 - or));
    }
  } catch (error) {
    Atomics.store(c, 10, 1);
    send({ type: "fault", reason: String(error) });
  } finally {
    e.engine_dispose();
    Atomics.store(c, 6, 1);
    send({
      type: "stopped",
      frames: count,
      warmupMs,
      warmupFrames,
      engineBudgetExceedances: Array.from(times.subarray(0, count)).filter((t) => t > 128 / 48)
        .length,
      engineMs: distribution(times.subarray(0, count)),
    });
  }
}
async function runRaw(data) {
  const { e, frame, warmupMs, warmupFrames } = native(data.module, data.warmup ?? 80),
    reader = data.readable.getReader(),
    writer = data.writable.getWriter();
  const times = new Float64Array(72000);
  let used = 0,
    count = 0,
    sourceSamples = 0,
    outputSamples = 0,
    gaps = 0,
    lastEnd = null,
    frameTimestamp = 0,
    maxChunk = 0;
  let stopping = false;
  self.rawStop = () => {
    stopping = true;
    reader.cancel().catch(() => {});
  };
  const samples = new Float32Array(480);
  const pending = [];
  let maxPending = 0;
  let timestampDeltaSum = 0;
  const deltas = new Float64Array(72000);
  let deltaCount = 0;
  const delay = new Float32Array(data.delaySamples ?? 0);
  let delayOffset = 0;
  let scratch = new Float32Array(4096);
  const channels = new Float32Array(4096);
  let firstTimestamp = null;
  send({ type: "ready" });
  try {
    while (true) {
      const { done, value: audio } = await reader.read();
      if (done) break;
      if (audio.sampleRate !== 48000 || audio.numberOfFrames > scratch.length)
        throw Error("unsupported raw format/rate/chunk");
      maxChunk = Math.max(maxChunk, audio.numberOfFrames);
      if (lastEnd !== null) {
        const dt = audio.timestamp - lastEnd;
        deltas[deltaCount++] = dt;
        timestampDeltaSum += dt;
        if (Math.abs(dt) > 50) gaps++;
      }
      lastEnd = audio.timestamp + (audio.numberOfFrames / 48000) * 1e6;
      scratch.fill(0, 0, audio.numberOfFrames);
      for (let ch = 0; ch < audio.numberOfChannels; ch++) {
        audio.copyTo(channels, { planeIndex: ch, format: "f32-planar" });
        for (let i = 0; i < audio.numberOfFrames; i++)
          scratch[i] += channels[i] / audio.numberOfChannels;
      }
      if (firstTimestamp === null) firstTimestamp = audio.timestamp;
      for (let i = 0; i < audio.numberOfFrames; i++) {
        if (used === 0) frameTimestamp = audio.timestamp + (i / 48000) * 1e6;
        frame[used++] = scratch[i] * 32768;
        if (used === 480) {
          const begin = performance.now();
          const probability = data.bypass ? 0 : e.engine_process();
          times[count++] = performance.now() - begin;
          if (!Number.isFinite(probability) || count >= times.length)
            throw Error("invalid raw native result/trial capacity");
          for (let j = 0; j < 480; j++) {
            const v = frame[j] / 32768;
            if (!Number.isFinite(v)) throw Error("nonfinite raw output");
            if (delay.length) {
              samples[j] = delay[delayOffset];
              delay[delayOffset] = v;
              delayOffset = (delayOffset + 1) % delay.length;
            } else samples[j] = Math.max(-1, Math.min(1, v));
          }
          const out = new AudioData({
            format: "f32-planar",
            sampleRate: 48000,
            numberOfChannels: 1,
            numberOfFrames: 480,
            timestamp: Math.round(frameTimestamp),
            data: samples,
          });
          const task = writer.write(out).finally(() => out.close());
          task.catch(() => {});
          pending.push(task);
          maxPending = Math.max(maxPending, pending.length);
          if (pending.length >= 2) await pending.shift();
          outputSamples += 480;
          used = 0;
        }
      }
      sourceSamples += audio.numberOfFrames;
      audio.close();
    }
    await Promise.all(pending);
    if (data.keepOpen) writer.releaseLock();
    else await writer.close();
  } catch (error) {
    if (!stopping) send({ type: "fault", reason: String(error) });
    await reader.cancel().catch(() => {});
    await writer.abort().catch(() => {});
  } finally {
    e.engine_dispose();
    send({
      type: "stopped",
      frames: count,
      warmupMs,
      warmupFrames,
      sourceSamples,
      outputSamples,
      gaps,
      maxChunk,
      maxPending,
      timestampDeltaSum,
      timestampDeltas: distribution(deltas.subarray(0, deltaCount)),
      firstTimestamp,
      lastEnd,
      engineBudgetExceedances: Array.from(times.subarray(0, count)).filter((t) => t > 128 / 48)
        .length,
      engineMs: distribution(times.subarray(0, count)),
    });
  }
}

// Separate event-loop scheduling control: one coalesced direct Worklet→Worker notification.
function runRingPort(data) {
  const c = new Int32Array(data.control),
    input = new Float32Array(data.input),
    output = new Float32Array(data.output),
    cap = input.length;
  const { e, frame, warmupMs, warmupFrames } = native(data.module, 80),
    times = new Float64Array(72000);
  let count = 0,
    stopped = false,
    events = 0,
    maxBatch = 0;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    data.port.close();
    e.engine_dispose();
    Atomics.store(c, 6, 1);
    send({
      type: "stopped",
      pump: "direct-port",
      frames: count,
      events,
      maxBatch,
      warmupMs,
      warmupFrames,
      engineBudgetExceedances: Array.from(times.subarray(0, count)).filter((t) => t > 128 / 48)
        .length,
      engineMs: distribution(times.subarray(0, count)),
    });
  };
  self.ringStop = stop;
  data.port.onmessage = () => {
    if (stopped) return;
    events++;
    let batch = 0;
    try {
      while (!Atomics.load(c, 0) && batch < 4) {
        const iw = Atomics.load(c, 1),
          ir = Atomics.load(c, 2),
          ow = Atomics.load(c, 3),
          or = Atomics.load(c, 4);
        if (iw - ir < 480 || cap - (ow - or) < 480) break;
        for (let i = 0; i < 480; i++) frame[i] = input[(ir + i) % cap];
        Atomics.store(c, 2, ir + 480);
        const begin = performance.now(),
          probability = e.engine_process();
        times[count++] = performance.now() - begin;
        if (!Number.isFinite(probability) || count >= times.length)
          throw Error("invalid native result/capacity");
        for (let i = 0; i < 480; i++) {
          const value = frame[i] / 32768;
          if (!Number.isFinite(value)) throw Error("nonfinite output");
          output[(ow + i) % cap] = Math.max(-1, Math.min(1, value));
        }
        Atomics.store(c, 3, ow + 480);
        Atomics.add(c, 9, 1);
        Atomics.store(c, 12, Math.max(Atomics.load(c, 12), ow + 480 - or));
        batch++;
      }
    } catch (error) {
      send({ type: "fault", reason: String(error) });
      Atomics.store(c, 10, 1);
      stop();
    }
    maxBatch = Math.max(maxBatch, batch);
    Atomics.store(c, 5, 0);
    if (Atomics.load(c, 0)) stop();
  };
  data.port.start();
  send({ type: "ready", pump: "direct-port", warmupMs, warmupFrames });
}
