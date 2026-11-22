// Paired original-track/standard-output observer, producer-stamped one-second windows.
class Observer extends AudioWorkletProcessor {
  constructor() {
    super();
    this.pool = Array.from({ length: 3 }, () => [new Float32Array(16000), new Float32Array(16000)]);
    this.buffers = this.pool.pop();
    this.index = 0;
    this.windowGaps = 0;
    this.stride = 1;
    this.windowCounter = 0;
    this.phase = "idle";
    this.warm = 0;
    this.start = 0;
    this.sequence = 0;
    this.dropped = 0;
    this.gapEvents = [];
    this.counts = {
      samples: 0,
      missingReference: 0,
      missingOutput: 0,
      nonfinite: 0,
      zeroQuanta: 0,
      frameGaps: 0,
    };
    this.port.onmessage = ({ data }) => {
      if (data.type === "phase") {
        this.phase = data.phase;
        this.stride = data.stride ?? 1;
        this.windowCounter = 0;
        this.warm = 48000;
        this.index = 0;
        this.windowGaps = 0;
      } else if (data.type === "recycle")
        this.pool.push(data.buffers.map((b) => new Float32Array(b)));
      else if (data.type === "snapshot") {
        this.port.postMessage({
          type: "snapshot",
          id: data.id,
          ...this.counts,
          frame: currentFrame,
          dropped: this.dropped,
          gapEvents: this.gapEvents,
        });
      } else if (data.type === "stop") {
        this.port.postMessage({
          type: "counts",
          ...this.counts,
          dropped: this.dropped,
          gapEvents: this.gapEvents,
        });
        this.stopped = true;
      }
    };
  }
  process(inputs, outputs) {
    if (this.stopped) return false;
    const out = outputs[0][0];
    out.fill(0);
    const a = inputs[0]?.[0],
      b = inputs[1]?.[0];
    if (this.lastFrame !== undefined && this.lastFrame !== currentFrame) {
      this.counts.frameGaps++;
      if (this.phase !== "idle" && this.warm <= 0 && this.index > 0) this.windowGaps++;
      if (this.gapEvents.length < 16)
        this.gapEvents.push({
          expected: this.lastFrame,
          actual: currentFrame,
          phase: this.phase,
          warm: this.warm,
        });
    }
    this.lastFrame = currentFrame + out.length;
    this.counts.samples += out.length;
    if (!a) this.counts.missingReference++;
    if (!b) this.counts.missingOutput++;
    let energy = 0;
    for (let i = 0; i < out.length; i++) {
      const v = b?.[i] ?? 0;
      if (!Number.isFinite(v)) this.counts.nonfinite++;
      energy += v * v;
    }
    if (energy === 0) this.counts.zeroQuanta++;
    if (this.phase === "idle") return true;
    if (this.warm > 0) {
      this.warm -= out.length;
      if (this.warm <= 0)
        this.port.postMessage({
          type: "stable",
          phase: this.phase,
          ...this.counts,
          frame: currentFrame + out.length,
          dropped: this.dropped,
        });
      return true;
    }
    for (let i = 0; i < out.length; i++) {
      if ((currentFrame + i) % 3) continue;
      if (this.index === 0) this.start = currentFrame + i;
      this.buffers[0][this.index] = a?.[i] ?? 0;
      this.buffers[1][this.index] = b?.[i] ?? 0;
      this.index++;
      if (this.index === 16000) {
        this.windowCounter++;
        if (this.windowCounter % this.stride !== 0) {
          this.index = 0;
          this.windowGaps = 0;
          continue;
        }
        const next = this.pool.pop();
        if (next) {
          const buffers = this.buffers.map((v) => v.buffer);
          this.port.postMessage(
            {
              type: "window",
              phase: this.phase,
              sequence: this.sequence++,
              startFrame: this.start,
              endFrame: currentFrame + i + 3,
              droppedWindows: this.dropped,
              frameDiscontinuities: this.windowGaps,
              sampleStride: this.stride,
              buffers,
            },
            buffers,
          );
          this.buffers = next;
        } else this.dropped++;
        this.index = 0;
        this.windowGaps = 0;
      }
    }
    return true;
  }
}
registerProcessor("research-output-observer", Observer);
