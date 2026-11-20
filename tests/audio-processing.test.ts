import { afterEach, describe, expect, it, vi } from "vitest";
import type { AudioNoiseProcessor } from "../src/effects/audio/runtime.js";

interface RuntimeFault {
  readonly faultKind: "unsupported" | "failed" | "overload";
  readonly message: string;
}

interface RuntimeOptions {
  readonly signal?: AbortSignal;
  readonly onFault?: (fault: RuntimeFault) => void;
}

type RuntimeFactory = (
  track: MediaStreamTrack,
  level: "light" | "standard" | "strong",
  options?: RuntimeOptions,
) => Promise<AudioNoiseProcessor>;

const createAudioNoiseProcessorMock = vi.hoisted(() => vi.fn<RuntimeFactory>());

vi.mock("../src/effects/audio/runtime.js", () => ({
  createAudioNoiseProcessor: createAudioNoiseProcessorMock,
}));

import { createMediaSession } from "../src/core/index.js";
import { noiseReduction } from "../src/effects/audio/index.js";

class FakeTrack extends EventTarget implements MediaStreamTrack {
  readonly id: string;
  readonly label: string;
  readonly muted = false;
  readonly kind: "video" | "audio";
  enabled = true;
  contentHint = "";
  onended: ((this: MediaStreamTrack, ev: Event) => unknown) | null = null;
  onmute: ((this: MediaStreamTrack, ev: Event) => unknown) | null = null;
  onunmute: ((this: MediaStreamTrack, ev: Event) => unknown) | null = null;
  readyState: MediaStreamTrackState = "live";
  stopCount = 0;

  constructor(kind: "video" | "audio", id: string) {
    super();
    this.kind = kind;
    this.id = id;
    this.label = id;
  }

  applyConstraints(): Promise<void> {
    return Promise.resolve();
  }

  getCapabilities(): MediaTrackCapabilities {
    return {};
  }

  getConstraints(): MediaTrackConstraints {
    return {};
  }

  getSettings(): MediaTrackSettings {
    return { deviceId: this.id, sampleRate: 48_000, channelCount: 1 };
  }

  clone(): MediaStreamTrack {
    return new FakeTrack(this.kind, `${this.id}-clone`);
  }

  stop(): void {
    this.stopCount += 1;
    this.readyState = "ended";
  }
}

class FakeStream extends EventTarget implements MediaStream {
  readonly id = "audio-processing-stream";
  onaddtrack: ((this: MediaStream, ev: MediaStreamTrackEvent) => unknown) | null = null;
  onremovetrack: ((this: MediaStream, ev: MediaStreamTrackEvent) => unknown) | null = null;

  constructor(private readonly tracks: MediaStreamTrack[]) {
    super();
  }

  get active(): boolean {
    return this.tracks.some((track) => track.readyState === "live");
  }

  addTrack(track: MediaStreamTrack): void {
    this.tracks.push(track);
  }

  clone(): MediaStream {
    return new FakeStream(this.tracks.map((track) => track.clone()));
  }

  getAudioTracks(): MediaStreamTrack[] {
    return this.tracks.filter((track) => track.kind === "audio");
  }

  getTrackById(trackId: string): MediaStreamTrack | null {
    return this.tracks.find((track) => track.id === trackId) ?? null;
  }

  getTracks(): MediaStreamTrack[] {
    return [...this.tracks];
  }

  getVideoTracks(): MediaStreamTrack[] {
    return this.tracks.filter((track) => track.kind === "video");
  }

  removeTrack(track: MediaStreamTrack): void {
    const index = this.tracks.indexOf(track);
    if (index >= 0) this.tracks.splice(index, 1);
  }
}

class FakeMediaDevices extends EventTarget {
  readonly getUserMedia = vi.fn<(constraints: MediaStreamConstraints) => Promise<MediaStream>>();
  readonly enumerateDevices = vi.fn<() => Promise<MediaDeviceInfo[]>>();
}

const installBrowser = (mediaDevices: FakeMediaDevices): void => {
  vi.stubGlobal("window", { isSecureContext: true });
  vi.stubGlobal("document", { visibilityState: "visible" });
  vi.stubGlobal("navigator", { mediaDevices });
  vi.stubGlobal("MediaStream", FakeStream);
};

const createProcessor = (track: FakeTrack) => ({
  track,
  update: vi.fn(),
  getMetrics: vi.fn(() => ({
    frames: 0,
    p50FrameProcessingMs: 0,
    p95FrameProcessingMs: 0,
    maxFrameProcessingMs: 0,
  })),
  dispose: vi.fn(() => {
    if (track.readyState !== "ended") track.stop();
  }),
});

const setupSession = () => {
  const mediaDevices = new FakeMediaDevices();
  const camera = new FakeTrack("video", "camera-a");
  const microphone = new FakeTrack("audio", "microphone-a");
  mediaDevices.getUserMedia.mockResolvedValue(new FakeStream([camera, microphone]));
  mediaDevices.enumerateDevices.mockResolvedValue([]);
  installBrowser(mediaDevices);
  return {
    camera,
    mediaDevices,
    microphone,
    session: createMediaSession({ capture: { video: true, audio: true } }),
  };
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  createAudioNoiseProcessorMock.mockReset();
});

describe("session-owned audio noise reduction", () => {
  it("adds, updates, bypasses, and removes noise reduction without reacquiring capture", async () => {
    const { camera, mediaDevices, microphone, session } = setupSession();
    const processedTrack = new FakeTrack("audio", "filtered-microphone-a");
    const processor = createProcessor(processedTrack);
    createAudioNoiseProcessorMock.mockResolvedValue(processor);

    await expect(session.start()).resolves.toMatchObject({ status: "success" });
    const originalAudio = session.getOutput("audio");
    const originalVideo = session.getOutput("video");
    const clone = originalAudio?.clone();
    const added = await session.setAudioEffects({ effects: [noiseReduction()] });

    expect(added.status).toBe("success");
    expect(createAudioNoiseProcessorMock).toHaveBeenCalledTimes(1);
    expect(createAudioNoiseProcessorMock.mock.calls[0]?.[0]).toBe(microphone);
    expect(createAudioNoiseProcessorMock.mock.calls[0]?.[1]).toBe("standard");
    expect(session.getOutput("audio")?.track).toBe(processedTrack);
    expect(session.getSnapshot().processors.audio).toMatchObject({
      status: "active",
      effects: ["noise-reduction"],
    });
    const transformedClone = session.getOutput("audio")?.clone();
    expect(transformedClone?.track).not.toBe(processedTrack);
    transformedClone?.track.stop();
    expect(processedTrack.readyState).toBe("live");
    const retainedTransformedClone = session.getOutput("audio")?.clone();
    expect(camera.stopCount).toBe(0);
    expect(microphone.stopCount).toBe(0);
    expect(clone?.ownership).toBe("application-owned-clone");
    expect(clone?.track).not.toBe(microphone);

    const updated = await session.setAudioEffects({
      effects: [noiseReduction({ level: "strong" })],
    });
    expect(updated.status).toBe("success");
    expect(processor.update).toHaveBeenCalledWith("strong");
    expect(session.getOutput("audio")?.track).toBe(processedTrack);
    expect(mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
    expect(session.getOutput("video")?.track).toBe(originalVideo?.track);

    const bypassed = await session.setAudioEffects({
      effects: [noiseReduction({ level: "strong" })],
      bypass: true,
    });
    expect(bypassed.status).toBe("success");
    expect(session.getOutput("audio")?.track).toBe(microphone);
    expect(session.getSnapshot().processors.audio).toMatchObject({
      status: "bypassed",
      effects: ["noise-reduction"],
    });
    expect(processor.dispose).toHaveBeenCalledTimes(1);
    expect(processedTrack.stopCount).toBe(1);

    const removed = await session.setAudioEffects({ effects: [] });
    expect(removed.status).toBe("success");
    expect(session.getOutput("audio")?.track).toBe(microphone);
    expect(session.getSnapshot().processors.audio).toMatchObject({ status: "off", effects: [] });
    expect(mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
    expect(session.getOutput("video")?.track).toBe(originalVideo?.track);

    await session.dispose();
    expect(microphone.stopCount).toBe(1);
    expect(camera.stopCount).toBe(1);
    expect(clone?.track.readyState).toBe("live");
    expect(retainedTransformedClone?.track.readyState).toBe("live");
    retainedTransformedClone?.track.stop();
    clone?.track.stop();
  });

  it("keeps configured effects until capture starts, then processes the existing microphone", async () => {
    const mediaDevices = new FakeMediaDevices();
    const microphone = new FakeTrack("audio", "microphone-a");
    mediaDevices.getUserMedia.mockResolvedValue(new FakeStream([microphone]));
    mediaDevices.enumerateDevices.mockResolvedValue([]);
    installBrowser(mediaDevices);
    const processor = createProcessor(new FakeTrack("audio", "filtered-microphone-a"));
    createAudioNoiseProcessorMock.mockResolvedValue(processor);
    const session = createMediaSession({
      capture: { audio: true },
      audio: { effects: [noiseReduction({ level: "light" })] },
    });

    await expect(session.start()).resolves.toMatchObject({ status: "success" });
    await vi.waitFor(() => expect(session.getSnapshot().processors.audio.status).toBe("active"));

    expect(createAudioNoiseProcessorMock).toHaveBeenCalledWith(
      microphone,
      "light",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
    await session.dispose();
  });

  it("restores the original microphone when setup fails or an effect is unsupported", async () => {
    const { mediaDevices, microphone, session } = setupSession();
    await session.start();
    createAudioNoiseProcessorMock.mockRejectedValue(
      Object.assign(new Error("worklet load failed"), { faultKind: "failed" }),
    );

    const failed = await session.setAudioEffects({ effects: [noiseReduction()] });
    expect(failed).toMatchObject({
      status: "failed",
      error: { code: "processor-failed", kind: "audio", operation: "processor" },
    });
    expect(session.getOutput("audio")?.track).toBe(microphone);
    expect(session.getSnapshot().processors.audio.status).toBe("failed");

    const unsupported = await session.setAudioEffects({
      effects: [{ kind: "echo-cancellation", options: {} }],
    });
    expect(unsupported).toMatchObject({ status: "unsupported", error: { code: "unsupported" } });
    expect(session.getOutput("audio")?.track).toBe(microphone);
    expect(mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
    expect(createAudioNoiseProcessorMock).toHaveBeenCalledTimes(1);
    await session.dispose();
  });

  it("bypasses on sustained processor overload and owns processor cleanup", async () => {
    const { microphone, session } = setupSession();
    const processedTrack = new FakeTrack("audio", "filtered-microphone-a");
    const processor = createProcessor(processedTrack);
    createAudioNoiseProcessorMock.mockResolvedValue(processor);
    await session.start();
    await session.setAudioEffects({ effects: [noiseReduction()] });
    const onFault = createAudioNoiseProcessorMock.mock.calls[0]?.[2]?.onFault;
    expect(onFault).toBeDefined();

    onFault?.({ faultKind: "overload", message: "RNNoise missed the frame budget." });

    expect(session.getOutput("audio")?.track).toBe(microphone);
    expect(session.getSnapshot()).toMatchObject({
      processors: { audio: { status: "degraded", effects: ["noise-reduction"] } },
      error: {
        code: "processor-failed",
        kind: "audio",
        message: "RNNoise missed the frame budget.",
      },
    });
    expect(processor.dispose).toHaveBeenCalledTimes(1);
    expect(processedTrack.stopCount).toBe(1);
    await session.dispose();
  });

  it("cancels setup and disposes a late processor without stopping the microphone", async () => {
    const { microphone, session } = setupSession();
    let resolveProcessor: ((processor: AudioNoiseProcessor) => void) | undefined;
    createAudioNoiseProcessorMock.mockImplementation(
      () => new Promise<AudioNoiseProcessor>((resolve) => (resolveProcessor = resolve)),
    );
    await session.start();
    const controller = new AbortController();
    const pending = session.setAudioEffects(
      { effects: [noiseReduction()] },
      { signal: controller.signal },
    );
    await vi.waitFor(() => expect(createAudioNoiseProcessorMock).toHaveBeenCalledTimes(1));
    controller.abort();
    const processedTrack = new FakeTrack("audio", "late-filtered-microphone");
    const processor = createProcessor(processedTrack);
    resolveProcessor?.(processor);

    await expect(pending).resolves.toMatchObject({ status: "cancelled" });
    expect(processor.dispose).toHaveBeenCalledTimes(1);
    expect(processedTrack.stopCount).toBe(1);
    expect(session.getOutput("audio")?.track).toBe(microphone);
    expect(microphone.stopCount).toBe(0);
    await session.dispose();
  });

  it("reports device end and releases an active processor", async () => {
    const { microphone, session } = setupSession();
    const processor = createProcessor(new FakeTrack("audio", "filtered-microphone-a"));
    createAudioNoiseProcessorMock.mockResolvedValue(processor);
    await session.start();
    await session.setAudioEffects({ effects: [noiseReduction()] });

    microphone.dispatchEvent(new Event("ended"));

    expect(processor.dispose).toHaveBeenCalledTimes(1);
    expect(session.getOutput("audio")).toBeNull();
    expect(session.getSnapshot()).toMatchObject({
      activity: { audio: "ended" },
      processors: { audio: { status: "failed", effects: ["noise-reduction"] } },
      error: { code: "device-ended", kind: "audio" },
    });
    await session.dispose();
  });
  it("releases the active graph on invalid options and can retry with a fresh output", async () => {
    const { microphone, session } = setupSession();
    const first = createProcessor(new FakeTrack("audio", "first-filtered"));
    const second = createProcessor(new FakeTrack("audio", "second-filtered"));
    createAudioNoiseProcessorMock.mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    await session.start();
    await session.setAudioEffects({ effects: [noiseReduction()] });
    const invalid = await session.setAudioEffects({
      effects: [{ kind: "noise-reduction", options: { level: "invalid" } }],
    });
    expect(invalid).toMatchObject({ status: "failed", error: { code: "constraint-invalid" } });
    expect(first.dispose).toHaveBeenCalledTimes(1);
    expect(session.getOutput("audio")?.track).toBe(microphone);
    await session.setAudioEffects({ effects: [noiseReduction()] });
    expect(session.getOutput("audio")?.track).toBe(second.track);
    expect(createAudioNoiseProcessorMock).toHaveBeenCalledTimes(2);
    await session.dispose();
  });

  it.each(["remove", "stop", "dispose"])(
    "rejects a stale setup after %s without publishing its track",
    async (action) => {
      const { microphone, session } = setupSession();
      let finish: ((processor: AudioNoiseProcessor) => void) | undefined;
      createAudioNoiseProcessorMock.mockImplementation(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      );
      await session.start();
      const pending = session.setAudioEffects({ effects: [noiseReduction()] });
      await vi.waitFor(() => expect(finish).toBeDefined());
      if (action === "remove") await session.setAudioEffects({ effects: [] });
      else if (action === "stop") await session.stop();
      else await session.dispose();
      const late = createProcessor(new FakeTrack("audio", "late-filtered"));
      finish?.(late);
      await expect(pending).resolves.toMatchObject({ status: "superseded" });
      expect(late.dispose).toHaveBeenCalledTimes(1);
      expect(session.getOutput("audio")?.track).not.toBe(late.track);
      if (action === "remove") expect(session.getOutput("audio")?.track).toBe(microphone);
      await session.dispose();
    },
  );
  it("restores the settled state when a replacement setup is itself cancelled", async () => {
    const { microphone, session } = setupSession();
    const finishes: ((processor: AudioNoiseProcessor) => void)[] = [];
    createAudioNoiseProcessorMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishes.push(resolve);
        }),
    );
    await session.start();
    const first = session.setAudioEffects({ effects: [noiseReduction()] });
    await vi.waitFor(() => expect(finishes).toHaveLength(1));
    const controller = new AbortController();
    const second = session.setAudioEffects(
      { effects: [noiseReduction({ level: "strong" })] },
      { signal: controller.signal },
    );
    await vi.waitFor(() => expect(finishes).toHaveLength(2));
    controller.abort();
    finishes[1]!(createProcessor(new FakeTrack("audio", "second-stale")));
    await expect(second).resolves.toMatchObject({ status: "cancelled" });
    finishes[0]!(createProcessor(new FakeTrack("audio", "first-stale")));
    await expect(first).resolves.toMatchObject({ status: "superseded" });
    expect(session.getSnapshot().processors.audio.status).toBe("off");
    expect(session.getOutput("audio")?.track).toBe(microphone);
    await session.dispose();
  });
});
