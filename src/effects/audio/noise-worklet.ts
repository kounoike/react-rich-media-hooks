/* eslint-disable unicorn/require-post-message-target-origin -- MessagePort has no targetOrigin parameter. */
import { RnnoiseKernel, RNNOISE_FRAME_SIZE } from "./backends/rnnoise-kernel.js";

declare class AudioWorkletProcessor {
  readonly port: MessagePort;
}

declare const sampleRate: number;
declare function registerProcessor(
  name: string,
  processorConstructor: new (options: AudioWorkletNodeOptions) => AudioWorkletProcessor,
): void;

type NoiseReductionLevel = "light" | "standard" | "strong";
type WorkletFaultKind = "failed" | "unsupported" | "overload";

const FRAME_SIZE = RNNOISE_FRAME_SIZE;
const PCM_SCALE = 32768;
const MIX_BY_LEVEL: Readonly<Record<NoiseReductionLevel, number>> = {
  light: 0.55,
  standard: 0.75,
  strong: 1,
};

class NoiseReductionProcessor extends AudioWorkletProcessor {
  private denoiseState: RnnoiseKernel | null = null;
  private inputFrame: Float32Array = new Float32Array(FRAME_SIZE);
  private dryFrame = new Float32Array(FRAME_SIZE);
  // Upstream v0.2 synthesizes the previous analysis window: align dry audio by two frames.
  private dryDelay = new Float32Array(FRAME_SIZE * 2);
  private dryDelayOffset = 0;
  private outputFrame = new Float32Array(FRAME_SIZE);
  private inputOffset = 0;
  private outputOffset = FRAME_SIZE;
  private level: NoiseReductionLevel = "standard";
  private failed = false;
  private disposed = false;
  private announcedReady = false;
  private slowFrameCount = 0;
  private readonly timingMessage = { type: "timing", processingMs: 0 };

  constructor(options: AudioWorkletNodeOptions) {
    super();
    this.port.addEventListener("message", (event: MessageEvent<unknown>): void => {
      const message = event.data;
      if (typeof message !== "object" || message === null || !("type" in message)) return;
      if (message.type === "dispose") {
        this.disposeState();
        return;
      }
      if (
        message.type === "update" &&
        "level" in message &&
        (message.level === "light" || message.level === "standard" || message.level === "strong")
      ) {
        this.level = message.level;
      }
    });
    this.port.start();

    const prepared: unknown = options.processorOptions;
    if (sampleRate !== 48_000) {
      this.fail("unsupported", `RNNoise requires 48 kHz audio (received ${sampleRate} Hz).`);
      return;
    }
    if (
      typeof prepared !== "object" ||
      prepared === null ||
      !("module" in prepared) ||
      !(prepared.module instanceof WebAssembly.Module)
    ) {
      this.fail("failed", "RNNoise requires a prepared WebAssembly module.");
      return;
    }
    try {
      this.denoiseState = new RnnoiseKernel(prepared.module);
      this.inputFrame = this.denoiseState.frameBuffer;
    } catch (cause) {
      this.fail("failed", this.errorMessage(cause, "RNNoise could not initialize."));
    }
  }

  process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    if (this.disposed) return false;
    const output = outputs[0]?.[0];
    if (output === undefined) return true;
    const channels = inputs[0] ?? [];
    const mono = channels.length === 1 ? channels[0] : undefined;

    for (let index = 0; index < output.length; index += 1) {
      // Preserve the reference downmix's signed-zero behavior while avoiding its mono loop.
      const input = mono === undefined ? this.downmix(channels, index) : (mono[index] ?? 0) + 0;
      if (this.failed) {
        output[index] = input;
        continue;
      }
      output[index] = this.outputOffset < FRAME_SIZE ? this.outputFrame[this.outputOffset++]! : 0;

      const state = this.denoiseState;
      if (state === null || this.failed) continue;

      this.inputFrame[this.inputOffset] = input * PCM_SCALE;
      this.dryFrame[this.inputOffset] = input;
      this.inputOffset += 1;
      if (this.inputOffset === FRAME_SIZE)
        this.processFrame(state, (output.length / sampleRate) * 1000);
    }
    return true;
  }

  private downmix(channels: Float32Array[], index: number): number {
    let sum = 0;
    let count = 0;
    for (const channel of channels) {
      const value = channel[index];
      if (value !== undefined) {
        sum += value;
        count += 1;
      }
    }
    return count === 0 ? 0 : sum / count;
  }

  private processFrame(state: RnnoiseKernel, renderBudgetMs: number): void {
    const startedAt = globalThis.performance?.now() ?? Date.now();
    try {
      state.processFrame(this.inputFrame);
      const elapsed = (globalThis.performance?.now() ?? Date.now()) - startedAt;
      this.timingMessage.processingMs = elapsed;
      this.port.postMessage(this.timingMessage);
      this.slowFrameCount = elapsed > renderBudgetMs ? this.slowFrameCount + 1 : 0;
      if (this.slowFrameCount >= 2) {
        this.fail(
          "overload",
          `RNNoise exceeded the ${renderBudgetMs.toFixed(2)} ms render budget for two consecutive processed frames.`,
        );
        return;
      }

      const wet = MIX_BY_LEVEL[this.level];
      const dry = 1 - wet;
      for (let index = 0; index < FRAME_SIZE; index += 1) {
        const delayedDry = this.dryDelay[this.dryDelayOffset + index]!;
        this.dryDelay[this.dryDelayOffset + index] = this.dryFrame[index]!;
        const mixed = delayedDry * dry + (this.inputFrame[index]! / PCM_SCALE) * wet;
        this.outputFrame[index] = Math.max(-1, Math.min(1, mixed));
      }
      this.dryDelayOffset = (this.dryDelayOffset + FRAME_SIZE) % this.dryDelay.length;
      this.inputOffset = 0;
      this.outputOffset = 0;
      if (!this.announcedReady) {
        this.announcedReady = true;
        this.port.postMessage({ type: "ready", frameSize: FRAME_SIZE });
      }
    } catch (cause) {
      this.fail("failed", this.errorMessage(cause, "RNNoise failed to process a frame."));
    }
  }

  private fail(faultKind: WorkletFaultKind, message: string): void {
    if (this.failed || this.disposed) return;
    this.failed = true;
    this.denoiseState?.destroy();
    this.denoiseState = null;
    this.inputOffset = 0;
    this.outputOffset = FRAME_SIZE;
    this.port.postMessage({ type: "fault", faultKind, message });
  }

  private disposeState(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.denoiseState?.destroy();
    this.denoiseState = null;
    this.port.close();
  }

  private errorMessage(cause: unknown, fallback: string): string {
    return cause instanceof Error ? cause.message : fallback;
  }
}

registerProcessor("rnnoise-noise-reduction", NoiseReductionProcessor);
