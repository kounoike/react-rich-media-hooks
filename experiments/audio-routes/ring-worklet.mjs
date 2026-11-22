// Disposable bounded producer/consumer. No RNNoise computation runs on this thread.
class RingProcessor extends AudioWorkletProcessor {
  constructor({ processorOptions: p }) {
    super();
    this.c = new Int32Array(p.control);
    this.input = new Float32Array(p.input);
    this.output = new Float32Array(p.output);
    this.capacity = this.input.length;
    this.started = false;
    this.startAt = -1;
    this.delay = p.startDelaySamples ?? 128;
    this.startup = p.startupStrategy ?? "clock";
    this.cadenceReady = this.startup !== "cadence";
    this.cadenceFrames = 0;
    this.cadenceWindows = 0;
    this.fault = false;
    this.stopped = false;
    this.first = true;
    this.slow = 0;
    this.lastEnd = null;
    this.port.onmessage = (e) => {
      if (e.data.type === "stop") {
        this.stopped = true;
        this.producer?.close();
      } else if (e.data.type === "connect") {
        this.producer = e.data.port;
        this.producer.start();
      }
    };
  }
  fail(reason) {
    if (!this.fault) {
      this.fault = true;
      Atomics.store(this.c, 26, Date.now() - this.wallStart);
      Atomics.store(this.c, 27, currentFrame - Atomics.load(this.c, 17));
      Atomics.store(this.c, 28, Atomics.load(this.c, 1) - Atomics.load(this.c, 2));
      Atomics.store(this.c, 29, Atomics.load(this.c, 3) - Atomics.load(this.c, 4));
      Atomics.store(this.c, 10, 1);
      this.port.postMessage({ type: "fault", reason });
    }
  }
  process(inputs, outputs) {
    if (this.stopped) return false;
    const begin = globalThis.performance?.now() ?? Date.now(),
      out = outputs[0][0],
      src = inputs[0]?.[0];
    if (this.fault || Atomics.load(this.c, 0)) {
      out.fill(0);
      return true;
    }
    if (!src) {
      Atomics.add(this.c, this.started ? 24 : 25, 1);
      if (this.started) this.fail("missing input after readiness");
    }
    if (this.lastEnd !== null && this.lastEnd !== currentFrame) {
      Atomics.add(this.c, this.started ? 21 : 23, 1);
      if (this.started) this.fail(`render frame discontinuity ${this.lastEnd}->${currentFrame}`);
    }
    this.lastEnd = currentFrame + out.length;
    if (this.first) {
      this.wallStart = Date.now();
      this.first = false;
      Atomics.store(this.c, 17, currentFrame);
    }
    if (!this.cadenceReady) {
      const wall = Date.now();
      this.cadenceFrames += out.length;
      if (this.cadenceAt === undefined) {
        this.cadenceAt = wall;
        this.cadenceAnchor = this.cadenceFrames;
      }
      const elapsed = wall - this.cadenceAt;
      if (elapsed >= 20) {
        const rendered = ((this.cadenceFrames - this.cadenceAnchor) / sampleRate) * 1000;
        this.cadenceWindows =
          Math.abs(rendered - elapsed) <= ((2 * out.length) / sampleRate) * 1000
            ? this.cadenceWindows + 1
            : 0;
        this.cadenceAt = wall;
        this.cadenceAnchor = this.cadenceFrames;
        if (this.cadenceWindows >= 2) {
          this.cadenceReady = true;
          Atomics.store(this.c, 31, wall - this.wallStart);
        }
      }
      if (!this.cadenceReady) {
        out.fill(0);
        Atomics.add(this.c, 14, 1);
        return true;
      }
    }
    let iw = Atomics.load(this.c, 1),
      ir = Atomics.load(this.c, 2),
      ow = Atomics.load(this.c, 3),
      or = Atomics.load(this.c, 4);
    if (iw - ir + out.length > this.capacity) {
      Atomics.add(this.c, 7, 1);
      this.fail("input ring overflow");
      out.fill(0);
      return true;
    }
    for (let i = 0; i < out.length; i++)
      this.input[(iw + i) % this.capacity] = (src?.[i] ?? 0) * 32768;
    iw += out.length;
    Atomics.store(this.c, 1, iw);
    Atomics.notify(this.c, 1, 1);
    if (
      this.producer &&
      iw - Atomics.load(this.c, 2) >= 480 &&
      Atomics.compareExchange(this.c, 5, 0, 1) === 0
    )
      this.producer.postMessage({ type: "input" });
    Atomics.store(this.c, 13, Math.max(Atomics.load(this.c, 13), iw - ir));
    if (!this.started) {
      if (this.startup !== "clock") {
        ow = Atomics.load(this.c, 3);
        if (ow - or >= 960 && iw - Atomics.load(this.c, 2) < 480) {
          const reserve = 480 + out.length;
          const discarded = ow - or - reserve;
          or = ow - reserve;
          Atomics.store(this.c, 4, or);
          Atomics.store(this.c, 30, discarded);
          this.startAt = currentFrame;
        }
      } else if (this.startAt < 0 && ow - or >= 480) this.startAt = currentFrame + this.delay;
      if (this.startAt >= 0 && currentFrame >= this.startAt) {
        this.started = true;
        Atomics.store(this.c, 18, currentFrame);
        this.port.postMessage({ type: "ready" });
      }
    }
    if (this.started) {
      ow = Atomics.load(this.c, 3);
      if (ow - or < out.length) {
        Atomics.add(this.c, 8, 1);
        this.fail("output ring underrun");
        out.fill(0);
        return true;
      }
      for (let i = 0; i < out.length; i++) out[i] = this.output[(or + i) % this.capacity];
      or += out.length;
      Atomics.store(this.c, 4, or);
      Atomics.notify(this.c, 4, 1);
      Atomics.add(this.c, 20, out.length);
    } else out.fill(0);
    Atomics.add(this.c, 19, out.length);
    Atomics.add(this.c, 14, 1);
    const dt = (globalThis.performance?.now() ?? Date.now()) - begin;
    if (dt > (out.length / sampleRate) * 1000) {
      Atomics.add(this.c, 15, 1);
      this.slow++;
    } else this.slow = 0;
    if (this.slow >= 2) this.fail("callback render budget exceeded twice");
    Atomics.store(this.c, 16, Math.max(Atomics.load(this.c, 16), Math.round(dt * 1000)));
    return true;
  }
}
registerProcessor("research-denoise-ring", RingProcessor);
