import type { CropOptions, CropRegion } from "./index.js";

export type VideoProcessorFaultKind = "unsupported" | "failed" | "overload";

export class VideoCropProcessorError extends Error {
  constructor(
    readonly faultKind: VideoProcessorFaultKind,
    message: string,
  ) {
    super(message);
    this.name = "VideoCropProcessorError";
  }
}

export interface VideoCropProcessor {
  readonly track: MediaStreamTrack;
  update(options: CropOptions): MediaStreamTrack;
  dispose(): void;
}

interface ProcessorOptions {
  readonly signal?: AbortSignal;
  readonly onFault?: (error: VideoCropProcessorError) => void;
}

interface CropRectangle {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

interface VideoFrameMetadataLike {
  readonly presentedFrames?: number;
}

type VideoElementWithFrameCallbacks = HTMLVideoElement & {
  cancelVideoFrameCallback?: (handle: number) => void;
  requestVideoFrameCallback?: (
    callback: (now: number, metadata: VideoFrameMetadataLike) => void,
  ) => number;
};

const abortError = (): Error => {
  const error = new Error("Video processing was cancelled.");
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
      (error: unknown) => {
        cleanup();
        reject(error);
      },
    );
  });
};

const finitePositive = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

const validateRegion = (region: CropRegion): void => {
  const values = [region.x, region.y, region.width, region.height];
  if (!values.every((value) => typeof value === "number" && Number.isFinite(value))) {
    throw new VideoCropProcessorError("failed", "Crop coordinates must be finite numbers.");
  }
  if (
    region.x < 0 ||
    region.y < 0 ||
    region.width <= 0 ||
    region.height <= 0 ||
    region.x + region.width > 1 ||
    region.y + region.height > 1
  ) {
    throw new VideoCropProcessorError(
      "failed",
      "The normalized crop rectangle must have positive dimensions and fit inside the source frame.",
    );
  }
};

const validateOptions = (options: CropOptions): void => {
  if (options.region !== undefined) validateRegion(options.region);
  if (options.aspectRatio !== undefined && !finitePositive(options.aspectRatio)) {
    throw new VideoCropProcessorError(
      "failed",
      "Crop aspectRatio must be a positive finite number.",
    );
  }
};

const cropRectangle = (options: CropOptions, sourceWidth: number, sourceHeight: number) => {
  let x = 0;
  let y = 0;
  let width = sourceWidth;
  let height = sourceHeight;

  if (options.region !== undefined) {
    x = options.region.x * sourceWidth;
    y = options.region.y * sourceHeight;
    width = options.region.width * sourceWidth;
    height = options.region.height * sourceHeight;
  }

  if (options.aspectRatio !== undefined) {
    const currentRatio = width / height;
    if (currentRatio > options.aspectRatio) {
      const nextWidth = height * options.aspectRatio;
      x += (width - nextWidth) / 2;
      width = nextWidth;
    } else if (currentRatio < options.aspectRatio) {
      const nextHeight = width / options.aspectRatio;
      y += (height - nextHeight) / 2;
      height = nextHeight;
    }
  }

  return { x, y, width, height } satisfies CropRectangle;
};

const waitForMetadata = (video: HTMLVideoElement, signal: AbortSignal | undefined): Promise<void> =>
  new Promise((resolve, reject) => {
    if (video.videoWidth > 0 && video.videoHeight > 0) {
      resolve();
      return;
    }

    const cleanup = (): void => {
      video.removeEventListener("loadedmetadata", onMetadata);
      video.removeEventListener("error", onError);
      signal?.removeEventListener("abort", onAbort);
    };
    const onMetadata = (): void => {
      cleanup();
      resolve();
    };
    const onError = (): void => {
      cleanup();
      reject(
        new VideoCropProcessorError("failed", "The camera video did not provide frame metadata."),
      );
    };
    const onAbort = (): void => {
      cleanup();
      reject(abortError());
    };

    video.addEventListener("loadedmetadata", onMetadata, { once: true });
    video.addEventListener("error", onError, { once: true });
    signal?.addEventListener("abort", onAbort, { once: true });
  });

export const createCanvasCropProcessor = async (
  inputTrack: MediaStreamTrack,
  initialOptions: CropOptions,
  processorOptions: ProcessorOptions = {},
): Promise<VideoCropProcessor> => {
  const { signal, onFault } = processorOptions;
  assertNotAborted(signal);
  validateOptions(initialOptions);

  if (
    typeof document === "undefined" ||
    typeof MediaStream === "undefined" ||
    inputTrack.kind !== "video" ||
    inputTrack.readyState !== "live"
  ) {
    throw new VideoCropProcessorError("unsupported", "Canvas video processing is unavailable.");
  }

  const video = document.createElement("video") as VideoElementWithFrameCallbacks;
  video.autoplay = true;
  video.muted = true;
  video.playsInline = true;

  let sourceStream: MediaStream;
  try {
    sourceStream = new MediaStream([inputTrack]);
    video.srcObject = sourceStream;
  } catch {
    throw new VideoCropProcessorError("unsupported", "A video source stream could not be created.");
  }

  let outputStream: MediaStream | null = null;
  let outputTrack: MediaStreamTrack | null = null;
  let callbackHandle: number | null = null;
  let callbackKind: "video" | "animation" | null = null;
  let disposed = false;
  let currentOptions = initialOptions;
  let latestFrameTime = -1;
  let previousPresentedFrames: number | null = null;
  let skippedSourceFrames = 0;
  let monitorStarted = 0;
  let monitorFrames = 0;
  let consecutiveSlowWindows = 0;
  let firstFrameSettled = false;
  let resolveFirstFrame: (() => void) | null = null;
  let rejectFirstFrame: ((error: Error) => void) | null = null;
  const firstFrame = new Promise<void>((resolve, reject) => {
    resolveFirstFrame = resolve;
    rejectFirstFrame = reject;
  });

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { alpha: false, desynchronized: true });
  const canvasWithCapture = canvas as HTMLCanvasElement & {
    captureStream?: (frameRate?: number) => MediaStream;
  };
  if (context === null || typeof canvasWithCapture.captureStream !== "function") {
    video.srcObject = null;
    throw new VideoCropProcessorError("unsupported", "Canvas capture is unavailable.");
  }

  const sourceSettings = (() => {
    try {
      return inputTrack.getSettings();
    } catch {
      return {};
    }
  })();
  const sourceFrameRate =
    typeof sourceSettings.frameRate === "number" && sourceSettings.frameRate > 0
      ? Math.min(30, sourceSettings.frameRate)
      : 30;

  const setCropOptions = (options: CropOptions): void => {
    validateOptions(options);
    const rectangle = cropRectangle(options, video.videoWidth, video.videoHeight);
    const width = Math.max(1, Math.round(rectangle.width));
    const height = Math.max(1, Math.round(rectangle.height));
    const dimensionsChanged = canvas.width !== width || canvas.height !== height;
    currentOptions = options;
    if (!dimensionsChanged) return;
    canvas.width = width;
    canvas.height = height;
    if (outputTrack !== null) captureOutput();
  };

  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    if (callbackHandle !== null) {
      if (callbackKind === "video") video.cancelVideoFrameCallback?.(callbackHandle);
      else if (callbackKind === "animation") window.cancelAnimationFrame(callbackHandle);
    }
    callbackHandle = null;
    callbackKind = null;
    inputTrack.removeEventListener("ended", onInputEnded);
    if (outputTrack !== null) {
      outputTrack.removeEventListener("ended", onOutputEnded);
      if (outputTrack.readyState !== "ended") outputTrack.stop();
    }
    for (const track of outputStream?.getTracks() ?? []) {
      if (track !== outputTrack && track.readyState !== "ended") track.stop();
    }
    video.pause();
    video.srcObject = null;
  };

  const fail = (error: VideoCropProcessorError): void => {
    if (disposed) return;
    if (!firstFrameSettled) {
      firstFrameSettled = true;
      rejectFirstFrame?.(error);
    }
    dispose();
    onFault?.(error);
  };

  const onInputEnded = (): void => {
    fail(new VideoCropProcessorError("failed", "The camera track ended during video processing."));
  };
  const onOutputEnded = (): void => {
    fail(
      new VideoCropProcessorError("failed", "The cropped video output track ended unexpectedly."),
    );
  };

  const captureOutput = (): void => {
    const captureStream = canvasWithCapture.captureStream;
    if (captureStream === undefined) {
      throw new VideoCropProcessorError("unsupported", "Canvas capture is unavailable.");
    }
    const nextStream = captureStream.call(canvasWithCapture, sourceFrameRate);
    const nextTrack = nextStream.getVideoTracks()[0] ?? null;
    if (nextTrack === null) {
      for (const track of nextStream.getTracks()) {
        if (track.readyState !== "ended") track.stop();
      }
      throw new VideoCropProcessorError("failed", "Canvas capture produced no video output track.");
    }

    const previousStream = outputStream;
    const previousTrack = outputTrack;
    nextTrack.addEventListener("ended", onOutputEnded);
    outputStream = nextStream;
    outputTrack = nextTrack;
    if (previousTrack !== null) {
      previousTrack.removeEventListener("ended", onOutputEnded);
      if (previousTrack.readyState !== "ended") previousTrack.stop();
      for (const track of previousStream?.getTracks() ?? []) {
        if (track !== previousTrack && track.readyState !== "ended") track.stop();
      }
    }
  };

  const draw = (now: number, metadata?: VideoFrameMetadataLike): void => {
    callbackHandle = null;
    callbackKind = null;
    if (disposed) return;

    try {
      if (video.videoWidth <= 0 || video.videoHeight <= 0) {
        throw new VideoCropProcessorError("failed", "The camera video has no drawable frame size.");
      }
      const rectangle = cropRectangle(currentOptions, video.videoWidth, video.videoHeight);
      const canvasWidth = Math.max(1, Math.round(rectangle.width));
      const canvasHeight = Math.max(1, Math.round(rectangle.height));
      if (canvas.width !== canvasWidth || canvas.height !== canvasHeight) {
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
      }
      context.drawImage(
        video,
        rectangle.x,
        rectangle.y,
        rectangle.width,
        rectangle.height,
        0,
        0,
        canvas.width,
        canvas.height,
      );
    } catch (cause) {
      fail(
        cause instanceof VideoCropProcessorError
          ? cause
          : new VideoCropProcessorError(
              "failed",
              cause instanceof Error ? cause.message : "The crop processor failed to draw a frame.",
            ),
      );
      return;
    }

    if (!firstFrameSettled) {
      firstFrameSettled = true;
      resolveFirstFrame?.();
    }

    let newSourceFrame = false;
    if (metadata?.presentedFrames !== undefined) {
      if (previousPresentedFrames === null || metadata.presentedFrames > previousPresentedFrames) {
        newSourceFrame = true;
      }
      if (
        previousPresentedFrames !== null &&
        metadata.presentedFrames > previousPresentedFrames + 1
      ) {
        skippedSourceFrames += metadata.presentedFrames - previousPresentedFrames - 1;
      }
      previousPresentedFrames = metadata.presentedFrames;
    } else {
      if (video.currentTime !== latestFrameTime) newSourceFrame = true;
      latestFrameTime = video.currentTime;
    }
    if (newSourceFrame) {
      monitorFrames += 1;
      if (monitorStarted === 0) monitorStarted = now;
    }

    const elapsed = now - monitorStarted;
    if (monitorStarted > 0 && elapsed >= 2000) {
      const observedRate = (monitorFrames * 1000) / elapsed;
      consecutiveSlowWindows =
        sourceFrameRate >= 29 && observedRate < sourceFrameRate * 0.95
          ? consecutiveSlowWindows + 1
          : 0;
      monitorFrames = 0;
      monitorStarted = now;
      if (consecutiveSlowWindows >= 2) {
        fail(
          new VideoCropProcessorError(
            "overload",
            `The crop processor sustained ${observedRate.toFixed(1)} fps below the ${sourceFrameRate} fps source budget and skipped ${skippedSourceFrames} source frames; original video was restored.`,
          ),
        );
        return;
      }
    }

    if (video.requestVideoFrameCallback !== undefined) {
      callbackKind = "video";
      callbackHandle = video.requestVideoFrameCallback(draw);
    } else if (
      typeof window !== "undefined" &&
      typeof window.requestAnimationFrame === "function"
    ) {
      callbackKind = "animation";
      callbackHandle = window.requestAnimationFrame((nextNow) => {
        if (video.currentTime !== latestFrameTime) latestFrameTime = video.currentTime;
        draw(nextNow);
      });
    } else {
      fail(new VideoCropProcessorError("unsupported", "Video frame callbacks are unavailable."));
    }
  };

  try {
    await waitForMetadata(video, signal);
    assertNotAborted(signal);
    if (video.videoWidth <= 0 || video.videoHeight <= 0) {
      throw new VideoCropProcessorError("failed", "The camera reported an empty video size.");
    }
    setCropOptions(initialOptions);
    await awaitWithAbort(video.play(), signal);
    assertNotAborted(signal);
    if (inputTrack.readyState !== "live") {
      throw new VideoCropProcessorError("failed", "The camera track ended during video setup.");
    }

    captureOutput();
    if (outputTrack === null) {
      throw new VideoCropProcessorError("failed", "Canvas capture produced no video output track.");
    }
    inputTrack.addEventListener("ended", onInputEnded, { once: true });

    if (video.requestVideoFrameCallback !== undefined) {
      callbackKind = "video";
      callbackHandle = video.requestVideoFrameCallback(draw);
    } else if (
      typeof window !== "undefined" &&
      typeof window.requestAnimationFrame === "function"
    ) {
      callbackKind = "animation";
      callbackHandle = window.requestAnimationFrame((now) => draw(now));
    } else {
      throw new VideoCropProcessorError("unsupported", "Video frame callbacks are unavailable.");
    }

    const onAbort = (): void =>
      fail(new VideoCropProcessorError("failed", "Video processing was cancelled."));
    signal?.addEventListener("abort", onAbort, { once: true });
    if (signal?.aborted) onAbort();
    try {
      await firstFrame;
      assertNotAborted(signal);
    } finally {
      signal?.removeEventListener("abort", onAbort);
    }
    return {
      get track() {
        if (outputTrack === null) {
          throw new VideoCropProcessorError("failed", "Canvas capture has no video output track.");
        }
        return outputTrack;
      },
      update: (options) => {
        setCropOptions(options);
        if (outputTrack === null) {
          throw new VideoCropProcessorError("failed", "Canvas capture has no video output track.");
        }
        return outputTrack;
      },
      dispose,
    };
  } catch (cause) {
    dispose();
    if (cause instanceof VideoCropProcessorError) throw cause;
    if (signal?.aborted || (cause instanceof Error && cause.name === "AbortError"))
      throw abortError();
    throw new VideoCropProcessorError(
      "failed",
      cause instanceof Error ? cause.message : "The crop processor could not start.",
    );
  }
};
