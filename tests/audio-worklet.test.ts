import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RnnoiseKernel } from "../src/effects/audio/backends/rnnoise-kernel.js";

const module = new WebAssembly.Module(
  readFileSync(new URL("../src/effects/audio/assets/rnnoise.wasm", import.meta.url)),
);

class TestPort extends EventTarget {
  readonly postMessage = vi.fn();
  readonly start = vi.fn();
  readonly close = vi.fn();
  send(data: unknown): void {
    this.dispatchEvent(new MessageEvent("message", { data }));
  }
}

interface Worklet {
  readonly port: TestPort;
  process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean;
}
let Constructor: new (options: AudioWorkletNodeOptions) => Worklet;

beforeEach(async () => {
  vi.resetModules();
  vi.stubGlobal(
    "AudioWorkletProcessor",
    class {
      readonly port = new TestPort();
    },
  );
  vi.stubGlobal("sampleRate", 48_000);
  vi.stubGlobal("registerProcessor", (_name: string, constructor: typeof Constructor) => {
    Constructor = constructor;
  });
  vi.spyOn(performance, "now").mockReturnValue(0);
  await import("../src/effects/audio/noise-worklet.js");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const input = Float32Array.from(
  { length: 480 * 12 },
  (_, index) => 0.1 * Math.sin((index * 2 * Math.PI * 440) / 48_000),
);

const render = (quantum: number, level: "standard" | "strong") => {
  const worklet = new Constructor({ processorOptions: { module } });
  worklet.port.send({ type: "update", level });
  const rendered = new Float32Array(input.length);
  for (let offset = 0; offset < input.length; offset += quantum) {
    const output = rendered.subarray(offset, offset + quantum);
    worklet.process([[input.subarray(offset, offset + quantum)]], [[output]]);
  }
  worklet.port.send({ type: "dispose" });
  expect(worklet.process([], [])).toBe(false);
  return rendered;
};

describe("RNNoise worklet framing", () => {
  it.each([128, 192])("matches batch model output across %i-sample render quanta", (quantum) => {
    const reference = new RnnoiseKernel(module);
    const expected = new Float32Array(input.length + 480);
    for (let offset = 0; offset < input.length; offset += 480) {
      const frame = input.slice(offset, offset + 480);
      for (let index = 0; index < frame.length; index += 1) frame[index] = frame[index]! * 32768;
      reference.processFrame(frame);
      for (let index = 0; index < frame.length; index += 1) {
        expected[offset + 480 + index] = Math.max(-1, Math.min(1, frame[index]! / 32768));
      }
    }
    reference.destroy();
    expect(render(quantum, "strong")).toEqual(expected.slice(0, input.length));
  });

  it("aligns the dry mix with RNNoise's analysis delay", () => {
    const strong = render(128, "strong");
    const standard = render(128, "standard");
    for (let index = 0; index < input.length; index += 1) {
      const dry = index < 1440 ? 0 : input[index - 1440]!;
      expect(standard[index]).toBeCloseTo(strong[index]! * 0.75 + dry * 0.25, 7);
    }
  });

  it("reports repeated misses of the render quantum rather than the 10 ms model frame", () => {
    let clock = 0;
    vi.spyOn(performance, "now").mockImplementation(() => (clock += 3));
    const worklet = new Constructor({ processorOptions: { module } });
    for (let index = 0; index < 8; index += 1) {
      worklet.process([[new Float32Array(128)]], [[new Float32Array(128)]]);
    }
    expect(worklet.port.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "fault",
        faultKind: "overload",
        message: expect.stringContaining("2.67 ms render budget"),
      }),
    );
    worklet.port.send({ type: "dispose" });
  });
});
