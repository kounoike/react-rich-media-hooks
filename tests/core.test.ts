import { afterEach, describe, expect, it, vi } from "vitest";
import { createMediaSession, type MediaDeviceSnapshot } from "../src/core/index.js";

class FakeTrack extends EventTarget implements MediaStreamTrack {
  readonly kind: "video" | "audio";
  readonly deviceId: string;
  readonly id: string;
  readonly label: string;
  readonly muted = false;
  contentHint = "";
  enabled = true;
  onended: ((this: MediaStreamTrack, ev: Event) => unknown) | null = null;
  onmute: ((this: MediaStreamTrack, ev: Event) => unknown) | null = null;
  onunmute: ((this: MediaStreamTrack, ev: Event) => unknown) | null = null;
  stopCount = 0;
  readyState: MediaStreamTrackState = "live";

  constructor(kind: "video" | "audio", deviceId: string) {
    super();
    this.kind = kind;
    this.deviceId = deviceId;
    this.id = deviceId;
    this.label = deviceId;
  }

  applyConstraints(): Promise<void> {
    return Promise.resolve();
  }

  getSettings(): MediaTrackSettings {
    return { deviceId: this.deviceId };
  }

  clone(): MediaStreamTrack {
    return new FakeTrack(this.kind, `${this.deviceId}-clone`);
  }

  getCapabilities(): MediaTrackCapabilities {
    return {};
  }

  getConstraints(): MediaTrackConstraints {
    return {};
  }

  stop(): void {
    this.stopCount += 1;
    this.readyState = "ended";
  }
}

class FakeStream extends EventTarget implements MediaStream {
  readonly id = "fake-stream";
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

const stream = (...tracks: FakeTrack[]): MediaStream => new FakeStream([...tracks]);

const device = (
  kind: MediaDeviceInfo["kind"],
  deviceId: string,
  label: string,
  groupId = "group",
): MediaDeviceInfo => ({
  deviceId,
  groupId,
  kind,
  label,
  toJSON: () => ({}),
});

const installBrowser = (mediaDevices: FakeMediaDevices): void => {
  vi.stubGlobal("window", { isSecureContext: true });
  vi.stubGlobal("document", { visibilityState: "visible" });
  vi.stubGlobal("navigator", { mediaDevices });
};

class FakeMediaDevices extends EventTarget {
  readonly getUserMedia = vi.fn<(constraints: MediaStreamConstraints) => Promise<MediaStream>>();
  readonly enumerateDevices = vi.fn<() => Promise<MediaDeviceInfo[]>>();
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("createMediaSession", () => {
  it("starts with an SSR-safe server snapshot", () => {
    const session = createMediaSession();

    expect(session.getServerSnapshot()).toMatchObject({
      phase: "idle",
      availability: "unavailable",
      outputs: { video: null, audio: null },
    });
  });

  it("reports unsupported capture without touching browser globals", async () => {
    const session = createMediaSession();
    const result = await session.start();

    expect(result.status).toBe("unsupported");
    if (result.status !== "unsupported") return;
    expect(result.error).toMatchObject({
      code: "unsupported",
      operation: "start",
      retryable: false,
    });
    expect(session.getOutput("video")).toBeNull();
  });

  it("discovers devices, captures, switches, observes tracks, and releases output clones", async () => {
    const mediaDevices = new FakeMediaDevices();
    const cameraA = new FakeTrack("video", "camera-a");
    const microphoneA = new FakeTrack("audio", "microphone-a");
    const cameraB = new FakeTrack("video", "camera-b");
    mediaDevices.getUserMedia
      .mockResolvedValueOnce(stream(cameraA, microphoneA))
      .mockResolvedValueOnce(stream(cameraB));
    mediaDevices.enumerateDevices.mockResolvedValue([
      device("videoinput", "camera-a", "Front camera"),
      device("audioinput", "microphone-a", "Headset microphone"),
      device("videoinput", "", ""),
    ]);
    installBrowser(mediaDevices);
    const session = createMediaSession({ capture: { video: true, audio: true } });

    const discovered = await session.refreshDevices();
    expect(discovered.status).toBe("success");
    expect(discovered.partial).toBe(true);
    expect(session.getDevices("video")).toEqual([
      expect.objectContaining<Partial<MediaDeviceSnapshot>>({
        deviceId: "camera-a",
        label: "Front camera",
        labelState: "available",
      }),
      expect.objectContaining<Partial<MediaDeviceSnapshot>>({
        deviceId: "",
        label: "Camera 2",
        labelState: "redacted",
      }),
    ]);

    const started = await session.start();
    expect(started.status).toBe("success");
    const firstOutput = session.getOutput("video");
    expect(firstOutput).not.toBeNull();
    expect(session.getSnapshot()).toMatchObject({
      phase: "active",
      activity: { video: "live", audio: "live" },
      selectedDevices: { video: "camera-a", audio: "microphone-a" },
    });
    if (firstOutput === null) return;
    const clone = firstOutput.clone();
    expect(clone.ownership).toBe("application-owned-clone");
    expect(clone.track).not.toBe(firstOutput.track);
    clone.track.stop();
    expect(cameraA.stopCount).toBe(0);

    const switched = await session.switchDevice("video", { deviceId: "camera-b" });
    expect(switched.status).toBe("success");
    expect(mediaDevices.getUserMedia).toHaveBeenLastCalledWith({
      video: { deviceId: { exact: "camera-b" } },
      audio: false,
    });
    expect(cameraA.stopCount).toBe(1);
    expect(session.getOutput("video")?.id).not.toBe(firstOutput.id);
    expect(session.getSnapshot().selectedDevices.video).toBe("camera-b");

    cameraB.dispatchEvent(new Event("mute"));
    expect(session.getSnapshot().activity.video).toBe("muted");
    cameraB.dispatchEvent(new Event("ended"));
    expect(session.getSnapshot()).toMatchObject({
      activity: { video: "ended", audio: "live" },
      availability: "unavailable",
      error: { code: "device-ended", kind: "video" },
      outputs: { video: null },
    });

    await session.stop();
    expect(microphoneA.stopCount).toBe(1);
    expect(session.getSnapshot().phase).toBe("idle");
    await session.dispose();
    expect(session.getSnapshot().phase).toBe("disposed");
  });

  it("falls back from a stale remembered device preference", async () => {
    const mediaDevices = new FakeMediaDevices();
    const fallbackTrack = new FakeTrack("video", "camera-default");
    mediaDevices.getUserMedia
      .mockRejectedValueOnce(Object.assign(new Error("missing"), { name: "NotFoundError" }))
      .mockResolvedValueOnce(stream(fallbackTrack));
    installBrowser(mediaDevices);
    const session = createMediaSession({
      capture: { video: { deviceId: "remembered-camera" } },
    });

    const result = await session.start();

    expect(result.status).toBe("success");
    expect(mediaDevices.getUserMedia).toHaveBeenNthCalledWith(1, {
      video: { deviceId: "remembered-camera" },
    });
    expect(mediaDevices.getUserMedia).toHaveBeenNthCalledWith(2, { video: {} });
    expect(session.getSnapshot().selectedDevices.video).toBe("camera-default");
  });

  it("disposes stale overlapping results and supports logical cancellation", async () => {
    const mediaDevices = new FakeMediaDevices();
    const pending: Array<(value: MediaStream) => void> = [];
    mediaDevices.getUserMedia.mockImplementation(
      () => new Promise<MediaStream>((resolve) => pending.push(resolve)),
    );
    installBrowser(mediaDevices);
    const session = createMediaSession({ capture: { video: true } });

    const first = session.start();
    const second = session.start();
    const firstTrack = new FakeTrack("video", "stale");
    pending[0]!(stream(firstTrack));
    await expect(first).resolves.toMatchObject({ status: "superseded" });
    expect(firstTrack.stopCount).toBe(1);

    const secondTrack = new FakeTrack("video", "current");
    pending[1]!(stream(secondTrack));
    await expect(second).resolves.toMatchObject({ status: "success" });

    const controller = new AbortController();
    const switching = session.switchDevice(
      "video",
      { deviceId: "next" },
      { signal: controller.signal },
    );
    controller.abort();
    const lateTrack = new FakeTrack("video", "late");
    pending[2]!(stream(lateTrack));
    await expect(switching).resolves.toMatchObject({ status: "cancelled" });
    expect(lateTrack.stopCount).toBe(1);
    expect(secondTrack.stopCount).toBe(0);
    expect(session.getOutput("video")?.track).toBe(secondTrack);
  });

  it("normalizes permission failures and retains healthy output on a failed switch", async () => {
    const mediaDevices = new FakeMediaDevices();
    const currentTrack = new FakeTrack("video", "current");
    mediaDevices.getUserMedia
      .mockResolvedValueOnce(stream(currentTrack))
      .mockRejectedValueOnce(Object.assign(new Error("denied"), { name: "NotAllowedError" }));
    installBrowser(mediaDevices);
    const session = createMediaSession({ capture: { video: true } });

    await expect(session.start()).resolves.toMatchObject({ status: "success" });
    const result = await session.switchDevice("video", { deviceId: "blocked" });

    expect(result).toMatchObject({
      status: "failed",
      error: {
        code: "permission-denied",
        browserName: "NotAllowedError",
        retryable: false,
      },
    });
    expect(session.getSnapshot()).toMatchObject({
      phase: "active",
      outputs: { video: { ownership: "session-owned" } },
    });
    expect(currentTrack.stopCount).toBe(0);
  });

  it("refreshes devices after a devicechange event and clears listeners on stop", async () => {
    const mediaDevices = new FakeMediaDevices();
    const track = new FakeTrack("video", "camera-a");
    mediaDevices.getUserMedia.mockResolvedValue(stream(track));
    mediaDevices.enumerateDevices
      .mockResolvedValueOnce([device("videoinput", "camera-a", "A")])
      .mockResolvedValueOnce([device("videoinput", "camera-b", "B")]);
    installBrowser(mediaDevices);
    const session = createMediaSession({ capture: { video: true } });

    await session.start();
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    mediaDevices.dispatchEvent(new Event("devicechange"));
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    expect(session.getDevices("video")[0]?.deviceId).toBe("camera-b");

    await session.stop();
    mediaDevices.enumerateDevices.mockResolvedValue([device("videoinput", "camera-c", "C")]);
    mediaDevices.dispatchEvent(new Event("devicechange"));
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    expect(session.getDevices("video")[0]?.deviceId).toBe("camera-b");
  });

  it("notifies subscribers and clears them on disposal", async () => {
    const session = createMediaSession();
    let notifications = 0;
    const unsubscribe = session.subscribe(() => {
      notifications += 1;
    });

    await session.dispose();
    unsubscribe();

    expect(notifications).toBe(2);
    expect(session.getSnapshot().phase).toBe("disposed");
  });
});
