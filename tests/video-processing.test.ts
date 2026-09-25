import { afterEach, describe, expect, it, vi } from "vitest";
import type { CropOptions } from "../src/effects/video/index.js";
import type { VideoCropProcessor } from "../src/effects/video/runtime.js";

interface RuntimeFault {
  readonly faultKind: "unsupported" | "failed" | "overload";
  readonly message: string;
}

interface RuntimeProcessorOptions {
  readonly signal?: AbortSignal;
  readonly onFault?: (fault: RuntimeFault) => void;
}

type RuntimeFactory = (
  track: MediaStreamTrack,
  options: CropOptions,
  processorOptions?: RuntimeProcessorOptions,
) => Promise<VideoCropProcessor>;

const createCanvasCropProcessorMock = vi.hoisted(() => vi.fn<RuntimeFactory>());

vi.mock("../src/effects/video/runtime.js", () => ({
  createCanvasCropProcessor: createCanvasCropProcessorMock,
}));

import { createMediaSession } from "../src/core/index.js";
import { crop } from "../src/effects/video/index.js";

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
    return { deviceId: this.id, frameRate: 30, width: 1280, height: 720 };
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
  readonly id = "video-processing-stream";
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

const createProcessor = (track: FakeTrack) => {
  let disposed = false;
  return {
    track,
    update: vi.fn(() => track),
    dispose: vi.fn(() => {
      if (disposed) return;
      disposed = true;
      if (track.readyState !== "ended") track.stop();
    }),
  };
};

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
  createCanvasCropProcessorMock.mockReset();
});

describe("session-owned video crop processing", () => {
  it("adds, updates, bypasses, and removes a crop without reacquiring camera or audio", async () => {
    const { camera, mediaDevices, microphone, session } = setupSession();
    const processedTrack = new FakeTrack("video", "cropped-camera-a");
    const processor = createProcessor(processedTrack);
    createCanvasCropProcessorMock.mockResolvedValue(processor);

    await expect(session.start()).resolves.toMatchObject({ status: "success" });
    const originalVideo = session.getOutput("video");
    const originalAudio = session.getOutput("audio");
    const firstRegion = { x: 0.125, y: 0, width: 0.75, height: 1 };
    const added = await session.setVideoEffects({ effects: [crop({ region: firstRegion })] });

    expect(added.status).toBe("success");
    expect(createCanvasCropProcessorMock).toHaveBeenCalledTimes(1);
    expect(createCanvasCropProcessorMock.mock.calls[0]?.[0]).toBe(camera);
    expect(createCanvasCropProcessorMock.mock.calls[0]?.[1]).toEqual({ region: firstRegion });
    expect(session.getOutput("video")?.track).toBe(processedTrack);
    expect(session.getOutput("audio")?.track).toBe(originalAudio?.track);
    expect(session.getSnapshot().processors.video).toMatchObject({
      status: "active",
      effects: ["crop"],
    });
    expect(camera.stopCount).toBe(0);
    expect(microphone.stopCount).toBe(0);

    const updatedRegion = { x: 0.25, y: 0, width: 0.5, height: 1 };
    const updated = await session.setVideoEffects({ effects: [crop({ region: updatedRegion })] });
    expect(updated.status).toBe("success");
    expect(processor.update).toHaveBeenCalledWith({ region: updatedRegion });
    expect(session.getOutput("video")?.track).toBe(processedTrack);
    expect(mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
    expect(session.getOutput("audio")?.track).toBe(originalAudio?.track);

    const bypassed = await session.setVideoEffects({
      effects: [crop({ region: updatedRegion })],
      bypass: true,
    });
    expect(bypassed.status).toBe("success");
    expect(session.getOutput("video")?.track).toBe(camera);
    expect(session.getSnapshot().processors.video).toMatchObject({
      status: "bypassed",
      effects: ["crop"],
    });
    expect(processor.dispose).toHaveBeenCalledTimes(1);
    expect(processedTrack.stopCount).toBe(1);

    const removed = await session.setVideoEffects({ effects: [] });
    expect(removed.status).toBe("success");
    expect(session.getOutput("video")?.track).toBe(camera);
    expect(session.getSnapshot().processors.video).toMatchObject({ status: "off", effects: [] });
    expect(mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
    expect(session.getOutput("audio")?.track).toBe(originalAudio?.track);

    await session.stop();
    expect(camera.stopCount).toBe(1);
    expect(microphone.stopCount).toBe(1);
    await session.dispose();
    expect(originalVideo?.track).toBe(camera);
  });

  it("restores the original video and reports a processor failure", async () => {
    const { camera, mediaDevices, session } = setupSession();
    createCanvasCropProcessorMock.mockRejectedValue(
      Object.assign(new Error("draw failed"), { faultKind: "failed" }),
    );

    await session.start();
    const result = await session.setVideoEffects({ effects: [crop()] });

    expect(result).toMatchObject({
      status: "failed",
      error: { code: "processor-failed", kind: "video", operation: "processor" },
    });
    expect(session.getOutput("video")?.track).toBe(camera);
    expect(session.getSnapshot()).toMatchObject({
      phase: "active",
      processors: { video: { status: "failed", effects: ["crop"] } },
      error: { code: "processor-failed" },
    });
    expect(mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
    await session.dispose();
  });

  it("replaces a resized crop output without reacquiring its camera", async () => {
    const { mediaDevices, session } = setupSession();
    const firstOutput = new FakeTrack("video", "cropped-camera-a-960");
    const resizedOutput = new FakeTrack("video", "cropped-camera-a-640");
    let activeOutput = firstOutput;
    const processor: VideoCropProcessor = {
      get track() {
        return activeOutput;
      },
      update: vi.fn(() => {
        firstOutput.stop();
        activeOutput = resizedOutput;
        return resizedOutput;
      }),
      dispose: vi.fn(() => activeOutput.stop()),
    };
    createCanvasCropProcessorMock.mockResolvedValue(processor);

    await session.start();
    await session.setVideoEffects({
      effects: [crop({ region: { x: 0.125, y: 0, width: 0.75, height: 1 } })],
    });
    const firstOutputId = session.getOutput("video")?.id;
    const updated = await session.setVideoEffects({
      effects: [crop({ region: { x: 0.25, y: 0, width: 0.5, height: 1 } })],
    });

    expect(updated.status).toBe("success");
    expect(session.getOutput("video")?.track).toBe(resizedOutput);
    expect(session.getOutput("video")?.id).not.toBe(firstOutputId);
    expect(firstOutput.readyState).toBe("ended");
    expect(resizedOutput.readyState).toBe("live");
    expect(mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
    await session.dispose();
    expect(resizedOutput.readyState).toBe("ended");
  });

  it("cancels a pending crop setup and disposes any late processor", async () => {
    const { camera, session } = setupSession();
    let resolveProcessor: ((value: ReturnType<typeof createProcessor>) => void) | undefined;
    createCanvasCropProcessorMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveProcessor = resolve;
        }),
    );

    await session.start();
    const controller = new AbortController();
    const pending = session.setVideoEffects({ effects: [crop()] }, { signal: controller.signal });
    await vi.waitFor(() => expect(createCanvasCropProcessorMock).toHaveBeenCalledTimes(1));
    controller.abort();
    const processedTrack = new FakeTrack("video", "late-crop");
    const processor = createProcessor(processedTrack);
    resolveProcessor?.(processor);

    await expect(pending).resolves.toMatchObject({ status: "cancelled" });
    expect(processor.dispose).toHaveBeenCalledTimes(1);
    expect(processedTrack.stopCount).toBe(1);
    expect(session.getOutput("video")?.track).toBe(camera);
    expect(session.getSnapshot().processors.video).toMatchObject({ status: "off", effects: [] });
    await session.dispose();
  });

  it("falls back to camera output and marks sustained overload as degraded", async () => {
    const { camera, session } = setupSession();
    const processedTrack = new FakeTrack("video", "overloaded-crop");
    const processor = createProcessor(processedTrack);
    createCanvasCropProcessorMock.mockResolvedValue(processor);

    await session.start();
    await session.setVideoEffects({ effects: [crop()] });
    const onFault = createCanvasCropProcessorMock.mock.calls[0]?.[2]?.onFault;
    expect(onFault).toBeDefined();
    onFault?.({ faultKind: "overload", message: "The crop fell below the frame budget." });

    expect(session.getOutput("video")?.track).toBe(camera);
    expect(session.getSnapshot()).toMatchObject({
      processors: { video: { status: "degraded", effects: ["crop"] } },
      error: { code: "processor-failed", message: "The crop fell below the frame budget." },
    });
    expect(processor.dispose).toHaveBeenCalledTimes(1);
    expect(processedTrack.stopCount).toBe(1);
    await session.dispose();
  });

  it("keeps an unimplemented effect explicitly unsupported with original-video fallback", async () => {
    const { camera, session } = setupSession();
    await session.start();

    const result = await session.setVideoEffects({
      effects: [{ kind: "background-blur", options: {} }],
    });

    expect(result).toMatchObject({ status: "unsupported", error: { code: "unsupported" } });
    expect(session.getOutput("video")?.track).toBe(camera);
    expect(session.getSnapshot().processors.video).toMatchObject({
      status: "unsupported",
      effects: ["background-blur"],
    });
    await session.dispose();
  });
});
