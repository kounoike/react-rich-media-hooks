/* eslint-disable unicorn/require-post-message-target-origin -- MessagePort has no targetOrigin parameter. */
import type { AudioDenoiserBackend } from "./backend.js";

export type NoiseReductionLevel = "light" | "standard" | "strong";
export type AudioProcessorFaultKind = "unsupported" | "failed" | "overload";

export class AudioNoiseProcessorError extends Error {
  constructor(
    readonly faultKind: AudioProcessorFaultKind,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "AudioNoiseProcessorError";
  }
}

export interface AudioNoiseProcessor {
  readonly track: MediaStreamTrack;
  update(level: NoiseReductionLevel): void;
  getMetrics(): AudioProcessorMetrics;
  dispose(): void;
}

interface ProcessorOptions {
  readonly signal?: AbortSignal;
  readonly onFault?: (error: AudioNoiseProcessorError) => void;
  readonly startupTimeoutMs?: number;
}

type ProcessorMessage =
  | { readonly type: "ready" }
  | { readonly type: "timing"; readonly processingMs: number }
  | {
      readonly type: "fault";
      readonly faultKind: AudioProcessorFaultKind;
      readonly message: string;
    };

export interface AudioProcessorMetrics {
  readonly frames: number;
  readonly p50FrameProcessingMs: number;
  readonly p95FrameProcessingMs: number;
  readonly maxFrameProcessingMs: number;
}

const abortError = (): Error => {
  const error = new Error("Audio processing was cancelled.");
  error.name = "AbortError";
  return error;
};

const assertNotAborted = (signal: AbortSignal | undefined): void => {
  if (signal?.aborted) throw abortError();
};

const awaitWithAbort = <T>(promise: Promise<T>, signal: AbortSignal | undefined): Promise<T> => {
  assertNotAborted(signal);
  if (signal === undefined) return promise;

  return new Promise<T>((resolve, reject) => {
    const cleanup = (): void => signal.removeEventListener("abort", onAbort);
    const onAbort = (): void => {
      cleanup();
      reject(abortError());
    };
    signal.addEventListener("abort", onAbort, { once: true });
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
};

const faultFromMessage = (message: ProcessorMessage): AudioNoiseProcessorError => {
  if (message.type !== "fault") {
    return new AudioNoiseProcessorError(
      "failed",
      "The audio worklet returned an invalid response.",
    );
  }
  return new AudioNoiseProcessorError(message.faultKind, message.message);
};

const isProcessorMessage = (value: unknown): value is ProcessorMessage => {
  if (typeof value !== "object" || value === null || !("type" in value)) return false;
  if (value.type === "ready") return true;
  if (value.type === "timing") {
    return "processingMs" in value && typeof value.processingMs === "number";
  }
  return (
    value.type === "fault" &&
    "message" in value &&
    typeof value.message === "string" &&
    "faultKind" in value &&
    (value.faultKind === "unsupported" ||
      value.faultKind === "failed" ||
      value.faultKind === "overload")
  );
};

const percentile = (values: readonly number[], ratio: number): number => {
  if (values.length === 0) return 0;
  // eslint-disable-next-line unicorn/no-array-sort -- Sort a fresh copy without requiring ES2023 toSorted.
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(sorted.length * ratio) - 1)] ?? 0;
};

/** Internal host shared by project-owned backends; this is not a public plugin contract. */
export const createWorkletAudioNoiseProcessor = async (
  inputTrack: MediaStreamTrack,
  initialLevel: NoiseReductionLevel,
  backend: AudioDenoiserBackend,
  processorOptions: ProcessorOptions = {},
): Promise<AudioNoiseProcessor> => {
  const { signal, onFault, startupTimeoutMs = 1_000 } = processorOptions;
  assertNotAborted(signal);
  if (
    typeof AudioContext === "undefined" ||
    typeof AudioWorkletNode === "undefined" ||
    typeof MediaStream === "undefined" ||
    inputTrack.kind !== "audio" ||
    inputTrack.readyState !== "live"
  ) {
    throw new AudioNoiseProcessorError(
      "unsupported",
      "AudioWorklet noise reduction is unavailable.",
    );
  }

  let context: AudioContext;
  try {
    context = new AudioContext({ sampleRate: backend.contextSampleRate });
  } catch (cause) {
    throw new AudioNoiseProcessorError(
      "unsupported",
      cause instanceof Error
        ? cause.message
        : `${backend.label} could not create its AudioContext.`,
      { cause },
    );
  }

  let source: MediaStreamAudioSourceNode | null = null;
  let worklet: AudioWorkletNode | null = null;
  let destination: MediaStreamAudioDestinationNode | null = null;
  let outputTrack: MediaStreamTrack | null = null;
  let disposed = false;
  let ready = false;
  let resumed = false;
  let active = false;
  let faultReported = false;
  let resolveReady: (() => void) | null = null;
  let rejectReady: ((cause: unknown) => void) | null = null;
  let startupTimer: ReturnType<typeof setTimeout> | null = null;
  const frameProcessingTimes: number[] = [];

  const removeStartupListeners = (): void => {
    signal?.removeEventListener("abort", onAbort);
    if (startupTimer !== null) clearTimeout(startupTimer);
    startupTimer = null;
  };

  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    removeStartupListeners();
    inputTrack.removeEventListener("ended", onInputEnded);
    context.removeEventListener("statechange", onContextStateChange);
    outputTrack?.removeEventListener("ended", onOutputEnded);
    if (worklet !== null) {
      worklet.removeEventListener("processorerror", onProcessorError);
      worklet.port.removeEventListener("message", onMessage);
      try {
        worklet.port.postMessage({ type: "dispose" });
        worklet.port.close();
      } catch {
        // The browser may have already closed the worklet port.
      }
      worklet.disconnect();
    }
    source?.disconnect();
    destination?.disconnect();
    if (outputTrack !== null && outputTrack.readyState !== "ended") outputTrack.stop();
    if (context.state !== "closed") void context.close().catch(() => undefined);
  };

  const reportFault = (error: AudioNoiseProcessorError): void => {
    if (disposed || faultReported) return;
    faultReported = true;
    if (!active) {
      rejectReady?.(error);
      return;
    }
    onFault?.(error);
  };

  const onMessage = (event: MessageEvent<unknown>): void => {
    const message = event.data;
    if (!isProcessorMessage(message)) return;
    if (message?.type === "timing") {
      if (Number.isFinite(message.processingMs) && message.processingMs >= 0) {
        frameProcessingTimes.push(message.processingMs);
        if (frameProcessingTimes.length > 1_000) frameProcessingTimes.shift();
      }
      return;
    }
    if (message?.type === "ready") {
      // Each worklet validates its native framing before reporting usable output.
      ready = true;
      if (resumed) resolveReady?.();
      return;
    }
    if (message?.type === "fault") reportFault(faultFromMessage(message));
  };

  const onProcessorError = (): void =>
    reportFault(
      new AudioNoiseProcessorError(
        "failed",
        "The browser audio worklet failed and can no longer produce transformed audio.",
      ),
    );
  const onInputEnded = (): void =>
    reportFault(
      new AudioNoiseProcessorError("failed", "The microphone ended during audio processing."),
    );
  const onOutputEnded = (): void =>
    reportFault(
      new AudioNoiseProcessorError("failed", "The transformed audio output ended unexpectedly."),
    );
  const onAbort = (): void => rejectReady?.(abortError());
  const onContextStateChange = (): void => {
    if (active && context.state !== "running") {
      reportFault(
        new AudioNoiseProcessorError(
          "failed",
          "The audio context stopped running; reapply the effect after browser activation to retry.",
        ),
      );
    }
  };

  try {
    context.addEventListener("statechange", onContextStateChange);
    if (context.sampleRate !== backend.contextSampleRate || context.audioWorklet === undefined) {
      throw new AudioNoiseProcessorError(
        "unsupported",
        `This browser could not provide a ${backend.contextSampleRate} Hz AudioWorklet context for ${backend.label}.`,
      );
    }
    const prepared =
      backend.prepare === undefined
        ? undefined
        : await awaitWithAbort(backend.prepare(signal), signal);
    assertNotAborted(signal);
    await awaitWithAbort(context.audioWorklet.addModule(backend.workletUrl), signal);
    assertNotAborted(signal);

    const inputStream = new MediaStream([inputTrack]);
    source = context.createMediaStreamSource(inputStream);
    worklet = new AudioWorkletNode(context, backend.processorName, {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [backend.channelCount],
      channelCount: backend.channelCount,
      channelCountMode: "explicit",
      channelInterpretation: "speakers",
      ...(prepared === undefined ? {} : { processorOptions: prepared }),
    });
    destination = context.createMediaStreamDestination();
    destination.channelCount = backend.channelCount;
    outputTrack = destination.stream.getAudioTracks()[0] ?? null;
    if (outputTrack === null) {
      throw new AudioNoiseProcessorError("failed", "The audio worklet produced no output track.");
    }

    worklet.port.addEventListener("message", onMessage);
    worklet.port.start();
    worklet.port.postMessage({ type: "update", level: initialLevel });
    worklet.addEventListener("processorerror", onProcessorError, { once: true });
    inputTrack.addEventListener("ended", onInputEnded, { once: true });
    outputTrack.addEventListener("ended", onOutputEnded, { once: true });
    source.connect(worklet);
    worklet.connect(destination);

    const readyPromise = new Promise<void>((resolve, reject) => {
      resolveReady = resolve;
      rejectReady = reject;
      startupTimer = setTimeout(() => {
        reject(
          new AudioNoiseProcessorError(
            "failed",
            `${backend.label} did not initialize and produce audio within ${startupTimeoutMs} ms.`,
          ),
        );
      }, startupTimeoutMs);
      signal?.addEventListener("abort", onAbort, { once: true });
    });
    // Observe readiness before resuming: a worklet can fail while resume is still pending.
    await Promise.all([
      awaitWithAbort(readyPromise, signal),
      Promise.resolve().then(async () => {
        await awaitWithAbort(context.resume(), signal);
        resumed = true;
        if (ready) resolveReady?.();
      }),
    ]);
    assertNotAborted(signal);
    active = true;
    removeStartupListeners();

    const processorTrack = outputTrack;
    if (processorTrack === null) {
      throw new AudioNoiseProcessorError("failed", "The audio worklet output track disappeared.");
    }
    return {
      get track() {
        if (disposed || processorTrack.readyState !== "live") {
          throw new AudioNoiseProcessorError(
            "failed",
            "The transformed audio output is unavailable.",
          );
        }
        return processorTrack;
      },
      update: (level) => {
        if (disposed)
          throw new AudioNoiseProcessorError("failed", "The audio processor is disposed.");
        worklet?.port.postMessage({ type: "update", level });
      },
      getMetrics: () => ({
        frames: frameProcessingTimes.length,
        p50FrameProcessingMs: percentile(frameProcessingTimes, 0.5),
        p95FrameProcessingMs: percentile(frameProcessingTimes, 0.95),
        maxFrameProcessingMs:
          frameProcessingTimes.length > 0 ? Math.max(...frameProcessingTimes) : 0,
      }),
      dispose,
    };
  } catch (cause) {
    dispose();
    if (signal?.aborted || (cause instanceof Error && cause.name === "AbortError"))
      throw abortError();
    if (cause instanceof AudioNoiseProcessorError) throw cause;
    throw new AudioNoiseProcessorError(
      "failed",
      cause instanceof Error ? cause.message : `${backend.label} could not start.`,
      { cause },
    );
  }
};

export const createAudioNoiseProcessor = async (
  inputTrack: MediaStreamTrack,
  initialLevel: NoiseReductionLevel,
  processorOptions: ProcessorOptions = {},
): Promise<AudioNoiseProcessor> => {
  assertNotAborted(processorOptions.signal);
  const { rnnoiseBackend } = await import("./backends/rnnoise.js");
  return createWorkletAudioNoiseProcessor(
    inputTrack,
    initialLevel,
    rnnoiseBackend,
    processorOptions,
  );
};
