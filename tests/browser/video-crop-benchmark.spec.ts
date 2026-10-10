import { expect, test, type Page } from "@playwright/test";

declare global {
  interface Window {
    manualBenchmarkHarness?: {
      captureRequests: number;
      cleanups: Array<() => void>;
    };
  }
}

const installSyntheticCamera = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    const cleanups: Array<() => void> = [];
    const harness = { captureRequests: 0, cleanups };
    window.manualBenchmarkHarness = harness;
    window.videoCropBenchmarkSyntheticInput = true;
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      configurable: true,
      value: async (): Promise<MediaStream> => {
        harness.captureRequests += 1;
        const marker = document.querySelector<HTMLCanvasElement>("#latency-marker");
        if (marker === null) throw new Error("The benchmark marker is missing.");
        const source = document.createElement("canvas");
        source.width = 1280;
        source.height = 720;
        const context = source.getContext("2d", { alpha: false });
        if (context === null) throw new Error("The synthetic camera context is unavailable.");
        const paint = (): void => {
          context.fillStyle = "#000000";
          context.fillRect(0, 0, source.width, source.height);
          const side = source.height;
          context.drawImage(marker, (source.width - side) / 2, 0, side, side);
        };
        paint();
        const timer = window.setInterval(paint, 1000 / 30);
        harness.cleanups.push(() => window.clearInterval(timer));
        return source.captureStream(30);
      },
    });
  });
};

const fillReferenceDetails = async (page: Page): Promise<void> => {
  await page.locator("#commit-sha").fill("0123456789abcdef0123456789abcdef01234567");
  await page.locator("#host-description").fill("synthetic Playwright host");
  await page.locator("#runtime-description").fill("Node test · pnpm test");
  await page.locator("#camera-description").fill("synthetic canvas camera");
};

test("physical crop benchmark requests only after start and exports synthetic lifecycle evidence", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await installSyntheticCamera(page);
  await page.goto("/tests/browser/video-crop-benchmark.html?test=1");
  await fillReferenceDetails(page);
  expect(await page.evaluate(() => window.manualBenchmarkHarness?.captureRequests ?? -1)).toBe(0);

  await page.getByRole("button", { name: "Start camera" }).click();
  await expect(page.locator("#status")).toContainText("Camera is active", { timeout: 15_000 });
  expect(await page.evaluate(() => window.manualBenchmarkHarness?.captureRequests ?? -1)).toBe(1);

  await page.getByRole("button", { name: "Run measurements" }).click();
  await expect(page.locator("#status")).toContainText("measuring", { timeout: 5_000 });
  await expect(page.locator("#status")).toContainText("Measurements complete", { timeout: 90_000 });
  const result = await page.evaluate(() => window.videoCropBenchmarkRecord ?? null);
  expect(result).not.toBeNull();
  if (result === null) throw new Error("The benchmark did not produce a JSON result.");

  const countFor = (profile: string): number =>
    result.stages.filter((stage) => stage.profile === profile).length;
  expect(result.status).toBe("completed");
  expect(result.firstUsableFrameMs).not.toBeNull();
  expect(countFor("capture-only")).toBe(3);
  expect(countFor("pass-through")).toBe(3);
  expect(countFor("fixed-crop")).toBe(3);
  expect(result.stages.every((stage) => stage.frames > 0)).toBe(true);
  for (const stage of result.stages) {
    const { first, last } = stage.frameWindow;
    if (
      first === null ||
      last === null ||
      first.presentedFrames === null ||
      last.presentedFrames === null
    )
      throw new Error("Missing frame endpoints.");
    expect(stage.frameRateMethod).toBe("presented-frame-callback-endpoints");
    expect(stage.frameRateFps).toBeCloseTo(
      ((last.presentedFrames - first.presentedFrames) * 1000) /
        (last.callbackAtMs - first.callbackAtMs),
      8,
    );
    expect(stage.wallWindowFrameRateFps).toBeCloseTo((stage.frames * 1000) / stage.measuredMs, 8);
  }
  expect(result.stages.some((stage) => stage.sourceToPreviewP95Ms !== null)).toBe(true);
  expect(result.effectCycles).toHaveLength(5);
  expect(result.sessionCycles).toHaveLength(5);
  expect(result.profileSessionStartCalls).toBe(0);
  expect(result.sessionStartCalls).toBe(6);
  expect(result.cleanup?.cameraStopped).toBe(true);
  expect(result.cleanup?.effectTracksReleased).toBe(true);
  expect(result.cleanup?.sessionTracksReleased).toBe(true);
  expect(result.browser.coreModuleUrl).toContain("/dist/core/index.js?benchmark=");
  expect(result.browser.coreModuleSha256).toMatch(/^[a-f0-9]{64}$/);
  expect(result.heapMeasurementMethod).toBe("approximate-uncollected-used-js-heap");
  expect(result.retainedHeapGrowthWithinBudget).toBeNull();
  expect(
    result.stages
      .filter((stage) => stage.profile === "capture-only")
      .every((stage) => stage.latencySamples === 0),
  ).toBe(true);
  expect(
    result.stages
      .filter((stage) => stage.profile === "fixed-crop")
      .every(
        (stage) =>
          stage.latencyMethod === "processor-sideband-id-v1" &&
          stage.latencySamples > 0 &&
          (stage.latencyMeasuredMs ?? 0) >= 500,
      ),
  ).toBe(true);
  expect(result.summary?.exactUndeliveredSourceFrameCount).toContain("unknown");
  expect(await page.evaluate(() => window.manualBenchmarkHarness?.captureRequests ?? -1)).toBe(6);

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download results JSON" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain("video-crop-benchmark-");
  await testInfo.attach("manual-benchmark-synthetic.json", {
    body: JSON.stringify(result, null, 2),
    contentType: "application/json",
  });

  await page.evaluate(() => {
    for (const cleanup of window.manualBenchmarkHarness?.cleanups ?? []) cleanup();
  });
});

test("explicit stop interrupts measurement and releases the camera", async ({ page }) => {
  test.setTimeout(30_000);
  await installSyntheticCamera(page);
  await page.goto("/tests/browser/video-crop-benchmark.html?test=1");
  await fillReferenceDetails(page);
  await page.getByRole("button", { name: "Start camera" }).click();
  await expect(page.locator("#status")).toContainText("Camera is active", { timeout: 15_000 });
  await page.getByRole("button", { name: "Run measurements" }).click();
  await expect(page.locator("#status")).toContainText("Trial 1 of 3", { timeout: 15_000 });
  await page.getByRole("button", { name: "Stop and release camera" }).click();
  await expect
    .poll(
      () => page.evaluate(() => window.videoCropBenchmarkRecord?.cleanup?.cameraStopped ?? false),
      { timeout: 15_000 },
    )
    .toBe(true);
  const status = await page.evaluate(() => window.videoCropBenchmarkRecord?.status ?? "missing");
  const captureRequests = await page.evaluate(
    () => window.manualBenchmarkHarness?.captureRequests ?? -1,
  );
  expect(status).toBe("stopped");
  expect(captureRequests).toBe(1);
  await page.evaluate(() => {
    for (const cleanup of window.manualBenchmarkHarness?.cleanups ?? []) cleanup();
  });
});

test("missing preview frames fail with a timeout instead of hanging", async ({ page }) => {
  test.setTimeout(30_000);
  await installSyntheticCamera(page);
  await page.goto("/tests/browser/video-crop-benchmark.html?test=1");
  await fillReferenceDetails(page);
  await page.getByRole("button", { name: "Start camera" }).click();
  await expect(page.locator("#status")).toContainText("Camera is active", { timeout: 15_000 });
  await page.locator("#preview").evaluate((element: HTMLVideoElement) => {
    Object.defineProperty(element, "requestVideoFrameCallback", {
      configurable: true,
      value: () => 1,
    });
    Object.defineProperty(element, "cancelVideoFrameCallback", {
      configurable: true,
      value: () => undefined,
    });
  });

  await page.getByRole("button", { name: "Run measurements" }).click();
  await expect(page.locator("#status")).toContainText("no complete measurement was collected", {
    timeout: 5_000,
  });
  const result = await page.evaluate(() => window.videoCropBenchmarkRecord ?? null);
  expect(result?.status).toBe("failed");
  expect(result?.stages).toHaveLength(0);
  expect(
    result?.issues.some((issue) => issue.includes("no complete measurement was collected")),
  ).toBe(true);

  await expect
    .poll(
      () => page.evaluate(() => window.videoCropBenchmarkRecord?.cleanup?.cameraStopped ?? false),
      { timeout: 15_000 },
    )
    .toBe(true);
  expect(result?.cleanup?.liveTracksAfterStop).toBe(0);
  await page.evaluate(() => {
    for (const cleanup of window.manualBenchmarkHarness?.cleanups ?? []) cleanup();
  });
});

test("a cached stale core entry cannot override the fresh benchmark build", async ({ page }) => {
  await installSyntheticCamera(page);
  await page.route("**/dist/core/index.js", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: 'export function createMediaSession() { throw new Error("stale core used"); }',
    }),
  );
  await page.goto("/tests/browser/video-crop-benchmark.html?test=1");
  await page.evaluate(async () => {
    const url = new URL("/dist/core/index.js", location.origin).href;
    await import(url);
  });
  await fillReferenceDetails(page);
  await page.getByRole("button", { name: "Start camera" }).click();
  await expect(page.locator("#status")).toContainText("Camera is active", { timeout: 15000 });
  await page.getByRole("button", { name: "Stop and release camera" }).click();
  await page.evaluate(() => {
    for (const cleanup of window.manualBenchmarkHarness?.cleanups ?? []) cleanup();
  });
});

test("retained heap is judged only at controlled post-GC boundaries", async ({
  page,
  browserName,
}, testInfo) => {
  test.skip(
    browserName !== "chromium",
    "Controlled GC uses Chrome DevTools Protocol; other engines retain an unknown heap verdict.",
  );
  test.setTimeout(60000);
  const cdp = await page.context().newCDPSession(page);
  let collections = 0;
  await page.exposeFunction("videoCropBenchmarkCollectGarbage", async () => {
    await cdp.send("HeapProfiler.collectGarbage");
    collections += 1;
    const heap = await cdp.send("Runtime.getHeapUsage");
    return heap.usedSize;
  });
  await installSyntheticCamera(page);
  await page.goto("/tests/browser/video-crop-benchmark.html?test=1");
  await fillReferenceDetails(page);
  await page.getByRole("button", { name: "Start camera" }).click();
  await expect(page.locator("#status")).toContainText("Camera is active", { timeout: 15000 });
  await page.getByRole("button", { name: "Run measurements" }).click();
  await expect(page.locator("#status")).toContainText("Measurements complete", { timeout: 45000 });
  const result = await page.evaluate(() => window.videoCropBenchmarkRecord);
  expect(collections).toBe(4);
  expect(result?.heapMeasurementMethod).toBe("controlled-post-gc-used-js-heap");
  expect(result?.retainedHeapGrowthWithinBudget).toBe(true);
  expect(result?.heapEffectGrowthWithinBudget).toBe(true);
  expect(result?.heapBeforeEffectCyclesBytes).toBeGreaterThan(0);
  expect(result?.heapAfterEffectCyclesBytes).toBeGreaterThan(0);
  expect(result?.cleanup?.liveTracksAfterDispose).toBe(0);
  await testInfo.attach("retained-heap-post-gc.json", {
    body: JSON.stringify(result, null, 2),
    contentType: "application/json",
  });
  await page.evaluate(() => {
    for (const cleanup of window.manualBenchmarkHarness?.cleanups ?? []) cleanup();
  });
});

test("timing readback errors preserve crop FPS and release the camera", async ({
  page,
}, testInfo) => {
  test.setTimeout(30000);
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await installSyntheticCamera(page);
  await page.addInitScript(() => {
    const original = Reflect.get(CanvasRenderingContext2D.prototype, "getImageData");
    if (typeof original !== "function") throw new Error("Synthetic readback hook unavailable.");
    CanvasRenderingContext2D.prototype.getImageData = function (...args) {
      if (this.canvas.width === 6 && this.canvas.height === 4) {
        throw new Error("Injected timing-readback failure");
      }
      return Reflect.apply(original, this, args);
    };
  });
  await page.goto("/tests/browser/video-crop-benchmark.html?test=1");
  await fillReferenceDetails(page);
  await page.getByRole("button", { name: "Start camera" }).click();
  await expect(page.locator("#status")).toContainText("Camera is active");
  await page.getByRole("button", { name: "Run measurements" }).click();
  await expect(page.locator("#status")).toContainText("The run stopped with an error", {
    timeout: 10000,
  });
  const result = await page.evaluate(() => window.videoCropBenchmarkRecord);
  await testInfo.attach("readback-failure.json", {
    body: JSON.stringify({ result, pageErrors }, null, 2),
    contentType: "application/json",
  });
  expect(result?.stages.filter((stage) => stage.profile === "fixed-crop")).toHaveLength(1);
  expect(result?.issues.join(" ")).toContain("Injected timing-readback failure");
  expect(pageErrors).toEqual([]);
  expect(result?.cleanup?.cameraStopped).toBe(true);
  expect(result?.cleanup?.liveTracksAfterStop).toBe(0);
  await expect(page.getByRole("button", { name: "Start camera" })).toBeEnabled();
  await page.evaluate(() => {
    for (const cleanup of window.manualBenchmarkHarness?.cleanups ?? []) cleanup();
  });
});

test("missing latency callbacks preserve FPS and export pipeline diagnostics", async ({
  page,
}, testInfo) => {
  test.setTimeout(30000);
  await installSyntheticCamera(page);
  await page.addInitScript(() => {
    const original = Reflect.get(HTMLVideoElement.prototype, "requestVideoFrameCallback");
    if (typeof original !== "function") throw new Error("Synthetic frame hook unavailable.");
    HTMLVideoElement.prototype.requestVideoFrameCallback = function (callback) {
      const missing =
        this.id === "preview" &&
        document.querySelector("#status")?.textContent?.includes("measuring processing latency");
      return original.call(this, missing ? () => {} : callback);
    };
  });
  await page.goto("/tests/browser/video-crop-benchmark.html?test=1");
  await fillReferenceDetails(page);
  await page.getByRole("button", { name: "Start camera" }).click();
  await expect(page.locator("#status")).toContainText("Camera is active");
  await page.getByRole("button", { name: "Run measurements" }).click();
  await expect(page.locator("#status")).toContainText("processing-latency timeout", {
    timeout: 10000,
  });
  const result = await page.evaluate(() => window.videoCropBenchmarkRecord);
  const crop = result?.stages.find((stage) => stage.profile === "fixed-crop");
  expect(crop?.frames).toBeGreaterThan(0);
  expect(crop?.latencyDiagnostics?.status).toBe("failed");
  expect(crop?.latencyDiagnostics?.previewCallbacks).toBe(0);
  expect(crop?.latencyDiagnostics?.inputCallbacks).toBeGreaterThan(0);
  expect(crop?.latencyDiagnostics?.cropDrawCalls).toBeGreaterThan(0);
  expect(crop?.latencyDiagnostics?.readbackAttempts).toBe(0);
  expect(crop?.latencyDiagnostics?.outputTrackState).toBe("live");
  expect(result?.cleanup?.liveTracksAfterStop).toBe(0);
  await testInfo.attach("latency-callback-timeout.json", {
    body: JSON.stringify(result, null, 2),
    contentType: "application/json",
  });
  await page.evaluate(() => {
    for (const cleanup of window.manualBenchmarkHarness?.cleanups ?? []) cleanup();
  });
});

test("normal-duration timing windows collect enough matched samples without camera access", async ({
  page,
  browserName,
}, testInfo) => {
  test.setTimeout(120000);
  if (browserName === "firefox") {
    // The project enforces media.navigator.streams.fake; no physical device is opened.
    // Native fake input avoids the observed long-window canvas-to-canvas source stall.
    await page.addInitScript(() => {
      window.videoCropBenchmarkSyntheticInput = true;
    });
  } else await installSyntheticCamera(page);
  await page.goto("/tests/browser/video-crop-benchmark.html");
  await fillReferenceDetails(page);
  // Input remains synthetic; this checkbox only exercises the normal UI path.
  await page.locator("#physical-camera-confirm").check();
  await page.getByRole("button", { name: "Start camera" }).click();
  await expect(page.locator("#status")).toContainText("Camera is active");
  await page.getByRole("button", { name: "Run measurements" }).click();
  await expect(page.locator("#status")).toContainText("Measurements complete", { timeout: 110000 });
  const result = await page.evaluate(() => window.videoCropBenchmarkRecord);
  expect(result?.browser.toolMode).toBe("synthetic Playwright timing");
  expect(result?.camera?.physicalDeviceResult).toContain("synthetic");
  expect(result?.stages).toHaveLength(9);
  for (const stage of result?.stages ?? []) {
    expect(stage.frameWindow.first).not.toBeNull();
    expect(stage.frameWindow.last).not.toBeNull();
    if (stage.profile !== "fixed-crop") continue;
    expect(stage.latencyDiagnostics?.status).toBe("complete");
    expect(stage.latencyMeasuredMs).toBeGreaterThanOrEqual(6000);
    expect(stage.latencySamples).toBeGreaterThanOrEqual(20);
    expect(stage.latencyDiagnostics?.readbackAttempts).toBeLessThanOrEqual(32);
  }
  expect(result?.cleanup?.liveTracksAfterDispose).toBe(0);
  await testInfo.attach("normal-window-synthetic.json", {
    body: JSON.stringify(
      { scope: "Synthetic input at normal durations; not physical acceptance", result },
      null,
      2,
    ),
    contentType: "application/json",
  });
  await page.evaluate(() => {
    for (const cleanup of window.manualBenchmarkHarness?.cleanups ?? []) cleanup();
  });
});
