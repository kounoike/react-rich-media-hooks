import { RnnoiseKernel, RNNOISE_FRAME_SIZE as SIZE } from "./backends/rnnoise-kernel.js";
import type { RawAudioData, RawAudioGlobals } from "./raw-audio-types.js";
import type { NoiseReductionLevel } from "./runtime.js";

const MIX = { light: 0.55, standard: 0.75, strong: 1 } as const;
const STALL_MS = 100;
export class RawAudioFault extends Error {
  constructor(
    readonly faultKind: "unsupported" | "failed" | "overload",
    message: string,
  ) {
    super(message);
  }
}

/** Owns at most one input chunk, a partial native frame and two output writes. No PCM on Window. */
export async function pumpRawAudio(options: {
  module: WebAssembly.Module;
  kernel?: RnnoiseKernel;
  readable: ReadableStream<RawAudioData>;
  writable: WritableStream<RawAudioData>;
  AudioData: NonNullable<RawAudioGlobals["AudioData"]>;
  signal: AbortSignal;
  level: () => NoiseReductionLevel;
  notify: (message: Record<string, unknown>) => void;
}): Promise<void> {
  const { signal, notify } = options;
  const kernel = options.kernel ?? new RnnoiseKernel(options.module);
  const reader = options.readable.getReader();
  const writer = options.writable.getWriter();
  const scratch = new Float32Array(960);
  const dryFrame = new Float32Array(SIZE);
  const dryDelay = new Float32Array(SIZE * 2);
  const samples = new Float32Array(SIZE);
  const frame = kernel.frameBuffer;
  let used = 0,
    dryOffset = 0,
    consecutiveFrames = 0,
    startupDiscontinuities = 0,
    startupPartialSamplesDiscarded = 0,
    ready = false,
    timestamp = 0,
    timelineOrigin: number | undefined;
  let sourceSamples = 0,
    submittedSamples = 0,
    writtenSamples = 0,
    frameCount = 0;
  let timestampJitterEvents = 0,
    minClockDriftUs = 0,
    maxClockDriftUs = 0;
  const diagnostics = (): void =>
    notify({
      type: "diagnostics",
      sourceSamples,
      submittedSamples,
      writtenSamples,
      frameCount,
      timestampJitterEvents,
      minClockDriftUs,
      maxClockDriftUs,
      startupDiscontinuities,
      startupPartialSamplesDiscarded,
    });
  const pending: Promise<void>[] = [];
  const cancel = (): void => {
    void reader.cancel().catch(() => undefined);
  };
  signal.addEventListener("abort", cancel, { once: true });
  const bounded = <T>(promise: Promise<T>): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      const cleanup = (): void => {
        clearTimeout(timer);
        signal.removeEventListener("abort", onAbort);
      };
      const onAbort = (): void => {
        cleanup();
        reject(new DOMException("Audio Worker cancelled.", "AbortError"));
      };
      const timer = setTimeout(() => {
        cleanup();
        reject(new RawAudioFault("overload", "Raw audio stalled for 100 ms."));
      }, STALL_MS);
      signal.addEventListener("abort", onAbort, { once: true });
      if (signal.aborted) onAbort();
      // Each completed operation removes its abort listener: no never-settling race promise retaining frame history.
      promise.then(
        (value) => {
          cleanup();
          resolve(value);
        },
        (cause: unknown) => {
          cleanup();
          reject(cause);
        },
      );
    });
  try {
    if (signal.aborted) cancel();
    while (!signal.aborted) {
      const { done, value: audio } = await bounded(reader.read());
      if (done) throw new RawAudioFault("failed", "Raw audio input ended.");
      try {
        const count = audio.numberOfFrames;
        if (
          audio.sampleRate !== 48_000 ||
          audio.numberOfChannels !== 1 ||
          count < 1 ||
          count > scratch.length
        ) {
          throw new RawAudioFault(
            "unsupported",
            "Raw audio requires 48 kHz mono chunks of at most 960 samples.",
          );
        }
        if (!Number.isFinite(audio.timestamp))
          throw new RawAudioFault("failed", "Invalid raw audio timestamp.");
        timelineOrigin ??= audio.timestamp;
        const drift = audio.timestamp - (timelineOrigin + (sourceSamples / 48_000) * 1_000_000);
        minClockDriftUs = Math.min(minClockDriftUs, drift);
        maxClockDriftUs = Math.max(maxClockDriftUs, drift);
        if (Math.abs(drift) > 1_000) timestampJitterEvents += 1;
        // Adjacent capture timestamps jitter by +/-10ms even with continuous sample counts.
        // Synthesize monotonic output PTS from counted samples; bound cumulative source drift.
        if (Math.abs(drift) > 40_000) {
          if (ready || drift < 0)
            throw new RawAudioFault(
              "overload",
              `Raw audio cumulative source clock drift ${drift} us exceeds 40 ms.`,
            );
          startupDiscontinuities += 1;
          startupPartialSamplesDiscarded += used;
          timelineOrigin = audio.timestamp - (sourceSamples / 48_000) * 1_000_000;
          used = 0;
          consecutiveFrames = 0;
          dryDelay.fill(0);
          dryOffset = 0;
        }
        const chunkStart = sourceSamples;
        sourceSamples += count;
        audio.copyTo(scratch, { planeIndex: 0, format: "f32-planar" });
        for (let index = 0; index < count; index += 1) {
          const input = scratch[index]! + 0;
          if (!Number.isFinite(input)) throw new RawAudioFault("failed", "Nonfinite raw input.");
          if (used === 0) timestamp = timelineOrigin + ((chunkStart + index) / 48_000) * 1_000_000;
          frame[used] = input * 32768;
          dryFrame[used++] = input;
          if (used !== SIZE) continue;
          const begin = performance.now();
          kernel.processFrame(frame);
          const processingMs = performance.now() - begin;
          const wet = MIX[options.level()];
          for (let i = 0; i < SIZE; i += 1) {
            const dry = dryDelay[dryOffset + i]!;
            dryDelay[dryOffset + i] = dryFrame[i]!;
            samples[i] = Math.max(-1, Math.min(1, dry * (1 - wet) + (frame[i]! / 32768) * wet));
          }
          dryOffset = (dryOffset + SIZE) % dryDelay.length;
          const output = new options.AudioData({
            format: "f32-planar",
            sampleRate: 48_000,
            numberOfChannels: 1,
            numberOfFrames: SIZE,
            timestamp: Math.round(timestamp),
            data: samples,
          });
          const write = writer
            .write(output)
            .then(() => {
              writtenSamples += SIZE;
            })
            .finally(() => output.close());
          submittedSamples += SIZE;
          void write.catch(() => undefined);
          pending.push(write);
          if (pending.length >= 2) await bounded(pending.shift()!);
          consecutiveFrames += 1;
          frameCount += 1;
          if (frameCount % 100 === 0) diagnostics();
          notify({ type: "timing", processingMs });
          // Two analysis-delay frames plus an accepted usable frame; engine initialization is insufficient.
          if (!ready && consecutiveFrames === 3) {
            await bounded(Promise.all(pending));
            pending.length = 0;
            ready = true;
            notify({ type: "ready", startupDiscontinuities, startupPartialSamplesDiscarded });
          }
          used = 0;
        }
      } finally {
        audio.close();
      }
    }
  } finally {
    signal.removeEventListener("abort", cancel);
    void reader.cancel().catch(() => undefined);
    reader.releaseLock();
    // Never close/abort the generator: that ends independent application clones too.
    writer.releaseLock();
    kernel.destroy();
    diagnostics();
  }
}
