import { expect, test } from "@playwright/test";

test("fixed crop preserves capture ownership and records three baseline runs", async ({
  page,
}, testInfo) => {
  test.setTimeout(60_000);
  await page.goto("/tests/browser/index.html");

  const result = await page.evaluate(async () => {
    interface SourceFrame {
      readonly red: number;
      readonly green: number;
      readonly blue: number;
      readonly paintedAt: number;
    }
    interface BenchmarkState {
      captureRequests: number;
      sourceFrames: SourceFrame[];
      cleanupSource: (() => void) | null;
    }
    interface BenchmarkWindow extends Window {
      videoCropBenchmark?: BenchmarkState;
    }
    interface Metric {
      profile: "capture-only" | "pass-through" | "crop";
      frames: number;
      sourceCanvasPaints: number;
      sourceCanvasPaintFps: number;
      sourcePaintToPreviewFrameDelta: number;
      sourceFrameDropPercent: number | null;
      fps: number;
      droppedFrames: number;
      latencySamples: number;
      sourceToPreviewP50Ms: number | null;
      sourceToPreviewP95Ms: number | null;
      sourceToPreviewMaxMs: number | null;
      sourceToPreviewLatencySamplesMs: readonly number[];
      firstFrameMs: number | null;
    }
    interface ExtendedPerformance extends Performance {
      readonly memory?: { readonly usedJSHeapSize: number };
    }

    const state: BenchmarkState = {
      captureRequests: 0,
      sourceFrames: [],
      cleanupSource: null,
    };
    (window as BenchmarkWindow).videoCropBenchmark = state;
    const mediaDevices = navigator.mediaDevices;
    Object.defineProperty(mediaDevices, "getUserMedia", {
      configurable: true,
      value: async (_constraints: MediaStreamConstraints): Promise<MediaStream> => {
        state.captureRequests += 1;
        state.sourceFrames = [];
        const canvas = document.createElement("canvas");
        canvas.width = 1280;
        canvas.height = 720;
        const context = canvas.getContext("2d", { alpha: false });
        if (context === null) throw new Error("The deterministic source canvas is unavailable.");

        let frame = 0;
        const paint = (): void => {
          const paintedAt = performance.now();
          const frameId = frame++;
          const value = frameId % 240;
          const red = (value + 8) & 255;
          const green = (value * 17 + 23) & 255;
          const blue = (value * 37 + 41) & 255;
          context.fillStyle = `rgb(${red}, ${green}, ${blue})`;
          context.fillRect(0, 0, canvas.width, canvas.height);
          state.sourceFrames.push({ red, green, blue, paintedAt });
        };
        paint();
        const timer = window.setInterval(paint, 1000 / 30);
        const stream = canvas.captureStream(30);
        state.cleanupSource = () => window.clearInterval(timer);
        return stream;
      },
    });

    const libraryUrl = new URL("/dist/index.js", window.location.origin).href;
    const effectsUrl = new URL("/dist/effects/video/index.js", window.location.origin).href;
    const library = await import(libraryUrl);
    const videoEffects = await import(effectsUrl);
    const preview = document.createElement("video");
    preview.autoplay = true;
    preview.muted = true;
    preview.playsInline = true;
    preview.style.position = "fixed";
    preview.style.width = "640px";
    preview.style.height = "360px";
    preview.style.opacity = "0";
    document.body.append(preview);
    const sampleCanvas = document.createElement("canvas");
    sampleCanvas.width = 1;
    sampleCanvas.height = 1;
    const sampleContext = sampleCanvas.getContext("2d", { willReadFrequently: true });
    if (sampleContext === null) throw new Error("The latency sampler is unavailable.");
    const heapUsedBytes = (): number | null =>
      (performance as ExtendedPerformance).memory?.usedJSHeapSize ?? null;

    const attach = async (
      session: ReturnType<typeof library.createMediaSession>,
    ): Promise<void> => {
      const output = session.getOutput("video");
      if (output === null) throw new Error("The session has no video output.");
      preview.srcObject = output.stream;
      await preview.play();
    };

    const measure = async (
      profile: Metric["profile"],
      durationMs: number,
      requestStartedAt: number,
    ): Promise<Metric> => {
      if (preview.requestVideoFrameCallback === undefined) {
        return {
          profile,
          frames: 0,
          sourceCanvasPaints: 0,
          sourceCanvasPaintFps: 0,
          sourcePaintToPreviewFrameDelta: 0,
          sourceFrameDropPercent: null,
          fps: 0,
          droppedFrames: 0,
          latencySamples: 0,
          sourceToPreviewP50Ms: null,
          sourceToPreviewP95Ms: null,
          sourceToPreviewMaxMs: null,
          sourceToPreviewLatencySamplesMs: [],
          firstFrameMs: null,
        };
      }

      const startedAt = performance.now();
      const latencies: number[] = [];
      let frames = 0;
      let droppedFrames = 0;
      let previousPresentedFrames: number | null = null;
      let firstFrameAt: number | null = null;

      await new Promise<void>((resolve) => {
        const onFrame: VideoFrameRequestCallback = (now, metadata) => {
          frames += 1;
          firstFrameAt ??= now;
          sampleContext.drawImage(
            preview,
            Math.floor(preview.videoWidth / 2),
            Math.floor(preview.videoHeight / 2),
            1,
            1,
            0,
            0,
            1,
            1,
          );
          const samplePixels = sampleContext.getImageData(0, 0, 1, 1).data;
          const red = samplePixels[0] ?? 0;
          const green = samplePixels[1] ?? 0;
          const blue = samplePixels[2] ?? 0;
          const nearestSourceFrame = state.sourceFrames.reduce<{
            readonly frame: SourceFrame | null;
            readonly distance: number;
          }>(
            (nearest, frame) => {
              if (frame.paintedAt > now || now - frame.paintedAt > 1000) return nearest;
              const distance =
                Math.abs(frame.red - red) +
                Math.abs(frame.green - green) +
                Math.abs(frame.blue - blue);
              return distance < nearest.distance ||
                (distance === nearest.distance &&
                  (nearest.frame === null || frame.paintedAt > nearest.frame.paintedAt))
                ? { frame, distance }
                : nearest;
            },
            { frame: null, distance: Number.POSITIVE_INFINITY },
          );
          if (
            nearestSourceFrame.frame !== null &&
            nearestSourceFrame.distance <= 18 &&
            now >= nearestSourceFrame.frame.paintedAt
          ) {
            latencies.push(now - nearestSourceFrame.frame.paintedAt);
          }
          if (
            previousPresentedFrames !== null &&
            metadata.presentedFrames > previousPresentedFrames + 1
          ) {
            droppedFrames += metadata.presentedFrames - previousPresentedFrames - 1;
          }
          previousPresentedFrames = metadata.presentedFrames;
          if (now - startedAt >= durationMs) resolve();
          else preview.requestVideoFrameCallback(onFrame);
        };
        preview.requestVideoFrameCallback(onFrame);
      });

      const actualDuration = performance.now() - startedAt;
      const sourceFramesInWindow = state.sourceFrames.filter(
        ({ paintedAt }) => paintedAt >= startedAt && paintedAt < startedAt + durationMs,
      );
      const sourceCanvasPaints = sourceFramesInWindow.length;
      const percentileAtRank = (rank: number): number | null =>
        latencies.reduce<number | null>((percentile, latency) => {
          const atOrBelowRank = latencies.reduce(
            (count, sample) => count + Number(sample <= latency),
            0,
          );
          return atOrBelowRank >= rank && (percentile === null || latency < percentile)
            ? latency
            : percentile;
        }, null);
      const sourceToPreviewP50Ms = percentileAtRank(Math.ceil(latencies.length * 0.5));
      const sourceToPreviewP95Ms = percentileAtRank(Math.ceil(latencies.length * 0.95));
      return {
        profile,
        frames,
        sourceCanvasPaints,
        sourceCanvasPaintFps: (sourceCanvasPaints * 1000) / actualDuration,
        sourcePaintToPreviewFrameDelta: sourceCanvasPaints - frames,
        sourceFrameDropPercent: null,
        fps: (frames * 1000) / actualDuration,
        droppedFrames,
        latencySamples: latencies.length,
        sourceToPreviewP50Ms,
        sourceToPreviewP95Ms,
        sourceToPreviewMaxMs: latencies.length === 0 ? null : Math.max(...latencies),
        sourceToPreviewLatencySamplesMs: latencies,
        firstFrameMs: firstFrameAt === null ? null : firstFrameAt - requestStartedAt,
      };
    };

    const trials: Array<{
      readonly captureOnly: Metric;
      readonly passThrough: Metric;
      readonly crop: Metric;
      readonly cropStartupMs: number;
      readonly initialOutput: { readonly width: number; readonly height: number };
      readonly updatedOutput: { readonly width: number; readonly height: number };
      readonly sameTrackAfterUpdate: boolean;
      readonly bypassRestoredInput: boolean;
      readonly removeRestoredInput: boolean;
      readonly warmEffectCycles: number;
      readonly effectTracksReleased: boolean;
      readonly warmStartStopCycles: number;
      readonly startStopTracksReleased: boolean;
      readonly heapBeforeStartStopCyclesBytes: number | null;
      readonly heapAfterStartStopCyclesBytes: number | null;
      readonly startStopHeapWithinBudget: boolean | null;
      readonly cropBudgetMet: boolean;
      readonly overloadFallbackVerified: boolean;
      readonly getUserMediaCalls: number;
      readonly lifecycleGetUserMediaCalls: number;
      readonly sourceSettings: MediaTrackSettings;
    }> = [];
    const allMetrics: Metric[] = [];
    const region = { x: 0.125, y: 0, width: 0.75, height: 1 };
    const updatedRegion = { x: 0.25, y: 0, width: 0.5, height: 1 };

    for (let index = 0; index < 3; index += 1) {
      const session = library.createMediaSession({
        capture: {
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30, max: 30 },
          },
          audio: false,
        },
      });
      const callsBefore = state.captureRequests;
      const startRequestedAt = performance.now();
      const started = await session.start();
      if (started.status !== "success") throw new Error(`Capture failed: ${started.status}`);
      await attach(session);
      const originalTrack = session.getOutput("video")!.track;
      const sourceSettings = originalTrack.getSettings();
      const captureOnly = await measure("capture-only", 2000, startRequestedAt);

      await session.setVideoEffects({ effects: [] });
      await attach(session);
      const passThrough = await measure("pass-through", 2000, performance.now());

      const cropStartedAt = performance.now();
      const cropped = await session.setVideoEffects({ effects: [videoEffects.crop({ region })] });
      const cropStartupMs = performance.now() - cropStartedAt;
      if (cropped.status !== "success") throw new Error(`Crop failed: ${cropped.status}`);
      await attach(session);
      const firstCropTrack = session.getOutput("video")!.track;
      const initialSettings = firstCropTrack.getSettings();
      const crop = await measure("crop", 2000, cropStartedAt);
      let overloadFallbackVerified = false;
      const firefoxSampleNeedsFallback =
        navigator.userAgent.includes("Firefox") && crop.fps < 30 * 0.95;
      if (crop.fps < 30 * 0.95) {
        const deadline = performance.now() + 5000;
        while (performance.now() < deadline) {
          if (
            session.getSnapshot().processors.video.status === "degraded" &&
            session.getOutput("video")?.track === originalTrack
          ) {
            overloadFallbackVerified = true;
            break;
          }
          await new Promise<void>((resolve) => window.setTimeout(resolve, 100));
        }
      }
      if (firefoxSampleNeedsFallback && !overloadFallbackVerified) {
        throw new Error(
          "Sustained Firefox crop overload did not restore the original video output.",
        );
      }

      const updated = await session.setVideoEffects({
        effects: [videoEffects.crop({ region: updatedRegion })],
      });
      if (updated.status !== "success") throw new Error(`Crop update failed: ${updated.status}`);
      const updatedTrack = session.getOutput("video")!.track;
      const updatedSettings = updatedTrack.getSettings();
      const bypassed = await session.setVideoEffects({
        effects: [videoEffects.crop({ region: updatedRegion })],
        bypass: true,
      });
      if (bypassed.status !== "success") throw new Error(`Crop bypass failed: ${bypassed.status}`);
      const bypassRestoredInput = session.getOutput("video")?.track === originalTrack;
      const inputTrack = session.getOutput("video")!.track;
      const removed = await session.setVideoEffects({ effects: [] });
      if (removed.status !== "success") throw new Error(`Crop removal failed: ${removed.status}`);
      const removeRestoredInput = session.getOutput("video")?.track === inputTrack;

      let warmEffectCycles = 1;
      let effectTracksReleased =
        firstCropTrack.readyState === "ended" && updatedTrack.readyState === "ended";
      for (let cycle = 1; cycle < 5; cycle += 1) {
        const addedAgain = await session.setVideoEffects({
          effects: [videoEffects.crop({ region })],
        });
        if (addedAgain.status !== "success") {
          throw new Error(`Warm crop cycle ${cycle + 1} failed to add the crop.`);
        }
        const cycleFirstTrack = session.getOutput("video")!.track;
        const updatedAgain = await session.setVideoEffects({
          effects: [videoEffects.crop({ region: updatedRegion })],
        });
        if (updatedAgain.status !== "success") {
          throw new Error(`Warm crop cycle ${cycle + 1} failed to update the crop.`);
        }
        const cycleUpdatedTrack = session.getOutput("video")!.track;
        const bypassAgain = await session.setVideoEffects({
          effects: [videoEffects.crop({ region: updatedRegion })],
          bypass: true,
        });
        if (bypassAgain.status !== "success") {
          throw new Error(`Warm crop cycle ${cycle + 1} failed to bypass the crop.`);
        }
        const cycleRestoredInput = session.getOutput("video")?.track === originalTrack;
        const removeAgain = await session.setVideoEffects({ effects: [] });
        if (removeAgain.status !== "success") {
          throw new Error(`Warm crop cycle ${cycle + 1} failed to remove the crop.`);
        }
        effectTracksReleased =
          effectTracksReleased &&
          cycleFirstTrack.readyState === "ended" &&
          cycleUpdatedTrack.readyState === "ended" &&
          cycleRestoredInput;
        warmEffectCycles += 1;
      }
      const cropBudgetMet =
        crop.fps >= 30 && crop.sourceToPreviewP95Ms !== null && crop.sourceToPreviewP95Ms <= 50;
      const getUserMediaCalls = state.captureRequests - callsBefore;

      await session.stop();
      state.cleanupSource?.();
      const heapBeforeStartStopCyclesBytes = heapUsedBytes();
      let warmStartStopCycles = 0;
      let startStopTracksReleased = true;
      const lifecycleCallsBefore = state.captureRequests;
      for (let cycle = 0; cycle < 5; cycle += 1) {
        const restarted = await session.start();
        if (restarted.status !== "success") {
          throw new Error(`Warm start/stop cycle ${cycle + 1} failed to capture.`);
        }
        const cycleInputTrack = session.getOutput("video")?.track;
        if (cycleInputTrack === undefined) {
          throw new Error(`Warm start/stop cycle ${cycle + 1} has no video output.`);
        }
        await session.stop();
        state.cleanupSource?.();
        startStopTracksReleased = startStopTracksReleased && cycleInputTrack.readyState === "ended";
        warmStartStopCycles += 1;
      }
      const lifecycleGetUserMediaCalls = state.captureRequests - lifecycleCallsBefore;
      const heapAfterStartStopCyclesBytes = heapUsedBytes();
      const startStopHeapWithinBudget =
        heapBeforeStartStopCyclesBytes === null || heapAfterStartStopCyclesBytes === null
          ? null
          : heapAfterStartStopCyclesBytes - heapBeforeStartStopCyclesBytes <=
            Math.max(heapBeforeStartStopCyclesBytes * 0.1, 5 * 1024 * 1024);

      allMetrics.push(captureOnly, passThrough, crop);
      trials.push({
        captureOnly,
        passThrough,
        crop,
        cropStartupMs,
        initialOutput: {
          width: initialSettings.width ?? 0,
          height: initialSettings.height ?? 0,
        },
        updatedOutput: {
          width: updatedSettings.width ?? 0,
          height: updatedSettings.height ?? 0,
        },
        sameTrackAfterUpdate: firstCropTrack === updatedTrack,
        bypassRestoredInput,
        removeRestoredInput,
        warmEffectCycles,
        effectTracksReleased,
        warmStartStopCycles,
        startStopTracksReleased,
        heapBeforeStartStopCyclesBytes,
        heapAfterStartStopCyclesBytes,
        startStopHeapWithinBudget,
        cropBudgetMet,
        overloadFallbackVerified,
        getUserMediaCalls,
        lifecycleGetUserMediaCalls,
        sourceSettings,
      });

      await session.dispose();
      preview.srcObject = null;
    }

    preview.remove();
    return {
      userAgent: navigator.userAgent,
      isSecureContext: window.isSecureContext,
      requestVideoFrameCallback: typeof HTMLVideoElement.prototype.requestVideoFrameCallback,
      trials,
      metrics: allMetrics,
    };
  });

  await testInfo.attach("video-crop-baseline.json", {
    body: JSON.stringify(result, null, 2),
    contentType: "application/json",
  });
  expect(result.isSecureContext).toBe(true);
  expect(result.requestVideoFrameCallback).toBe("function");
  expect(result.trials).toHaveLength(3);
  for (const trial of result.trials) {
    expect(trial.getUserMediaCalls).toBe(1);
    expect(trial.sameTrackAfterUpdate).toBe(false);
    expect(trial.bypassRestoredInput).toBe(true);
    expect(trial.removeRestoredInput).toBe(true);
    expect(trial.warmEffectCycles).toBe(5);
    expect(trial.effectTracksReleased).toBe(true);
    expect(trial.warmStartStopCycles).toBe(5);
    expect(trial.startStopTracksReleased).toBe(true);
    expect(trial.lifecycleGetUserMediaCalls).toBe(5);
    expect(trial.startStopHeapWithinBudget !== false).toBe(true);
    expect(trial.initialOutput).toEqual({ width: 960, height: 720 });
    expect(trial.updatedOutput).toEqual({ width: 640, height: 720 });
    expect(trial.sourceSettings.width).toBe(1280);
    expect(trial.sourceSettings.height).toBe(720);
  }
  expect(result.metrics).toHaveLength(9);
  expect(result.metrics.every((metric) => metric.frames > 0 && metric.sourceCanvasPaints > 0)).toBe(
    true,
  );
  expect(result.metrics.every((metric) => metric.latencySamples > 0)).toBe(true);
  expect(
    result.metrics.every(
      (metric) =>
        metric.sourceToPreviewP50Ms !== null &&
        metric.sourceToPreviewP95Ms !== null &&
        metric.sourceToPreviewMaxMs !== null,
    ),
  ).toBe(true);
});
