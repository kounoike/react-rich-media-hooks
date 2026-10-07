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
  expect(result.stages.some((stage) => stage.sourceToPreviewP95Ms !== null)).toBe(true);
  expect(result.effectCycles).toHaveLength(5);
  expect(result.sessionCycles).toHaveLength(5);
  expect(result.profileSessionStartCalls).toBe(0);
  expect(result.sessionStartCalls).toBe(6);
  expect(result.cleanup?.cameraStopped).toBe(true);
  expect(result.cleanup?.effectTracksReleased).toBe(true);
  expect(result.cleanup?.sessionTracksReleased).toBe(true);
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

  await page.getByRole("button", { name: "Stop and release camera" }).click();
  await expect
    .poll(
      () => page.evaluate(() => window.videoCropBenchmarkRecord?.cleanup?.cameraStopped ?? false),
      { timeout: 15_000 },
    )
    .toBe(true);
  await page.evaluate(() => {
    for (const cleanup of window.manualBenchmarkHarness?.cleanups ?? []) cleanup();
  });
});
