import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createRawAudioNoiseProcessor,
  rawAudioEligible,
} from "../src/effects/audio/raw-audio-runtime.js";

const prepare = vi.hoisted(() => vi.fn());
vi.mock("../src/effects/audio/backends/rnnoise.js", () => ({ rnnoiseBackend: { prepare } }));
class Track extends EventTarget implements MediaStreamTrack {
  readonly id = "raw-test";
  readonly label = "Raw test";
  readonly kind = "audio";
  readonly muted = false;
  enabled = true;
  contentHint = "";
  readyState: MediaStreamTrackState = "live";
  onended = null;
  onmute = null;
  onunmute = null;
  readonly applyConstraints = () => Promise.resolve();
  readonly getCapabilities = () => ({});
  readonly getConstraints = () => ({});
  readonly getSettings = (): MediaTrackSettings => ({ sampleRate: 48_000, channelCount: 1 });
  readonly stop = vi.fn(() => {
    this.readyState = "ended";
  });
  readonly clone = vi.fn(() => new Track());
}
const workers: FakeWorker[] = [],
  outputs: Generator[] = [];
let autoReady = true,
  autoPrepared = true,
  transferFails = false;
class Generator extends Track {
  readonly writable = new WritableStream();
  constructor() {
    super();
    outputs.push(this);
  }
}
class FakeWorker extends EventTarget {
  readonly terminate = vi.fn();
  readonly postMessage = vi.fn((data: { type: string }) => {
    if (data.type === "start" && transferFails)
      throw new DOMException("transfer failed", "DataCloneError");
    if (data.type === "prepare" && autoPrepared)
      queueMicrotask(() => this.send({ type: "prepared" }));
    if (data.type === "start" && autoReady) queueMicrotask(() => this.send({ type: "ready" }));
  });
  constructor() {
    super();
    workers.push(this);
  }
  send(data: unknown): void {
    this.dispatchEvent(new MessageEvent("message", { data }));
  }
}
beforeEach(() => {
  workers.length = 0;
  outputs.length = 0;
  autoReady = true;
  autoPrepared = true;
  transferFails = false;
  prepare.mockReset().mockResolvedValue({ module: {} });
  vi.stubGlobal("Worker", FakeWorker);
  vi.stubGlobal(
    "MediaStreamTrackProcessor",
    class {
      readonly readable = new ReadableStream();
    },
  );
  vi.stubGlobal("MediaStreamTrackGenerator", Generator);
  vi.stubEnv("VITE_RNNOISE_RAW_WORKER", "1");
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("private raw Worker host", () => {
  it("keeps SSR/default gate/unknown rates and channels on the Worklet eligibility path", () => {
    const track = new Track();
    expect(rawAudioEligible(track)).toBe(true);
    vi.stubEnv("VITE_RNNOISE_RAW_WORKER", "0");
    expect(rawAudioEligible(track)).toBe(false);
    vi.stubEnv("VITE_RNNOISE_RAW_WORKER", "1");
    vi.spyOn(track, "getSettings").mockReturnValue({ sampleRate: 44_100, channelCount: 1 });
    expect(rawAudioEligible(track)).toBe(false);
    vi.spyOn(track, "getSettings").mockReturnValue({ sampleRate: 48_000, channelCount: 2 });
    expect(rawAudioEligible(track)).toBe(false);
    vi.spyOn(track, "getSettings").mockReturnValue({});
    expect(rawAudioEligible(track)).toBe(false);
    vi.stubGlobal("Worker", undefined);
    expect(rawAudioEligible(track)).toBe(false);
  });
  it("retains Worklet only for pre-publication capability rejection, not runtime failure", async () => {
    const raw = await import("../src/effects/audio/raw-audio-runtime.js");
    const runtime = await import("../src/effects/audio/runtime.js");
    const create = vi.spyOn(raw, "createRawAudioNoiseProcessor");
    create.mockRejectedValueOnce(new raw.RawAudioIneligibleError("Worker AudioData unavailable"));
    await expect(runtime.createAudioNoiseProcessor(new Track(), "standard")).rejects.toThrow(
      "AudioWorklet noise reduction is unavailable",
    );
    create.mockRejectedValueOnce(new runtime.AudioNoiseProcessorError("failed", "Worker crashed"));
    await expect(runtime.createAudioNoiseProcessor(new Track(), "standard")).rejects.toThrow(
      "Worker crashed",
    );
  });

  it("updates in place and disposes only owned tracks, ignoring stale messages and preserving clones", async () => {
    vi.useFakeTimers();
    const source = new Track(),
      fault = vi.fn();
    const processor = await createRawAudioNoiseProcessor(source, "light", { onFault: fault });
    const clone = processor.track.clone();
    processor.update("strong");
    expect(workers[0]!.postMessage).toHaveBeenCalledWith({ type: "update", level: "strong" });
    workers[0]!.send({ type: "timing", processingMs: 2 });
    expect(processor.getMetrics().p95FrameProcessingMs).toBe(2);
    processor.dispose();
    processor.dispose();
    workers[0]!.send({ type: "fault", faultKind: "failed", message: "stale" });
    workers[0]!.send({ type: "ready" });
    await vi.advanceTimersByTimeAsync(151);
    expect(workers[0]!.terminate).toHaveBeenCalledTimes(1);
    expect(fault).not.toHaveBeenCalled();
    expect(source.stop).not.toHaveBeenCalled();
    expect(source.clone.mock.results[0]!.value.stop).toHaveBeenCalledTimes(1);
    expect(outputs[0]!.stop).toHaveBeenCalledTimes(1);
    expect(clone.readyState).toBe("live");
    expect(() => processor.track).toThrow("unavailable");
  });
  it("detects a silent/hung active Worker and bounds force termination without ending clones", async () => {
    vi.useFakeTimers();
    const source = new Track(),
      fault = vi.fn();
    const processor = await createRawAudioNoiseProcessor(source, "standard", { onFault: fault });
    const clone = processor.track.clone();
    await vi.advanceTimersByTimeAsync(151);
    expect(fault).toHaveBeenCalledWith(
      expect.objectContaining({
        faultKind: "overload",
        message: expect.stringContaining("stopped making progress"),
      }),
    );
    expect(outputs[0]!.readyState).toBe("ended");
    expect(clone.readyState).toBe("live");
    expect(source.readyState).toBe("live");
    await vi.advanceTimersByTimeAsync(151);
    expect(workers[0]!.terminate).toHaveBeenCalledTimes(1);
    workers[0]!.send({ type: "timing", processingMs: 1 });
    expect(fault).toHaveBeenCalledTimes(1);
  });

  it.each(["fault", "error", "messageerror", "source", "output", "stopped"])(
    "reports active %s once and cleans owned media",
    async (cause) => {
      const source = new Track(),
        fault = vi.fn();
      const processor = await createRawAudioNoiseProcessor(source, "standard", { onFault: fault });
      const clone = processor.track.clone();
      if (cause === "fault")
        workers[0]!.send({ type: "fault", faultKind: "overload", message: "bounded stall" });
      else if (cause === "source") source.dispatchEvent(new Event("ended"));
      else if (cause === "output") outputs[0]!.dispatchEvent(new Event("ended"));
      else if (cause === "stopped") workers[0]!.send({ type: "stopped" });
      else workers[0]!.dispatchEvent(new Event(cause));
      workers[0]!.send({ type: "fault", message: "duplicate" });
      workers[0]!.send({ type: "stopped" });
      expect(fault).toHaveBeenCalledTimes(1);
      expect(source.stop).not.toHaveBeenCalled();
      expect(outputs[0]!.readyState).toBe("ended");
      expect(clone.readyState).toBe("live");
    },
  );
  it("rejects transfer failure observably and releases every owned track", async () => {
    transferFails = true;
    const source = new Track();
    await expect(createRawAudioNoiseProcessor(source, "standard")).rejects.toThrow(
      "transfer failed",
    );
    workers[0]!.send({ type: "stopped" });
    expect(outputs[0]!.readyState).toBe("ended");
    expect(source.readyState).toBe("live");
  });
  it("cancels unresponsive preparation promptly and suppresses late setup", async () => {
    let finish!: (value: unknown) => void;
    prepare.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const abort = new AbortController(),
      source = new Track();
    const result = createRawAudioNoiseProcessor(source, "standard", { signal: abort.signal });
    abort.abort();
    await expect(result).rejects.toMatchObject({ name: "AbortError" });
    finish({ module: {} });
    await Promise.resolve();
    expect(workers).toHaveLength(0);
    expect(source.clone).not.toHaveBeenCalled();
  });
  it.each(["abort", "unsupported"])(
    "does not acquire endpoint clones before Worker preparation (%s)",
    async (kind) => {
      autoPrepared = false;
      const source = new Track(),
        abort = new AbortController();
      const pending = createRawAudioNoiseProcessor(source, "standard", { signal: abort.signal });
      await Promise.resolve();
      await Promise.resolve();
      expect(workers).toHaveLength(1);
      expect(source.clone).not.toHaveBeenCalled();
      expect(outputs).toHaveLength(0);
      if (kind === "abort") abort.abort();
      else
        workers[0]!.send({
          type: "fault",
          faultKind: "unsupported",
          message: "Worker AudioData is unavailable.",
        });
      await expect(pending).rejects.toMatchObject(
        kind === "abort" ? { name: "AbortError" } : { faultKind: "unsupported" },
      );
      workers[0]!.send({ type: "prepared" });
      workers[0]!.send({ type: "stopped" });
      expect(source.clone).not.toHaveBeenCalled();
      expect(source.readyState).toBe("live");
    },
  );

  it("requires usable-output readiness and bounds startup/cancellation", async () => {
    autoReady = false;
    vi.useFakeTimers();
    const source = new Track();
    const result = createRawAudioNoiseProcessor(source, "standard", { startupTimeoutMs: 10 });
    const rejection = expect(result).rejects.toThrow("usable output");
    await vi.advanceTimersByTimeAsync(11);
    await rejection;
    workers[0]!.send({ type: "ready" });
    await vi.advanceTimersByTimeAsync(151);
    expect(outputs[0]!.readyState).toBe("ended");
    expect(workers[0]!.terminate).toHaveBeenCalledTimes(1);
  });
});
