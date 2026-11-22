import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { pumpRawAudio } from "../src/effects/audio/raw-audio-pump.js";
import { RnnoiseKernel } from "../src/effects/audio/backends/rnnoise-kernel.js";
import type { RawAudioData } from "../src/effects/audio/raw-audio-types.js";
import type { NoiseReductionLevel } from "../src/effects/audio/runtime.js";

const module = new WebAssembly.Module(
  readFileSync(new URL("../src/effects/audio/assets/rnnoise.wasm", import.meta.url)),
);
class AudioFrame implements RawAudioData {
  readonly sampleRate: number;
  readonly numberOfChannels: number;
  readonly numberOfFrames: number;
  readonly timestamp: number;
  readonly data: Float32Array;
  closed = false;
  constructor(options: {
    sampleRate: number;
    numberOfChannels: number;
    numberOfFrames: number;
    timestamp: number;
    data: Float32Array;
  }) {
    Object.assign(this, options);
    this.sampleRate = options.sampleRate;
    this.numberOfChannels = options.numberOfChannels;
    this.numberOfFrames = options.numberOfFrames;
    this.timestamp = options.timestamp;
    this.data = options.data.slice();
  }
  copyTo(destination: Float32Array): void {
    destination.set(this.data);
  }
  close(): void {
    this.closed = true;
  }
}
const input = Float32Array.from({ length: 480 * 12 }, (_, i) => Math.sin(i * 0.13) * 0.1);
const chunk = (offset: number, length: number, timestamp = (offset / 48_000) * 1e6): AudioFrame =>
  new AudioFrame({
    sampleRate: 48_000,
    numberOfChannels: 1,
    numberOfFrames: length,
    timestamp,
    data: input.slice(offset, offset + length),
  });

describe("raw Worker native framing and ownership", () => {
  it.each([128, 192, 480, 960])(
    "matches unchanged C and frame-boundary level updates for %i-sample chunks",
    async (size) => {
      const abort = new AbortController();
      const written: AudioFrame[] = [],
        source: AudioFrame[] = [];
      let level: NoiseReductionLevel = "light",
        offset = 0;
      const expected = new RnnoiseKernel(module);
      const dryDelay = new Float32Array(960);
      let dryOffset = 0;
      const reference: Float32Array[] = [];
      for (let i = 0; i < input.length; i += 480) {
        const frame = input.slice(i, i + 480);
        for (let j = 0; j < 480; j += 1) frame[j] = frame[j]! * 32768;
        expected.processFrame(frame);
        const mix = i < 480 * 5 ? 0.55 : i < 480 * 9 ? 0.75 : 1;
        for (let j = 0; j < 480; j += 1) {
          const dry = dryDelay[dryOffset + j]!;
          dryDelay[dryOffset + j] = input[i + j]!;
          frame[j] = Math.max(-1, Math.min(1, dry * (1 - mix) + (frame[j]! / 32768) * mix));
        }
        dryOffset = (dryOffset + 480) % 960;
        reference.push(frame);
      }
      expected.destroy();
      let readyFrames = 0,
        notifications = 0,
        writerClosed = false;
      await pumpRawAudio({
        module,
        AudioData: AudioFrame,
        signal: abort.signal,
        level: () => level,
        readable: new ReadableStream(
          {
            pull(controller) {
              if (offset >= input.length) return;
              const audio = chunk(offset, size);
              source.push(audio);
              controller.enqueue(audio);
              offset += size;
            },
          },
          { highWaterMark: 0 },
        ),
        writable: new WritableStream({
          write(audio) {
            if (!(audio instanceof AudioFrame)) throw new Error("Wrong AudioData constructor");
            written.push(audio);
          },
          close() {
            writerClosed = true;
          },
          abort() {
            writerClosed = true;
          },
        }),
        notify(message) {
          if (message.type === "ready") readyFrames = written.length;
          if (message.type === "timing") {
            notifications += 1;
            if (notifications === 5) level = "standard";
            if (notifications === 9) level = "strong";
            if (notifications === 12) abort.abort();
          }
        },
      });
      expect(readyFrames).toBe(3);
      expect(written.map((frame) => frame.data)).toEqual(reference);
      expect(source.every((frame) => frame.closed)).toBe(true);
      expect(written.every((frame) => frame.closed)).toBe(true);
      expect(writerClosed).toBe(false);
    },
  );

  it.each(["rate", "channels", "chunk", "nonfinite", "gap"])(
    "rejects %s and closes every acquired AudioData",
    async (bad) => {
      const audio = chunk(0, bad === "chunk" ? 961 : 480);
      if (bad === "rate") Object.assign(audio, { sampleRate: 44_100 });
      if (bad === "channels") Object.assign(audio, { numberOfChannels: 2 });
      if (bad === "nonfinite") audio.data[0] = Number.NaN;
      const second = chunk(1440, 480, 80_000);
      const readable = new ReadableStream<RawAudioData>({
        start(controller) {
          controller.enqueue(audio);
          if (bad === "gap") {
            controller.enqueue(chunk(480, 480));
            controller.enqueue(chunk(960, 480));
            controller.enqueue(second);
          }
        },
      });
      await expect(
        pumpRawAudio({
          module,
          AudioData: AudioFrame,
          signal: new AbortController().signal,
          level: () => "strong",
          notify: () => undefined,
          readable,
          writable: new WritableStream(),
        }),
      ).rejects.toThrow();
      expect(audio.closed).toBe(true);
      if (bad === "gap") expect(second.closed).toBe(true);
      expect(readable.locked).toBe(false);
    },
  );

  it.each([false, true])(
    "bounds blocked writes and cancels without ending clones (abort=%s)",
    async (cancel) => {
      const abort = new AbortController();
      let pulls = 0,
        closeCalls = 0,
        writes = 0;
      let finishWrite!: () => void;
      const frames: AudioFrame[] = [];
      const readable = new ReadableStream<RawAudioData>(
        {
          pull(controller) {
            const audio = chunk((pulls++ % 10) * 480, 480, (pulls - 1) * 10_000);
            frames.push(audio);
            controller.enqueue(audio);
          },
        },
        { highWaterMark: 0 },
      );
      const writable = new WritableStream<RawAudioData>({
        write() {
          writes += 1;
          return new Promise<void>((resolve) => {
            finishWrite = resolve;
          });
        },
        close() {
          closeCalls += 1;
        },
        abort() {
          closeCalls += 1;
        },
      });
      const promise = pumpRawAudio({
        module,
        AudioData: AudioFrame,
        readable,
        writable,
        signal: abort.signal,
        level: () => "strong",
        notify: () => undefined,
      });
      if (cancel) setTimeout(() => abort.abort(), 10);
      await expect(promise).rejects.toMatchObject(
        cancel ? { name: "AbortError" } : { faultKind: "overload" },
      );
      expect(pulls).toBe(2);
      expect(writes).toBe(1);
      expect(closeCalls).toBe(0);
      expect(frames.every((frame) => frame.closed)).toBe(true);
      expect(writable.locked).toBe(false);
      finishWrite();
    },
  );
});
