/* eslint-disable unicorn/require-post-message-target-origin -- Dedicated Worker messages have no targetOrigin. */
import workerUrl from "./noise-worker.ts?worker&url";
import { AudioNoiseProcessorError } from "./runtime.js";
import type { AudioNoiseProcessor, NoiseReductionLevel, ProcessorOptions } from "./runtime.js";
import type { RawAudioGlobals } from "./raw-audio-types.js";
import { rnnoiseBackend } from "./backends/rnnoise.js";

/** Capability rejection before publication can retain the existing Worklet route. */
export class RawAudioIneligibleError extends AudioNoiseProcessorError {
  constructor(message: string) {
    super("unsupported", message);
  }
}

const abortError = (): Error => new DOMException("Audio processing was cancelled.", "AbortError");
const noop = (): void => undefined;

/** Private qualification switch, compiled into the build; never an application API. */
export const rawAudioEligible = (track: MediaStreamTrack): boolean => {
  // eslint-disable-next-line typescript/no-unsafe-type-assertion -- Optional vendor audio globals are capability checked before construction.
  const scope = globalThis as typeof globalThis & RawAudioGlobals;
  if (
    import.meta.env.VITE_RNNOISE_RAW_WORKER !== "1" ||
    typeof Worker === "undefined" ||
    typeof scope.MediaStreamTrackProcessor !== "function" ||
    typeof scope.MediaStreamTrackGenerator !== "function" ||
    track.kind !== "audio" ||
    track.readyState !== "live"
  )
    return false;
  const settings = track.getSettings();
  return settings.sampleRate === 48_000 && settings.channelCount === 1;
};

export const createRawAudioNoiseProcessor = async (
  input: MediaStreamTrack,
  initialLevel: NoiseReductionLevel,
  options: ProcessorOptions = {},
): Promise<AudioNoiseProcessor & { getDiagnostics(): Readonly<Record<string, unknown>> }> => {
  const { signal, onFault, startupTimeoutMs = 1_000 } = options;

  if (signal?.aborted) throw abortError();
  // eslint-disable-next-line typescript/no-unsafe-type-assertion -- Optional vendor audio globals are capability checked before construction.
  const scope = globalThis as typeof globalThis & RawAudioGlobals;
  let ownedInput: MediaStreamTrack | undefined;
  let output: (MediaStreamTrack & { writable: WritableStream<unknown> }) | undefined;
  let worker: Worker | undefined;
  let disposed = false,
    active = false,
    faulted = false,
    nativePrepared = false;
  let startupTimer: ReturnType<typeof setTimeout> | undefined;
  let shutdownTimer: ReturnType<typeof setTimeout> | undefined;
  let progressTimer: ReturnType<typeof setInterval> | undefined;
  let lastProgressAt = 0;
  let rejectReady: (error: unknown) => void = noop;
  let resolveReady: () => void = noop;
  const times: number[] = [];
  let diagnostics: Readonly<Record<string, unknown>> = {};
  const ready = new Promise<void>((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  void ready.catch(() => undefined);
  const clearStartup = (): void => {
    clearTimeout(startupTimer);
    signal?.removeEventListener("abort", abort);
  };
  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    clearStartup();
    clearInterval(progressTimer);
    input.removeEventListener("ended", inputEnded);
    output?.removeEventListener("ended", outputEnded);
    ownedInput?.stop();
    output?.stop();
    if (worker !== undefined) {
      // A bounded cooperative stop releases stream locks and native state; force-stop blocked hosts.
      shutdownTimer = setTimeout(() => worker?.terminate(), 150);
      try {
        worker.postMessage({ type: "stop" });
      } catch {
        worker.terminate();
        clearTimeout(shutdownTimer);
      }
    }
  };
  const fault = (error: AudioNoiseProcessorError): void => {
    if (disposed || faulted) return;
    faulted = true;
    if (!active) rejectReady(error);
    else {
      dispose();
      onFault?.(error);
    }
  };
  const inputEnded = (): void =>
    fault(new AudioNoiseProcessorError("failed", "Raw audio source ended."));
  const outputEnded = (): void =>
    fault(new AudioNoiseProcessorError("failed", "Raw audio output ended."));
  const abort = (): void => {
    rejectReady(abortError());
    dispose();
  };
  try {
    signal?.addEventListener("abort", abort, { once: true });
    // Includes asset fetch/compile and stream transfer; cancellation rejects immediately even if fetch ignores abort.
    startupTimer = setTimeout(
      () =>
        rejectReady(
          new AudioNoiseProcessorError(
            "failed",
            "Raw audio did not produce usable output within the startup timeout.",
          ),
        ),
      startupTimeoutMs,
    );
    const prepare = (async (): Promise<void> => {
      const prepared = await rnnoiseBackend.prepare!(signal);
      if (disposed || signal?.aborted) throw abortError();
      if (
        scope.MediaStreamTrackProcessor === undefined ||
        scope.MediaStreamTrackGenerator === undefined
      ) {
        throw new AudioNoiseProcessorError(
          "unsupported",
          "Raw audio constructors are unavailable.",
        );
      }
      let resolvePrepared: () => void = noop;
      const workerPrepared = new Promise<void>((resolve) => {
        resolvePrepared = resolve;
      });
      worker = new Worker(workerUrl, { type: "module", name: "rnnoise-raw-audio" });
      worker.addEventListener("message", (event: MessageEvent<unknown>) => {
        const message = event.data;
        if (typeof message !== "object" || message === null || !("type" in message)) return;
        if (message.type === "diagnostics") diagnostics = message;
        if (message.type === "stopped") {
          if (!disposed)
            fault(new AudioNoiseProcessorError("failed", "Raw audio Worker stopped unexpectedly."));
          clearTimeout(shutdownTimer);
          worker?.terminate();
          return;
        }
        if (disposed || faulted) return;
        if (message.type === "prepared") {
          nativePrepared = true;
          resolvePrepared();
        }
        if (message.type === "ready") resolveReady();
        if (
          message.type === "timing" &&
          "processingMs" in message &&
          typeof message.processingMs === "number" &&
          Number.isFinite(message.processingMs) &&
          message.processingMs >= 0
        ) {
          lastProgressAt = performance.now();
          times.push(message.processingMs);
          if (times.length > 1_000) times.shift();
        }
        if (
          message.type === "fault" &&
          "message" in message &&
          typeof message.message === "string"
        ) {
          const kind =
            "faultKind" in message &&
            (message.faultKind === "unsupported" || message.faultKind === "overload")
              ? message.faultKind
              : "failed";
          fault(
            kind === "unsupported" && !nativePrepared
              ? new RawAudioIneligibleError(message.message)
              : new AudioNoiseProcessorError(kind, message.message),
          );
        }
      });
      worker.addEventListener("error", () =>
        fault(new AudioNoiseProcessorError("failed", "Raw audio Worker execution failed.")),
      );
      worker.addEventListener("messageerror", () =>
        fault(new AudioNoiseProcessorError("failed", "Raw audio Worker message transfer failed.")),
      );
      worker.postMessage({ type: "prepare", module: prepared.module });
      await Promise.race([workerPrepared, ready]);
      if (disposed || signal?.aborted) throw abortError();
      if (input.readyState !== "live")
        throw new AudioNoiseProcessorError("failed", "Raw audio source ended during preparation.");
      ownedInput = input.clone();
      const processor = new scope.MediaStreamTrackProcessor({
        track: ownedInput,
        maxBufferSize: 4,
      });
      output = new scope.MediaStreamTrackGenerator({ kind: "audio" });
      input.addEventListener("ended", inputEnded, { once: true });
      output.addEventListener("ended", outputEnded, { once: true });
      worker.postMessage(
        {
          type: "start",
          module: prepared.module,
          level: initialLevel,
          readable: processor.readable,
          writable: output.writable,
        },
        [processor.readable, output.writable],
      );
    })();
    await Promise.all([prepare, ready]);
    if (signal?.aborted || disposed) throw abortError();
    if (input.readyState !== "live" || output?.readyState !== "live" || faulted)
      throw new AudioNoiseProcessorError("failed", "Raw audio ended during startup.");
    active = true;
    clearStartup();
    lastProgressAt = performance.now();
    progressTimer = setInterval(() => {
      if (performance.now() - lastProgressAt > 100)
        fault(
          new AudioNoiseProcessorError(
            "overload",
            "Raw audio Worker stopped making progress for 100 ms.",
          ),
        );
    }, 50);
    const track = output;
    const percentile = (ratio: number): number => {
      // eslint-disable-next-line unicorn/no-array-sort -- Fresh bounded copy; ES2022 target.
      const sorted = [...times].sort((a, b) => a - b);
      return sorted[Math.max(0, Math.ceil(sorted.length * ratio) - 1)] ?? 0;
    };
    return {
      get track() {
        if (disposed || track.readyState !== "live")
          throw new AudioNoiseProcessorError("failed", "Raw audio output is unavailable.");
        return track;
      },
      update: (level) => {
        if (disposed)
          throw new AudioNoiseProcessorError("failed", "Raw audio processor is disposed.");
        worker?.postMessage({ type: "update", level });
      },
      getDiagnostics: () => diagnostics,
      getMetrics: () => ({
        frames: times.length,
        p50FrameProcessingMs: percentile(0.5),
        p95FrameProcessingMs: percentile(0.95),
        maxFrameProcessingMs: percentile(1),
      }),
      dispose,
    };
  } catch (cause) {
    dispose();
    if (signal?.aborted || (cause instanceof Error && cause.name === "AbortError"))
      throw abortError();
    if (
      ownedInput !== undefined &&
      cause instanceof DOMException &&
      (cause.name === "DataCloneError" || cause.name === "NotSupportedError")
    ) {
      throw new RawAudioIneligibleError(cause.message);
    }
    if (cause instanceof AudioNoiseProcessorError) throw cause;
    throw new AudioNoiseProcessorError(
      "failed",
      cause instanceof Error ? cause.message : "Raw audio startup failed.",
      { cause },
    );
  }
};
