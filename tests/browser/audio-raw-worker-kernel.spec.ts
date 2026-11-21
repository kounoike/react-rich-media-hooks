/* eslint-disable unicorn/require-post-message-target-origin -- Dedicated Worker messages have no targetOrigin. */
import { expect, test } from "@playwright/test";

test("actual raw Worker preserves C bits and monotonic framing across transferable streams", async ({
  page,
  browserName,
}) => {
  test.skip(
    browserName !== "chromium",
    "This raw Worker WebCodecs cell is qualified only in Chromium; Firefox has no raw audio track constructors.",
  );
  await page.goto("/tests/browser/index.html");
  const result = await page.evaluate(async () => {
    interface Frame {
      readonly timestamp: number;
      readonly numberOfFrames: number;
      copyTo(data: Float32Array, options: { planeIndex: number; format: "f32-planar" }): void;
      close(): void;
    }
    // eslint-disable-next-line typescript/no-unsafe-type-assertion -- Optional vendor AudioData is checked before construction.
    const scope = globalThis as typeof globalThis & {
      AudioData?: new (options: {
        format: string;
        sampleRate: number;
        numberOfChannels: number;
        numberOfFrames: number;
        timestamp: number;
        data: Float32Array;
      }) => Frame;
    };
    if (scope.AudioData === undefined) return { unsupported: true };
    const AudioData = scope.AudioData;
    const { RnnoiseKernel } = await import(
      new URL("/src/effects/audio/backends/rnnoise-kernel.ts", location.origin).href
    );
    const bytes = await (await fetch("/src/effects/audio/assets/rnnoise.wasm")).arrayBuffer();
    const module = await WebAssembly.compile(bytes),
      reference = new RnnoiseKernel(module);
    const input = Float32Array.from(
      { length: 480 * 120 },
      (_, i) => 0.08 * Math.sin(i * 0.13) + 0.02 * Math.sin(i * 1.27),
    );
    const expected = new Float32Array(input.length),
      actual = new Float32Array(input.length);
    for (let offset = 0; offset < input.length; offset += 480) {
      const frame = input.slice(offset, offset + 480);
      for (let i = 0; i < frame.length; i += 1) frame[i] = frame[i]! * 32768;
      reference.processFrame(frame);
      for (let i = 0; i < frame.length; i += 1)
        expected[offset + i] = Math.max(-1, Math.min(1, frame[i]! / 32768));
    }
    reference.destroy();
    const chunks = [128, 192, 960, 480],
      owned: Frame[] = [],
      timestamps: number[] = [];
    let cursor = 0,
      chunkIndex = 0,
      written = 0,
      closed = false;
    let sourceController!: ReadableStreamDefaultController<Frame>;
    const readable = new ReadableStream<Frame>(
      {
        start(controller) {
          sourceController = controller;
        },
        pull(controller) {
          if (cursor === input.length) return;
          const count = Math.min(chunks[chunkIndex++ % chunks.length]!, input.length - cursor);
          // +/-500us capture jitter must not accumulate in generated output PTS.
          const audio = new AudioData({
            format: "f32-planar",
            sampleRate: 48_000,
            numberOfChannels: 1,
            numberOfFrames: count,
            timestamp: Math.round((cursor / 48_000) * 1e6) + (chunkIndex % 2 ? 0 : 500),
            data: input.slice(cursor, cursor + count),
          });
          owned.push(audio);
          controller.enqueue(audio);
          cursor += count;
        },
      },
      { highWaterMark: 0 },
    );
    const writable = new WritableStream<Frame>({
      write(audio) {
        const out = new Float32Array(audio.numberOfFrames);
        audio.copyTo(out, { planeIndex: 0, format: "f32-planar" });
        actual.set(out, written);
        written += out.length;
        timestamps.push(audio.timestamp);
        audio.close();
        if (written === input.length) sourceController.close();
      },
      close() {
        closed = true;
      },
      abort() {
        closed = true;
      },
    });
    const worker = new Worker(new URL("/src/effects/audio/noise-worker.ts", location.origin), {
      type: "module",
    });
    const faults: string[] = [];
    try {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(
          () => reject(new Error("Actual Worker frame test timed out.")),
          5_000,
        );
        worker.addEventListener("error", () => {
          clearTimeout(timeout);
          reject(new Error("Worker execution failed."));
        });
        worker.addEventListener(
          "message",
          ({ data }: MessageEvent<{ type: string; message?: string }>) => {
            if (data.type === "prepared")
              worker.postMessage({ type: "start", module, level: "strong", readable, writable }, [
                readable,
                writable,
              ]);
            if (data.type === "fault") faults.push(data.message ?? "unknown");
            if (data.type === "stopped") {
              clearTimeout(timeout);
              resolve();
            }
          },
        );
        worker.postMessage({ type: "prepare", module });
      });
      let differentBits = 0;
      const a = new Uint32Array(expected.buffer),
        b = new Uint32Array(actual.buffer);
      for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) differentBits += 1;
      return {
        differentBits,
        written,
        expected: input.length,
        timestampsContinuous: timestamps.every((stamp, i) => stamp === i * 10_000),
        frames: timestamps.length,
        closed,
        faults,
      };
    } finally {
      worker.terminate();
      for (const audio of owned) audio.close();
    }
  });
  await test.info().attach("raw-worker-kernel.json", {
    body: JSON.stringify(result, null, 2),
    contentType: "application/json",
  });
  test.skip(
    result.unsupported === true,
    "Worker AudioData unavailable; no processing qualification.",
  );
  expect(result).toMatchObject({
    differentBits: 0,
    written: 57_600,
    expected: 57_600,
    timestampsContinuous: true,
    frames: 120,
    closed: false,
    faults: ["Raw audio input ended."],
  });
});
