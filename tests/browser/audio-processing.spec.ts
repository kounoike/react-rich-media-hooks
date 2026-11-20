import { expect, test } from "@playwright/test";

test("local RNNoise stays inside the audio session and records browser processing evidence", async ({
  page,
  browserName,
}) => {
  await page.goto("/tests/browser/index.html");

  const result = await page.evaluate(async () => {
    const libraryUrl = new URL("/dist/index.js", window.location.origin).href;
    const effectsUrl = new URL("/dist/effects/audio/index.js", window.location.origin).href;
    const runtimeUrl = new URL("/src/effects/audio/runtime.ts", window.location.origin).href;
    const library = await import(libraryUrl);
    const effects = await import(effectsUrl);
    const mediaDevices = navigator.mediaDevices;
    const getUserMedia = mediaDevices.getUserMedia.bind(mediaDevices);
    let getUserMediaCalls = 0;
    Object.defineProperty(mediaDevices, "getUserMedia", {
      configurable: true,
      value: (constraints: MediaStreamConstraints) => {
        getUserMediaCalls += 1;
        return getUserMedia(constraints);
      },
    });

    const session = library.createMediaSession({ capture: { audio: true, video: false } });
    const started = await session.start();
    const microphoneOutput = session.getOutput("audio");
    if (microphoneOutput === null) {
      await session.dispose();
      return {
        started: started.status,
        getUserMediaCalls,
        error: "No microphone output was created.",
      };
    }

    const clone = microphoneOutput.clone();
    const addStartedAt = performance.now();
    let added = await session.setAudioEffects({ effects: [effects.noiseReduction()] });
    const setupAttempts = [{ status: added.status, message: added.error?.message }];
    // Explicit consumer retries preserve capture; retain every cold-start failure as evidence.
    for (let attempt = 1; attempt < 3 && added.status !== "success"; attempt += 1) {
      await session.setAudioEffects({ effects: [] });
      added = await session.setAudioEffects({ effects: [effects.noiseReduction()] });
      setupAttempts.push({ status: added.status, message: added.error?.message });
    }
    const setupMs = performance.now() - addStartedAt;
    const transformedOutput = session.getOutput("audio");
    const activeStatus = session.getSnapshot().processors.audio.status;

    let continuity: {
      windows: number;
      finiteWindows: number;
      nonSilentWindows: number;
      rms: number;
    } | null = null;
    if (added.status === "success" && transformedOutput?.track !== microphoneOutput.track) {
      const analysisContext = new AudioContext({ sampleRate: 48_000 });
      await analysisContext.resume();
      const analysisTrack = transformedOutput.clone();
      const source = analysisContext.createMediaStreamSource(analysisTrack.stream);
      const analyser = analysisContext.createAnalyser();
      analyser.fftSize = 1024;
      const mutedSink = analysisContext.createGain();
      mutedSink.gain.value = 0;
      source.connect(analyser);
      analyser.connect(mutedSink);
      mutedSink.connect(analysisContext.destination);
      const samples = new Float32Array(analyser.fftSize);
      let finiteWindows = 0;
      let nonSilentWindows = 0;
      let squares = 0;
      let sampleCount = 0;
      const windows = 25;
      for (let windowIndex = 0; windowIndex < windows; windowIndex += 1) {
        await new Promise<void>((resolve) => setTimeout(resolve, 20));
        analyser.getFloatTimeDomainData(samples);
        if (samples.every(Number.isFinite)) finiteWindows += 1;
        let windowSquares = 0;
        for (const sample of samples) {
          windowSquares += sample * sample;
          sampleCount += 1;
        }
        squares += windowSquares;
        if (Math.sqrt(windowSquares / samples.length) > 0.0001) nonSilentWindows += 1;
      }
      continuity = {
        windows,
        finiteWindows,
        nonSilentWindows,
        rms: sampleCount === 0 ? 0 : Math.sqrt(squares / sampleCount),
      };
      analysisTrack.track.stop();
      source.disconnect();
      analyser.disconnect();
      mutedSink.disconnect();
      await analysisContext.close();
    }

    const observedStatus = session.getSnapshot().processors.audio.status;
    const observedError = session.getSnapshot().error?.message;
    const observedOutputIsOriginal = session.getOutput("audio")?.track === microphoneOutput.track;
    const updated = await session.setAudioEffects({
      effects: [effects.noiseReduction({ level: "strong" })],
    });
    const updatedOutputIsOriginal = session.getOutput("audio")?.track === microphoneOutput.track;
    const bypassed = await session.setAudioEffects({
      effects: [effects.noiseReduction({ level: "strong" })],
      bypass: true,
    });
    const bypassedTrackIsOriginal = session.getOutput("audio")?.track === microphoneOutput.track;
    const removed = await session.setAudioEffects({ effects: [] });
    const removedStatus = session.getSnapshot().processors.audio.status;

    let processorMetrics: Record<string, number> | null = null;
    let metricsError: string | null = null;
    try {
      const runtime = await import(runtimeUrl);
      const processor = await runtime.createAudioNoiseProcessor(microphoneOutput.track, "standard");
      await new Promise<void>((resolve) => setTimeout(resolve, 350));
      processorMetrics = processor.getMetrics();
      processor.dispose();
    } catch (cause) {
      metricsError = cause instanceof Error ? `${cause.name}: ${cause.message}` : String(cause);
    }

    const captureContext = new AudioContext({ sampleRate: 48_000 });
    const browserAudioBaselineMs = captureContext.baseLatency * 1000;
    const contextSampleRate = captureContext.sampleRate;
    await captureContext.close();
    await session.dispose();
    const cloneStayedLive = clone.track.readyState === "live";
    clone.track.stop();
    return {
      userAgent: navigator.userAgent,
      started: started.status,
      getUserMediaCalls,
      originalOwnership: microphoneOutput.ownership,
      cloneOwnership: clone.ownership,
      setupMs,
      setupAttempts,
      added: added.status,
      activeStatus,
      observedStatus,
      observedError,
      observedOutputIsOriginal,
      outputChanged: transformedOutput?.track !== microphoneOutput.track,
      continuity,
      updated: updated.status,
      updatedOutputIsOriginal,
      bypassed: bypassed.status,
      bypassedTrackIsOriginal,
      removed: removed.status,
      removedStatus,
      processorMetrics,
      metricsError,
      browserAudioBaselineMs,
      contextSampleRate,
      bufferedFrameMs: (480 / 48_000) * 1000,
      cloneStayedLive,
    };
  });

  await test.info().attach("audio-processing-measurement.json", {
    body: Buffer.from(JSON.stringify({ browserName, ...result }, null, 2)),
    contentType: "application/json",
  });

  expect(result.started).toBe("success");
  if (browserName === "chromium") {
    // Require native execution or its specific measured overload, never a glue/asset failure.
    // A browser name alone does not qualify the machine's real-time processing capacity.
    expect(
      result.added === "success" ||
        result.setupAttempts?.some((attempt) => attempt.message?.includes("render budget")),
    ).toBe(true);
    expect(
      result.observedStatus === "active" || result.observedError?.includes("render budget"),
    ).toBe(true);
    expect(result.metricsError === null || result.metricsError?.includes("render budget")).toBe(
      true,
    );
  }
  expect(result.getUserMediaCalls).toBe(1);
  expect(result.originalOwnership).toBe("session-owned");
  expect(result.cloneOwnership).toBe("application-owned-clone");
  expect(result.bypassed).toBe("success");
  expect(result.bypassedTrackIsOriginal).toBe(true);
  expect(result.removed).toBe("success");
  expect(result.removedStatus).toBe("off");
  expect(result.cloneStayedLive).toBe(true);
  if (result.added === "success" && result.observedStatus === "active") {
    expect(result.activeStatus).toBe("active");
    expect(result.outputChanged).toBe(true);
    expect(result.updated).toBe("success");
    expect(result.updatedOutputIsOriginal).toBe(false);
    expect(result.continuity?.finiteWindows).toBe(result.continuity?.windows);
    if (browserName === "chromium") {
      expect(result.continuity?.nonSilentWindows).toBeGreaterThan(0);
      expect(result.processorMetrics?.frames).toBeGreaterThan(0);
    }
  } else {
    expect(["failed", "unsupported", "degraded"]).toContain(result.observedStatus);
    expect(result.observedOutputIsOriginal).toBe(true);
    // Reapplying is an explicit retry: it can become ready before a later overload is observed.
    expect(["success", "failed", "unsupported"]).toContain(result.updated);
    expect(result.updatedOutputIsOriginal).toBe(result.updated !== "success");
  }
});

test("corrupt WASM fails integrity verification and keeps the original microphone", async ({
  page,
}) => {
  await page.route("**/rnnoise.wasm", (route) =>
    route.fulfill({
      contentType: "application/wasm",
      body: Buffer.from([0, 97, 115, 109, 1, 0, 0, 0]),
    }),
  );
  await page.goto("/tests/browser/index.html");
  const result = await page.evaluate(async () => {
    const library = await import(new URL("/dist/core/index.js", location.origin).href);
    const effects = await import(new URL("/dist/effects/audio/index.js", location.origin).href);
    const session = library.createMediaSession({ capture: { audio: true } });
    try {
      await session.start();
      const original = session.getOutput("audio")?.track;
      const added = await session.setAudioEffects({ effects: [effects.noiseReduction()] });
      return {
        status: added.status,
        message: added.error?.message,
        original: session.getOutput("audio")?.track === original,
        inputStillLive: original?.readyState === "live",
      };
    } finally {
      await session.dispose();
    }
  });
  expect(result).toMatchObject({ status: "failed", original: true, inputStillLive: true });
  expect(result.message).toContain("integrity verification failed");
});

test("loads local processing assets under a CSP without script unsafe-eval or blob", async ({
  page,
  browserName,
}) => {
  await page.route("**/tests/browser/index.html", (route) =>
    route.fulfill({
      contentType: "text/html",
      headers: {
        "Content-Security-Policy":
          "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self'; worker-src 'self'; media-src 'self'",
      },
      body: "<!doctype html><title>Audio CSP fixture</title><button>Enable local audio</button>",
    }),
  );
  await page.goto("/tests/browser/index.html");
  await page.getByRole("button", { name: "Enable local audio" }).click();
  const result = await page.evaluate(async () => {
    const violations: string[] = [];
    const onViolation = (event: SecurityPolicyViolationEvent): void => {
      violations.push(event.violatedDirective);
    };
    document.addEventListener("securitypolicyviolation", onViolation);
    const library = await import(new URL("/dist/core/index.js", location.origin).href);
    const effects = await import(new URL("/dist/effects/audio/index.js", location.origin).href);
    const session = library.createMediaSession({ capture: { audio: true } });
    try {
      await session.start();
      const original = session.getOutput("audio")?.track;
      const added = await session.setAudioEffects({ effects: [effects.noiseReduction()] });
      // Let asynchronous CSP evidence arrive; a processor deadline is a separate failure domain.
      await new Promise<void>((resolve) => setTimeout(resolve, 50));
      return {
        status: added.status,
        message: added.error?.message,
        violations,
        original: session.getOutput("audio")?.track === original,
        inputLive: original?.readyState === "live",
      };
    } finally {
      document.removeEventListener("securitypolicyviolation", onViolation);
      await session.dispose();
    }
  });
  expect(result.violations).toEqual([]);
  expect(result.inputLive).toBe(true);
  if (browserName === "chromium") expect(result.status).toBe("success");
  else {
    expect(["success", "failed"]).toContain(result.status);
    if (result.status === "failed") {
      expect(result.original).toBe(true);
      expect(result.message).toMatch(
        /render budget|did not initialize and produce audio within 1000 ms/,
      );
    }
  }
});

test("processorerror restores original audio and isolates processor cleanup", async ({ page }) => {
  await page.addInitScript(() => {
    const OriginalNode = AudioWorkletNode;
    globalThis.AudioWorkletNode = class extends OriginalNode {
      constructor(context: BaseAudioContext, name: string, options?: AudioWorkletNodeOptions) {
        super(context, name, options);
        const failAfterReady = (event: MessageEvent<{ type?: string }>): void => {
          if (event.data.type !== "ready") return;
          this.port.removeEventListener("message", failAfterReady);
          // Inject the browser event after normal native setup has reported readiness.
          setTimeout(() => this.dispatchEvent(new Event("processorerror")), 0);
        };
        this.port.addEventListener("message", failAfterReady);
      }
    };
  });
  await page.goto("/tests/browser/index.html");
  const result = await page.evaluate(async () => {
    const library = await import(new URL("/dist/core/index.js", location.origin).href);
    const effects = await import(new URL("/dist/effects/audio/index.js", location.origin).href);
    const session = library.createMediaSession({ capture: { audio: true } });
    try {
      await session.start();
      const original = session.getOutput("audio")?.track;
      await session.setAudioEffects({ effects: [effects.noiseReduction()] });
      await new Promise<void>((resolve) => setTimeout(resolve, 250));
      return {
        status: session.getSnapshot().processors.audio.status,
        code: session.getSnapshot().error?.code,
        original: session.getOutput("audio")?.track === original,
        live: original?.readyState === "live",
      };
    } finally {
      await session.dispose();
    }
  });
  expect(result).toEqual({
    status: "failed",
    code: "processor-failed",
    original: true,
    live: true,
  });
});
