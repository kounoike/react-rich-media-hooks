import { describe, expect, it } from "vitest";
import { endpointFrameRate, callbackEndpointRate } from "./browser/video-crop-benchmark-metrics.js";

describe("benchmark endpoint FPS", () => {
  it("re-evaluates the three saved physical crop windows without initial wait", () => {
    const trials = [
      [23270.266, 25270.266, 32, 92, 30],
      [39553.166, 41519.8, 32, 91, 30.000498313362],
      [55802.732, 57769.3, 32, 91, 30.00150516],
    ];
    for (const [start, end, first, last, fps] of trials) {
      expect(
        endpointFrameRate(
          { callbackAtMs: start!, presentedFrames: first! },
          { callbackAtMs: end!, presentedFrames: last! },
        ),
      ).toBeCloseTo(fps!, 6);
    }
  });
  it("uses presented-frame advances when callbacks have gaps", () => {
    expect(
      endpointFrameRate(
        { callbackAtMs: 1000, presentedFrames: 10 },
        { callbackAtMs: 2000, presentedFrames: 40 },
      ),
    ).toBe(30);
    expect(callbackEndpointRate(1000, 2000, 16)).toBe(15);
  });
  it("does not invent a rate for incomplete or reset observations", () => {
    expect(endpointFrameRate(null, null)).toBeNull();
    expect(
      endpointFrameRate(
        { callbackAtMs: 1, presentedFrames: 2 },
        { callbackAtMs: 1, presentedFrames: 3 },
      ),
    ).toBeNull();
    expect(
      endpointFrameRate(
        { callbackAtMs: 1, presentedFrames: 9 },
        { callbackAtMs: 2, presentedFrames: 1 },
      ),
    ).toBeNull();
    expect(
      endpointFrameRate(
        { callbackAtMs: 1, presentedFrames: null },
        { callbackAtMs: 2, presentedFrames: 2 },
      ),
    ).toBeNull();
    expect(callbackEndpointRate(1, 2, 1)).toBeNull();
  });
  it("keeps below-budget presentation rates below the unchanged threshold", () => {
    expect(
      endpointFrameRate(
        { callbackAtMs: 17053.8, presentedFrames: 119 },
        { callbackAtMs: 19070.4, presentedFrames: 179 },
      ),
    ).toBeLessThan(30);
  });
});
