import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  const supported = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    if (typeof canvas.captureStream !== "function") return false;
    const stream = canvas.captureStream(0);
    try {
      return typeof Reflect.get(stream.getVideoTracks()[0] ?? {}, "requestFrame") === "function";
    } finally {
      for (const track of stream.getTracks()) track.stop();
    }
  });
  test.skip(
    !supported,
    "This synthetic throughput fixture requires canvas requestFrame; automatic fallback remains covered by video-crop.spec.ts.",
  );
});

test("compares native crop and frame-request control without camera access", async ({
  page,
}, testInfo) => {
  test.setTimeout(60_000);
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      configurable: true,
      value: () => Promise.reject(new Error("Synthetic comparison must not request a camera")),
    });
  });
  await page.goto("/tests/browser/video-crop-throughput.html");
  await page.locator("#duration").fill("3");
  await page.locator("#repetitions").fill("1");
  await page.locator("#start").click();
  await expect(page.locator("#status")).toContainText("Comparison complete", { timeout: 45_000 });
  const report = await page.evaluate(() => window.cropThroughputResult);
  expect(report?.status).toBe("completed");
  expect(report?.source).toBe("synthetic");
  expect(report?.tracksReleased).toBe(true);
  expect(report?.tracksObserved).toBe(4);
  expect(report?.liveTracksAfterCleanup).toBe(0);
  expect(report?.rows.map((row) => row.mode)).toEqual(["direct", "library", "timer", "request"]);
  expect(report?.rows.every((row) => row.input.callbacks > 2 && row.output.callbacks > 2)).toBe(
    true,
  );
  for (const mode of ["library", "request"]) {
    const row = report?.rows.find((candidate) => candidate.mode === mode);
    expect(row?.outputSettings).toEqual({ width: 960, height: 720, frameRate: 30 });
    expect(row?.outputToInputRatio).toBeGreaterThan(0.95);
  }
  await testInfo.attach("throughput-comparison.json", {
    body: JSON.stringify(report, null, 2),
    contentType: "application/json",
  });
});

test("native crop retains the 30 fps output cap with a 60 fps input", async ({
  page,
}, testInfo) => {
  test.setTimeout(30_000);
  await page.goto("/tests/browser/video-crop-throughput.html");
  await page.locator("#duration").fill("3");
  await page.locator("#repetitions").fill("1");
  await page.locator("#modes").selectOption("library");
  await page.locator("#source-fps").selectOption("60");
  await page.locator("#start").click();
  await expect(page.locator("#status")).toContainText("Comparison complete", { timeout: 20_000 });
  const report = await page.evaluate(() => window.cropThroughputResult);
  const row = report?.rows[0];
  expect(report?.tracksReleased).toBe(true);
  expect(row?.input.presentedFps).toBeGreaterThan(45);
  expect(row?.output.presentedFps).toBeLessThan(31);
  expect(row?.output.presentedFps).toBeGreaterThan(20);
  expect(row?.outputSettings.frameRate).toBe(30);
  await testInfo.attach("throughput-60fps-cap.json", {
    body: JSON.stringify(report, null, 2),
    contentType: "application/json",
  });
});

test("stopping the comparison releases its generated source and preview", async ({ page }) => {
  await page.goto("/tests/browser/video-crop-throughput.html");
  await page.locator("#start").click();
  await expect(page.locator("#status")).toContainText("warm-up");
  await page.locator("#stop").click();
  await expect(page.locator("#status")).toContainText("stopped");
  expect(await page.evaluate(() => window.cropThroughputResult?.tracksReleased)).toBe(true);
  await expect(page.locator("#videos video, #videos canvas")).toHaveCount(0);
});

test("crop keeps its output cap when the active source changes from 30 to 60 fps", async ({
  page,
}, testInfo) => {
  test.setTimeout(30_000);
  await page.goto("/tests/browser/index.html");
  const result = await page.evaluate(async () => {
    const runtimeUrl = new URL("/src/effects/video/runtime.ts", location.origin).href;
    const runtime = await import(runtimeUrl);
    const canvas = document.createElement("canvas");
    canvas.width = 1280;
    canvas.height = 720;
    const context = canvas.getContext("2d", { alpha: false });
    if (context === null) throw new Error("Missing source context");
    const source = canvas.captureStream(60);
    const track = source.getVideoTracks()[0];
    if (
      track === undefined ||
      !("requestFrame" in track) ||
      typeof track.requestFrame !== "function"
    )
      throw new Error("Missing frame request support");
    const requestSourceFrame = track.requestFrame;
    const nativeSettings = track.getSettings();
    let sourceRate = 30;
    // Simulate changing camera settings on the same native track, and change its real cadence too.
    Object.defineProperty(track, "getSettings", {
      configurable: true,
      value: () => ({ ...nativeSettings, frameRate: sourceRate }),
    });
    let next = 0,
      sequence = 0,
      pumpHandle = 0;
    const paint = (now: number): void => {
      if (now >= next) {
        context.fillStyle = `rgb(${sequence++ % 256},80,100)`;
        context.fillRect(0, 0, 1280, 720);
        Reflect.apply(requestSourceFrame, track, []);
        next += 1000 / sourceRate;
        if (next < now - 1000 / sourceRate) next = now + 1000 / sourceRate;
      }
      pumpHandle = requestAnimationFrame(paint);
    };
    pumpHandle = requestAnimationFrame(paint);
    const processor = await runtime.createCanvasCropProcessor(track, {
      region: { x: 0.125, y: 0, width: 0.75, height: 1 },
    });
    const input = document.createElement("video"),
      output = document.createElement("video");
    input.muted = true;
    output.muted = true;
    input.srcObject = source;
    output.srcObject = new MediaStream([processor.track]);
    input.style.width = "240px";
    output.style.width = "240px";
    document.body.append(input, output);
    const handles = new Map<HTMLVideoElement, number>();
    const samples = new Map<HTMLVideoElement, Array<{ now: number; frames: number }>>([
      [input, []],
      [output, []],
    ]);
    let counting = false,
      active = true;
    for (const video of [input, output]) {
      const observe = (now: number, metadata: VideoFrameCallbackMetadata): void => {
        if (!active) return;
        if (counting) samples.get(video)?.push({ now, frames: metadata.presentedFrames });
        handles.set(video, video.requestVideoFrameCallback(observe));
      };
      handles.set(video, video.requestVideoFrameCallback(observe));
    }
    const measure = async (): Promise<{ input: number; output: number }> => {
      samples.get(input)!.length = 0;
      samples.get(output)!.length = 0;
      counting = true;
      await new Promise<void>((resolve) => setTimeout(resolve, 3000));
      counting = false;
      const rate = (video: HTMLVideoElement): number => {
        const values = samples.get(video)!,
          first = values[0],
          last = values.at(-1);
        return first === undefined || last === undefined || last.now === first.now
          ? 0
          : ((last.frames - first.frames) * 1000) / (last.now - first.now);
      };
      return { input: rate(input), output: rate(output) };
    };
    try {
      await input.play();
      await output.play();
      await new Promise<void>((resolve) => setTimeout(resolve, 1000));
      const before = await measure();
      sourceRate = 60;
      next = performance.now();
      await new Promise<void>((resolve) => setTimeout(resolve, 1000));
      const after = await measure();
      return { before, after, outputFrameRate: processor.track.getSettings().frameRate };
    } finally {
      active = false;
      cancelAnimationFrame(pumpHandle);
      for (const video of [input, output]) {
        const handle = handles.get(video);
        if (handle !== undefined) video.cancelVideoFrameCallback(handle);
        video.pause();
        video.srcObject = null;
        video.remove();
      }
      processor.dispose();
      track.stop();
    }
  });
  expect(result.before.input).toBeGreaterThan(28);
  expect(result.before.output / result.before.input).toBeGreaterThan(0.95);
  expect(result.after.input).toBeGreaterThan(45);
  expect(result.after.output).toBeLessThan(31);
  expect(result.after.output).toBeGreaterThan(20);
  expect(result.outputFrameRate).toBe(30);
  await testInfo.attach("throughput-live-cap.json", {
    body: JSON.stringify(result, null, 2),
    contentType: "application/json",
  });
});
