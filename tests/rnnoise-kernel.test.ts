import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { RnnoiseKernel } from "../src/effects/audio/backends/rnnoise-kernel.js";

const module = new WebAssembly.Module(
  readFileSync(new URL("../src/effects/audio/assets/rnnoise.wasm", import.meta.url)),
);

const inputFrame = (index: number) =>
  Float32Array.from(
    { length: 480 },
    (_, sample) => 1000 * Math.sin(((index * 480 + sample) * 2 * Math.PI * 440) / 48_000),
  );

describe("built RNNoise kernel", () => {
  it("runs the real model with independent state and deterministic finite output", () => {
    const first = new RnnoiseKernel(module);
    const second = new RnnoiseKernel(module);
    let changed = false;
    for (let index = 0; index < 100; index += 1) {
      const original = inputFrame(index);
      const output = original.slice();
      const other = original.slice();
      first.processFrame(output);
      second.processFrame(other);
      expect(output.every(Number.isFinite)).toBe(true);
      expect(output).toEqual(other);
      changed ||= output.some((value, sample) => value !== original[sample]);
    }
    expect(changed).toBe(true);
    first.destroy();
    first.destroy();
    expect(() => first.processFrame(inputFrame(100))).toThrow("disposed");
    expect(() => second.processFrame(inputFrame(100))).not.toThrow();
    second.destroy();
  });

  it("rejects incorrect frames and incompatible modules", () => {
    const kernel = new RnnoiseKernel(module);
    expect(() => kernel.processFrame(new Float32Array(128))).toThrow("480-sample");
    const empty = new WebAssembly.Module(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]));
    expect(() => new RnnoiseKernel(empty)).toThrow("ABI");
    kernel.destroy();
  });
  it("reuses the owned native frame with exactly the same samples as the copying interface", () => {
    const inplace = new RnnoiseKernel(module);
    const copied = new RnnoiseKernel(module);
    const buffer = inplace.frameBuffer;
    for (let index = 0; index < 80; index += 1) {
      const input = inputFrame(index);
      buffer.set(input);
      inplace.processFrame(buffer);
      copied.processFrame(input);
      expect(inplace.frameBuffer).toBe(buffer);
      expect(buffer).toEqual(input);
    }
    inplace.destroy();
    copied.destroy();
    expect(() => inplace.frameBuffer).toThrow("disposed");
  });
});
