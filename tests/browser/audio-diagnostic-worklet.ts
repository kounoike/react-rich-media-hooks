/* eslint-disable unicorn/require-post-message-target-origin -- Diagnostic MessagePort, no Window targetOrigin. */
import { RnnoiseKernel } from "../../src/effects/audio/backends/rnnoise-kernel.js";

declare class AudioWorkletProcessor {
  readonly port: MessagePort;
}
declare const currentFrame: number;
declare const sampleRate: number;
declare function registerProcessor(
  name: string,
  value: new (options: AudioWorkletNodeOptions) => AudioWorkletProcessor,
): void;

class EvidenceCollector extends AudioWorkletProcessor {
  private pool = Array.from({ length: 3 }, () => [
    new Float32Array(16_000),
    new Float32Array(16_000),
  ]);
  private current = this.pool.pop()!;
  private index = 0;
  private start = 0;
  private phase = "idle";
  private warm = 0;
  private sequence = 0;
  private dropped = 0;
  constructor() {
    super();
    this.port.addEventListener(
      "message",
      (event: MessageEvent<{ type: string; phase: string; buffers: ArrayBuffer[] }>) => {
        if (event.data.type === "phase") {
          this.phase = event.data.phase;
          this.index = 0;
          this.warm = 48_000;
        } else if (event.data.type === "recycle") {
          this.pool.push(event.data.buffers.map((buffer) => new Float32Array(buffer)));
        }
      },
    );
    this.port.start();
  }
  process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    const output = outputs[0]?.[0];
    if (!output) return true;
    output.fill(0);
    if (this.phase === "idle") return true;
    if (this.warm > 0) {
      this.warm -= output.length;
      return true;
    }
    for (let i = 0; i < output.length; i++) {
      if ((currentFrame + i) % 3 !== 0) continue;
      if (this.index === 0) this.start = currentFrame + i;
      this.current[0]![this.index] = inputs[0]?.[0]?.[i] ?? 0;
      this.current[1]![this.index] = inputs[1]?.[0]?.[i] ?? 0;
      this.index++;
      if (this.index === 16_000) {
        const next = this.pool.pop();
        if (next) {
          const buffers = this.current.map((channel) => channel.buffer);
          this.port.postMessage(
            {
              phase: this.phase,
              sequence: this.sequence++,
              startFrame: this.start,
              endFrame: currentFrame + i + 3,
              droppedWindows: this.dropped,
              buffers,
            },
            buffers,
          );
          this.current = next;
        } else {
          this.dropped++;
        }
        this.index = 0;
      }
    }
    return true;
  }
}

class EvidencePass extends AudioWorkletProcessor {
  private delay: Float32Array;
  private offset = 0;
  constructor(options: AudioWorkletNodeOptions) {
    super();
    this.delay = new Float32Array(Number(options.processorOptions?.delaySamples ?? 0));
    this.port.start();
  }
  process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    const output = outputs[0]?.[0];
    if (!output) return true;
    for (let i = 0; i < output.length; i++) {
      const value = inputs[0]?.[0]?.[i] ?? 0;
      if (this.delay.length === 0) output[i] = value;
      else {
        output[i] = this.delay[this.offset]!;
        this.delay[this.offset] = value;
        this.offset = (this.offset + 1) % this.delay.length;
      }
    }
    if (currentFrame === 0 || !this.announced) {
      this.announced = true;
      this.port.postMessage({ type: "ready" });
    }
    return true;
  }
  private announced = false;
}

const profileNow = (): number => globalThis.performance?.now() ?? Date.now();

interface ProfileNative extends WebAssembly.Exports {
  memory: WebAssembly.Memory;
  _initialize: () => void;
  engine_init: () => number;
  engine_frame_ptr: () => number;
  engine_process: () => number;
  engine_dispose: () => void;
}
const isProfileNative = (value: WebAssembly.Exports): value is ProfileNative =>
  value.memory instanceof WebAssembly.Memory &&
  ["_initialize", "engine_init", "engine_frame_ptr", "engine_process", "engine_dispose"].every(
    (name) => typeof value[name] === "function",
  );

const boundaryMicrobench = (): Record<string, unknown> => {
  const input = Float32Array.from({ length: 480 }, (_, i) => Math.sin(i));
  const storage = new Float32Array(
    new WebAssembly.Memory({ initial: 1, maximum: 1 }).buffer,
    0,
    480,
  );
  const channels = [input];
  const referenceSample = (index: number): number => {
    let sum = 0;
    let count = 0;
    for (const channel of channels) {
      const value = channel[index];
      if (value !== undefined) {
        sum += value;
        count++;
      }
    }
    return count === 0 ? 0 : sum / count;
  };
  let checksum = 0;
  const copiesMs: number[] = [];
  const inplaceMs: number[] = [];
  const referenceMonoMs: number[] = [];
  const fastMonoMs: number[] = [];
  for (let batch = 0; batch < 7; batch++) {
    let started = profileNow();
    for (let i = 0; i < 100_000; i++) {
      storage.set(input);
      input.set(storage);
      checksum += input[i % 480]!;
    }
    copiesMs.push(profileNow() - started);
    started = profileNow();
    for (let i = 0; i < 100_000; i++) {
      checksum += storage[i % 480]!;
    }
    inplaceMs.push(profileNow() - started);
    started = profileNow();
    for (let i = 0; i < 4000; i++) {
      for (let j = 0; j < 480; j++) checksum += referenceSample(j);
    }
    referenceMonoMs.push(profileNow() - started);
    started = profileNow();
    for (let i = 0; i < 4000; i++) {
      for (let j = 0; j < 480; j++) checksum += (input[j] ?? 0) + 0;
    }
    fastMonoMs.push(profileNow() - started);
  }
  return {
    copiesMs,
    inplaceMs,
    copyCallsPerBatch: 100_000,
    referenceMonoMs,
    fastMonoMs,
    monoFramesPerBatch: 4000,
    checksum,
    caveat: "isolated boundary microbench, not native compute or end-to-end latency",
  };
};

class EvidenceProfile extends AudioWorkletProcessor {
  private native: ProfileNative;
  private nativeFrame: Float32Array;
  private kernel: RnnoiseKernel;
  private frame = Float32Array.from(
    { length: 480 },
    (_, i) => 2100 * Math.sin(i * 0.13) + 200 * Math.cos(i * 1.37),
  );
  private scratch = new Float32Array(480);
  private nativeTimes = new Float64Array(240);
  private callbackTimes = new Float64Array(1600);
  private callbacks = 0;
  private frames = 0;
  private accumulated = 0;
  private mode: string;
  private done = false;
  constructor(options: AudioWorkletNodeOptions) {
    super();
    const data: unknown = options.processorOptions;
    if (
      typeof data !== "object" ||
      data === null ||
      !("module" in data) ||
      !(data.module instanceof WebAssembly.Module) ||
      !("mode" in data) ||
      (data.mode !== "native" && data.mode !== "kernel" && data.mode !== "inplace")
    )
      throw new Error("Invalid diagnostic options");
    const native = new WebAssembly.Instance(data.module).exports;
    if (!isProfileNative(native)) throw new Error("Invalid diagnostic ABI");
    // eslint-disable-next-line no-underscore-dangle -- Pinned reactor entry point
    native._initialize();
    native.engine_init();
    this.native = native;
    this.nativeFrame = new Float32Array(native.memory.buffer, native.engine_frame_ptr(), 480);
    this.kernel = new RnnoiseKernel(data.module);
    this.mode = data.mode;
  }
  process(_inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    const now = profileNow;
    const started = now();
    const measuring = this.frames >= 80;
    const output = outputs[0]?.[0];
    if (!output || this.done) return false;
    output.fill(0);
    this.accumulated += output.length;
    if (this.accumulated >= 480) {
      this.accumulated -= 480;
      this.nativeFrame.set(this.frame);
      this.scratch.set(this.frame);
      if (this.mode === "inplace") this.kernel.frameBuffer.set(this.frame);
      const begin = now();
      if (this.mode === "native") this.native.engine_process();
      else
        this.kernel.processFrame(this.mode === "inplace" ? this.kernel.frameBuffer : this.scratch);
      const elapsed = now() - begin;
      if (this.frames >= 80) this.nativeTimes[this.frames - 80] = elapsed;
      this.frames++;
    }
    if (measuring && this.callbacks < this.callbackTimes.length)
      this.callbackTimes[this.callbacks++] = now() - started;
    if (this.frames === 320) {
      const validation = new Float32Array(480).fill(0.1);
      const repetitions = 20_000;
      const everyStart = now();
      for (let i = 0; i < repetitions; i++) {
        if (!validation.every(Number.isFinite)) throw new Error("invalid");
      }
      const everyMs = now() - everyStart;
      const loopStart = now();
      for (let i = 0; i < repetitions; i++) {
        for (let j = 0; j < validation.length; j++)
          if (!Number.isFinite(validation[j])) throw new Error("invalid");
      }
      const loopMs = now() - loopStart;
      this.port.postMessage({
        profileProtocol: "ac3-zig-v2",
        mode: this.mode,
        clock: typeof globalThis.performance?.now === "function" ? "performance.now" : "Date.now",
        engineMs: this.nativeTimes,
        callbackMs: this.callbackTimes.slice(0, this.callbacks),
        renderBudgetMs: (output.length / sampleRate) * 1000,
        validation: { repetitions, everyMs, loopMs },
        boundaryMicrobench: boundaryMicrobench(),
        warmupFrames: 80,
        input: "fixed deterministic 480-sample voiced/noise frame",
      });
      this.kernel.destroy();
      this.native.engine_dispose();
      this.done = true;
    }
    return !this.done;
  }
}
registerProcessor("audio-evidence-collector", EvidenceCollector);
registerProcessor("audio-evidence-pass", EvidencePass);
registerProcessor("audio-evidence-profile", EvidenceProfile);
