export const RNNOISE_FRAME_SIZE = 480;

interface RnnoiseExports extends WebAssembly.Exports {
  readonly memory: WebAssembly.Memory;
  readonly _initialize: () => void;
  readonly engine_abi_version: () => number;
  readonly engine_init: () => number;
  readonly engine_frame_ptr: () => number;
  readonly engine_process: () => number;
  readonly engine_dispose: () => void;
}

const isRnnoiseExports = (value: WebAssembly.Exports): value is RnnoiseExports =>
  value.memory instanceof WebAssembly.Memory &&
  [
    "_initialize",
    "engine_abi_version",
    "engine_init",
    "engine_frame_ptr",
    "engine_process",
    "engine_dispose",
  ].every((name) => typeof value[name] === "function");

/** Per-worklet engine instance with fixed native state and reusable PCM storage. */
export class RnnoiseKernel {
  private readonly native: RnnoiseExports;
  private readonly frame: Float32Array;
  private readonly memoryBuffer: ArrayBuffer;
  private disposed = false;

  constructor(module: WebAssembly.Module) {
    const native = new WebAssembly.Instance(module).exports;
    if (!isRnnoiseExports(native) || native.engine_abi_version() !== 1) {
      throw new Error("Incompatible RNNoise engine ABI.");
    }
    // eslint-disable-next-line no-underscore-dangle -- Name exported by the pinned reactor build.
    native._initialize();
    if (native.engine_init() !== 0) throw new Error("RNNoise state could not initialize.");
    this.native = native;
    this.memoryBuffer = native.memory.buffer;
    this.frame = new Float32Array(this.memoryBuffer, native.engine_frame_ptr(), RNNOISE_FRAME_SIZE);
  }

  processFrame(input: Float32Array): void {
    if (this.disposed) throw new Error("RNNoise state is disposed.");
    if (input.length !== RNNOISE_FRAME_SIZE)
      throw new Error("RNNoise requires a 480-sample frame.");
    if (this.native.memory.buffer !== this.memoryBuffer)
      throw new Error("RNNoise memory changed during processing.");
    if (input !== this.frame) this.frame.set(input);
    const speechProbability = this.native.engine_process();
    if (
      !Number.isFinite(speechProbability) ||
      speechProbability < 0 ||
      !this.frame.every(Number.isFinite)
    ) {
      throw new Error("RNNoise returned invalid audio.");
    }
    if (input !== this.frame) input.set(this.frame);
  }

  /** Borrowed by the owning worklet only; valid until destroy, never application-owned. */
  get frameBuffer(): Float32Array {
    if (this.disposed) throw new Error("RNNoise state is disposed.");
    return this.frame;
  }

  destroy(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.native.engine_dispose();
  }
}
