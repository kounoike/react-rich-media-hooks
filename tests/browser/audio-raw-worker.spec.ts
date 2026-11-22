import { expect, test } from "@playwright/test";

test("private raw Worker checks capabilities, produces audio and preserves independent clones", async ({
  page,
}) => {
  await page.goto("/tests/browser/index.html");
  const result = await page.evaluate(async () => {
    const messages: unknown[] = [];
    const NativeWorker = Worker;
    globalThis.Worker = class extends NativeWorker {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        this.addEventListener("message", (event: MessageEvent<unknown>) =>
          messages.push(event.data),
        );
      }
    };
    const raw = await import(
      new URL("/src/effects/audio/raw-audio-runtime.ts", location.origin).href
    );
    const globals = globalThis as typeof globalThis & {
      MediaStreamTrackProcessor?: unknown;
      MediaStreamTrackGenerator?: unknown;
    };
    const constructors = {
      processor: typeof globals.MediaStreamTrackProcessor,
      generator: typeof globals.MediaStreamTrackGenerator,
    };
    if (constructors.processor !== "function" || constructors.generator !== "function")
      return { constructors, unsupported: true };
    const context = new AudioContext({ sampleRate: 48_000 });
    const oscillator = context.createOscillator();
    const destination = context.createMediaStreamDestination();
    destination.channelCount = 1;
    oscillator.connect(destination);
    oscillator.start();
    await context.resume();
    const input = destination.stream.getAudioTracks()[0]!;
    const faults: string[] = [];
    let processor;
    try {
      processor = await raw.createRawAudioNoiseProcessor(input, "light", {
        onFault: (e: Error) => faults.push(e.message),
      });
      const output = processor.track,
        clone = output.clone();
      processor.update("standard");
      await new Promise((resolve) => setTimeout(resolve, 200));
      processor.update("strong");
      const metrics = processor.getMetrics();
      processor.dispose();
      processor.dispose();
      await new Promise((resolve) => setTimeout(resolve, 200));
      const cloneLive = clone.readyState === "live",
        inputLive = input.readyState === "live";
      clone.stop();
      // Real initialization cancellation: stop only the owned clone and reject promptly.
      const abort = new AbortController();
      const cancelled = raw.createRawAudioNoiseProcessor(input, "standard", {
        signal: abort.signal,
      });
      abort.abort();
      let abortName = "";
      try {
        await cancelled;
      } catch (e) {
        abortName = e instanceof Error ? e.name : String(e);
      }
      return {
        messages,
        constructors,
        metrics,
        faults,
        cloneLive,
        inputLive,
        outputEnded: output.readyState === "ended",
        abortName,
        settings: {
          sampleRate: input.getSettings().sampleRate,
          channelCount: input.getSettings().channelCount,
        },
        isolated: crossOriginIsolated,
      };
    } catch (e) {
      return { constructors, error: String(e), messages };
    } finally {
      processor?.dispose();
      input.stop();
      oscillator.stop();
      await context.close();
    }
  });
  await test.info().attach("raw-worker-lifecycle.json", {
    body: JSON.stringify(result, null, 2),
    contentType: "application/json",
  });
  if (result.unsupported) {
    expect(
      result.constructors.processor !== "function" || result.constructors.generator !== "function",
    ).toBe(true);
    return;
  }
  expect(result.error, JSON.stringify(result)).toBeUndefined();
  expect(result.faults).toEqual([]);
  expect(result.metrics.frames).toBeGreaterThan(3);
  expect(result.cloneLive).toBe(true);
  expect(result.inputLive).toBe(true);
  expect(result.outputEnded).toBe(true);
  expect(result.abortName).toBe("AbortError");
  expect(result.isolated).toBe(false);
});

test("enabled packaged route preserves session add/update/bypass/fault ownership", async ({
  page,
  browserName,
}) => {
  test.skip(
    process.env.AUDIO_RAW_BUILD !== "1" || browserName !== "chromium",
    "Requires explicitly enabled qualification package build.",
  );
  await page.goto("/tests/browser/index.html");
  const result = await page.evaluate(async () => {
    const library = await import(new URL("/dist/core/index.js", location.origin).href);
    const effects = await import(new URL("/dist/effects/audio/index.js", location.origin).href);
    const workers: Worker[] = [];
    const NativeWorker = Worker;
    globalThis.Worker = class extends NativeWorker {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        if (options?.name === "rnnoise-raw-audio") workers.push(this);
      }
    };
    const context = new AudioContext({ sampleRate: 48_000 });
    const oscillator = context.createOscillator(),
      destination = context.createMediaStreamDestination();
    destination.channelCount = 1;
    oscillator.connect(destination);
    oscillator.start();
    await context.resume();
    const track = destination.stream.getAudioTracks()[0]!;
    let acquisitions = 0;
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      configurable: true,
      value: () => {
        acquisitions += 1;
        return Promise.resolve(new MediaStream([track]));
      },
    });
    const session = library.createMediaSession({ capture: { audio: true } });
    try {
      await session.start();
      const original = session.getOutput("audio").track;
      const added = await session.setAudioEffects({
        effects: [effects.noiseReduction({ level: "light" })],
      });
      const processed = session.getOutput("audio").track,
        clone = processed.clone();
      const updated = await session.setAudioEffects({
        effects: [effects.noiseReduction({ level: "strong" })],
      });
      const sameTrack = session.getOutput("audio").track === processed;
      const workerCount = workers.length;
      workers[0]?.dispatchEvent(new Event("error"));
      await new Promise((resolve) => setTimeout(resolve, 200));
      const faultStatus = session.getSnapshot().processors.audio.status;
      const fallbackOriginal = session.getOutput("audio").track === original;
      const cloneLiveAfterFault = clone.readyState === "live";
      clone.stop();
      const retry = await session.setAudioEffects({ effects: [effects.noiseReduction()] });
      const retryClone = session.getOutput("audio").track.clone();
      const until = performance.now() + 180;
      while (performance.now() < until) {
        /* Intentional actual endpoint starvation. */
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
      const contentionStatus = session.getSnapshot().processors.audio.status;
      await context.suspend();
      await new Promise((resolve) => setTimeout(resolve, 250));
      const overload = {
        status: session.getSnapshot().processors.audio.status,
        original: session.getOutput("audio").track === original,
        cloneLive: retryClone.readyState === "live",
        message: session.getSnapshot().error?.message,
      };
      retryClone.stop();
      await context.resume();
      const bypass = await session.setAudioEffects({
        effects: [effects.noiseReduction()],
        bypass: true,
      });
      const bypassOriginal = session.getOutput("audio").track === original;
      const removed = await session.setAudioEffects({ effects: [] });
      return {
        added: added.status,
        addedError: added.error?.message,
        updatedError: updated.error?.message,
        updated: updated.status,
        retry: retry.status,
        bypass: bypass.status,
        removed: removed.status,
        sameTrack,
        overload,
        contentionStatus,
        workerCount,
        acquisitions,
        faultStatus,
        fallbackOriginal,
        cloneLiveAfterFault,
        bypassOriginal,
      };
    } finally {
      await session.dispose();
      oscillator.stop();
      track.stop();
      await context.close();
    }
  });
  await test.info().attach("packaged-worker-session.json", {
    body: JSON.stringify(result, null, 2),
    contentType: "application/json",
  });
  expect(result, JSON.stringify(result)).toMatchObject({
    added: "success",
    updated: "success",
    retry: "success",
    bypass: "success",
    removed: "success",
    overload: { status: "degraded", original: true, cloneLive: true },
    sameTrack: true,
    workerCount: 1,
    acquisitions: 1,
    faultStatus: "failed",
    fallbackOriginal: true,
    cloneLiveAfterFault: true,
    bypassOriginal: true,
  });
});

test("enabled Worker CSP failure keeps original media and clone ownership", async ({
  page,
  browserName,
}) => {
  test.skip(
    process.env.AUDIO_RAW_BUILD !== "1" || browserName !== "chromium",
    "Requires enabled qualification package.",
  );
  await page.route("**/tests/browser/raw-worker-csp.html", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><p>Worker CSP fixture</p>",
      headers: {
        "Content-Security-Policy":
          "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; worker-src 'none'; connect-src 'self'",
      },
    }),
  );
  await page.goto("/tests/browser/raw-worker-csp.html");
  const result = await page.evaluate(async () => {
    const library = await import(new URL("/dist/core/index.js", location.origin).href);
    const effects = await import(new URL("/dist/effects/audio/index.js", location.origin).href);
    const context = new AudioContext({ sampleRate: 48_000 }),
      destination = context.createMediaStreamDestination(),
      oscillator = context.createOscillator();
    destination.channelCount = 1;
    oscillator.connect(destination);
    oscillator.start();
    await context.resume();
    const source = destination.stream.getAudioTracks()[0]!;
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      configurable: true,
      value: () => Promise.resolve(new MediaStream([source])),
    });
    const session = library.createMediaSession({ capture: { audio: true } });
    const violations: string[] = [];
    document.addEventListener("securitypolicyviolation", (event) =>
      violations.push(event.violatedDirective),
    );
    try {
      await session.start();
      const original = session.getOutput("audio").track,
        clone = original.clone();
      const adding = session.setAudioEffects({ effects: [effects.noiseReduction()] });
      const originalWhileLoading = session.getOutput("audio").track === original;
      const added = await adding;
      await new Promise((resolve) => setTimeout(resolve, 200));
      const outcome = {
        added: added.status,
        error: added.error?.message,
        originalWhileLoading,
        originalAfterFailure: session.getOutput("audio").track === original,
        cloneLive: clone.readyState === "live",
        sourceLive: original.readyState === "live",
        violations,
      };
      clone.stop();
      return outcome;
    } finally {
      await session.dispose();
      oscillator.stop();
      source.stop();
      await context.close();
    }
  });
  await test.info().attach("raw-worker-csp.json", {
    body: JSON.stringify(result, null, 2),
    contentType: "application/json",
  });
  expect(result).toMatchObject({
    added: "failed",
    originalWhileLoading: true,
    originalAfterFailure: true,
    cloneLive: true,
    sourceLive: true,
  });
  expect(result.violations).toContain("worker-src");
  expect(result.error).toContain("Worker");
});

test("enabled Worker hard termination preserves output clones and restores original media", async ({
  page,
  browserName,
}) => {
  test.skip(
    process.env.AUDIO_RAW_BUILD !== "1" || browserName !== "chromium",
    "Requires enabled qualification package.",
  );
  await page.goto("/tests/browser/index.html");
  const result = await page.evaluate(async () => {
    const library = await import(new URL("/dist/core/index.js", location.origin).href);
    const effects = await import(new URL("/dist/effects/audio/index.js", location.origin).href);
    const workers: Worker[] = [],
      NativeWorker = Worker;
    globalThis.Worker = class extends NativeWorker {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        if (options?.name === "rnnoise-raw-audio") workers.push(this);
      }
    };
    const context = new AudioContext({ sampleRate: 48_000 }),
      destination = context.createMediaStreamDestination(),
      oscillator = context.createOscillator();
    destination.channelCount = 1;
    oscillator.connect(destination);
    oscillator.start();
    await context.resume();
    const source = destination.stream.getAudioTracks()[0]!;
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      configurable: true,
      value: () => Promise.resolve(new MediaStream([source])),
    });
    const session = library.createMediaSession({ capture: { audio: true } });
    try {
      await session.start();
      const original = session.getOutput("audio").track;
      const added = await session.setAudioEffects({ effects: [effects.noiseReduction()] });
      const clone = session.getOutput("audio").track.clone();
      const cloneLiveBefore = clone.readyState === "live";
      workers[0]?.terminate();
      await new Promise((resolve) => setTimeout(resolve, 350));
      const evidence = {
        added: added.status,
        workerCount: workers.length,
        cloneLiveBefore,
        cloneLiveAfterHardTermination: clone.readyState === "live",
        sourceLive: original.readyState === "live",
        originalRestored: session.getOutput("audio").track === original,
        status: session.getSnapshot().processors.audio.status,
        error: session.getSnapshot().error?.message,
      };
      clone.stop();
      return evidence;
    } finally {
      await session.dispose();
      oscillator.stop();
      source.stop();
      await context.close();
    }
  });
  await test.info().attach("raw-worker-hard-termination.json", {
    body: JSON.stringify(result, null, 2),
    contentType: "application/json",
  });
  expect(result).toMatchObject({
    added: "success",
    workerCount: 1,
    cloneLiveBefore: true,
    cloneLiveAfterHardTermination: true,
    sourceLive: true,
    originalRestored: true,
    status: "degraded",
  });
  expect(result.error).toContain("stopped making progress");
});
