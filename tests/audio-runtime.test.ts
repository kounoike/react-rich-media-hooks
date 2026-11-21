import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AudioDenoiserBackend } from "../src/effects/audio/backend.js";
import { createWorkletAudioNoiseProcessor } from "../src/effects/audio/runtime.js";

const backend: AudioDenoiserBackend = {
  id: "test-denoiser",
  label: "Test denoiser",
  workletUrl: "/test-denoiser.js",
  processorName: "test-denoiser",
  contextSampleRate: 16_000,
  channelCount: 2,
};

class TestTrack extends EventTarget implements MediaStreamTrack {
  readonly id = "test-audio-track";
  readonly label = "Test audio";
  readonly kind = "audio";
  readonly muted = false;
  readyState: MediaStreamTrackState = "live";
  enabled = true;
  contentHint = "";
  onended = null;
  onmute = null;
  onunmute = null;
  readonly applyConstraints = () => Promise.resolve();
  readonly getCapabilities = () => ({});
  readonly getConstraints = () => ({});
  readonly getSettings = () => ({});
  readonly clone = (): MediaStreamTrack => new TestTrack();
  readonly stop = vi.fn(() => {
    this.readyState = "ended";
  });
}

const createTrack = () => new TestTrack();

class TestNode extends EventTarget {
  readonly connect = vi.fn();
  readonly disconnect = vi.fn();
}

class TestPort extends EventTarget {
  readonly postMessage = vi.fn();
  readonly start = vi.fn();
  readonly close = vi.fn();

  send(data: unknown): void {
    this.dispatchEvent(new MessageEvent("message", { data }));
  }
}

const contexts: TestContext[] = [];
const worklets: TestWorklet[] = [];
let resume: () => Promise<void>;
let loadModule: (url: string) => Promise<void>;

class TestContext extends EventTarget {
  readonly source = new TestNode();
  readonly output = createTrack();
  readonly destination = Object.assign(new TestNode(), {
    channelCount: 2,
    stream: { getAudioTracks: () => [this.output] },
  });
  readonly sampleRate: number;
  state = "suspended";
  readonly audioWorklet = { addModule: vi.fn((url: string) => loadModule(url)) };
  readonly resume = vi.fn(() => resume());
  readonly close = vi.fn(() => {
    this.state = "closed";
    return Promise.resolve();
  });
  readonly createMediaStreamSource = vi.fn(() => this.source);
  readonly createMediaStreamDestination = vi.fn(() => this.destination);

  constructor(readonly options: AudioContextOptions) {
    super();
    this.sampleRate = options.sampleRate!;
    contexts.push(this);
  }
}

class TestWorklet extends TestNode {
  readonly port = new TestPort();

  constructor(
    readonly context: TestContext,
    readonly name: string,
    readonly options: AudioWorkletNodeOptions,
  ) {
    super();
    worklets.push(this);
  }
}

beforeEach(() => {
  contexts.length = 0;
  worklets.length = 0;
  resume = () => Promise.resolve();
  loadModule = () => Promise.resolve();
  vi.stubGlobal("AudioContext", TestContext);
  vi.stubGlobal("AudioWorkletNode", TestWorklet);
  vi.stubGlobal(
    "MediaStream",
    class {
      constructor(readonly tracks: MediaStreamTrack[]) {}
      getTracks(): MediaStreamTrack[] {
        return this.tracks;
      }
    },
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("private denoiser host", () => {
  it("prepares a module before constructing the worklet and passes only the setup data", async () => {
    const module = new WebAssembly.Module(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]));
    const prepare = vi.fn(() => Promise.resolve({ module }));
    const pending = createWorkletAudioNoiseProcessor(createTrack(), "standard", {
      ...backend,
      prepare,
    });
    const context = contexts[0]!;
    await vi.waitFor(() => expect(context.resume).toHaveBeenCalled());
    const worklet = worklets[0]!;
    expect(prepare).toHaveBeenCalledTimes(1);
    expect(worklet.options.processorOptions).toEqual({ module });
    worklet.port.send({ type: "ready" });
    (await pending).dispose();
  });

  it("cancels asset preparation without constructing a worklet or owning the input", async () => {
    let finishPreparation: ((value: Readonly<Record<string, unknown>>) => void) | undefined;
    const prepare = vi.fn(
      () =>
        new Promise<Readonly<Record<string, unknown>>>((resolve) => {
          finishPreparation = resolve;
        }),
    );
    const input = createTrack();
    const controller = new AbortController();
    const result = createWorkletAudioNoiseProcessor(
      input,
      "standard",
      { ...backend, prepare },
      {
        signal: controller.signal,
      },
    ).catch((cause: unknown) => cause);
    controller.abort();
    await expect(result).resolves.toMatchObject({ name: "AbortError" });
    finishPreparation?.({});
    await Promise.resolve();
    expect(worklets).toHaveLength(0);
    expect(contexts[0]!.close).toHaveBeenCalledTimes(1);
    expect(input.stop).not.toHaveBeenCalled();
  });

  it("uses the backend graph and accepts its own framing without acquiring or stopping input", async () => {
    const input = createTrack();
    const pending = createWorkletAudioNoiseProcessor(input, "light", backend);
    const context = contexts[0]!;
    await vi.waitFor(() => expect(context.resume).toHaveBeenCalled());
    const worklet = worklets[0]!;
    worklet.port.send({ type: "ready", frameSize: 256 });
    const processor = await pending;

    expect(context.options.sampleRate).toBe(16_000);
    expect(context.audioWorklet.addModule).toHaveBeenCalledWith(backend.workletUrl);
    expect(worklet.name).toBe(backend.processorName);
    expect(worklet.options.outputChannelCount).toEqual([2]);
    expect(worklet.options.channelCount).toBe(2);
    expect(context.destination.channelCount).toBe(2);
    expect(processor.track).toBe(context.output);
    processor.update("strong");
    expect(worklet.port.postMessage).toHaveBeenLastCalledWith({ type: "update", level: "strong" });

    processor.dispose();
    processor.dispose();
    expect(context.output.stop).toHaveBeenCalledTimes(1);
    expect(context.close).toHaveBeenCalledTimes(1);
    expect(context.source.disconnect).toHaveBeenCalledTimes(1);
    expect(worklet.disconnect).toHaveBeenCalledTimes(1);
    expect(input.stop).not.toHaveBeenCalled();
  });

  it("reports an initialization fault and cleans up while context resume is still pending", async () => {
    resume = () => new Promise(() => {});
    const input = createTrack();
    const result = createWorkletAudioNoiseProcessor(input, "standard", backend).catch(
      (cause: unknown) => cause,
    );
    const context = contexts[0]!;
    await vi.waitFor(() => expect(context.resume).toHaveBeenCalled());
    const worklet = worklets[0]!;
    worklet.port.send({
      type: "fault",
      faultKind: "failed",
      message: "model initialization failed",
    });

    await expect(result).resolves.toMatchObject({
      name: "AudioNoiseProcessorError",
      faultKind: "failed",
      message: "model initialization failed",
    });
    expect(context.close).toHaveBeenCalledTimes(1);
    expect(context.output.stop).toHaveBeenCalledTimes(1);
    expect(worklet.port.close).toHaveBeenCalledTimes(1);
    expect(input.stop).not.toHaveBeenCalled();
  });

  it("cancels pending readiness and ignores late messages after releasing the graph", async () => {
    resume = () => new Promise(() => {});
    const controller = new AbortController();
    const onFault = vi.fn();
    const input = createTrack();
    const result = createWorkletAudioNoiseProcessor(input, "standard", backend, {
      signal: controller.signal,
      onFault,
    }).catch((cause: unknown) => cause);
    const context = contexts[0]!;
    await vi.waitFor(() => expect(context.resume).toHaveBeenCalled());
    const worklet = worklets[0]!;
    controller.abort();

    await expect(result).resolves.toMatchObject({ name: "AbortError" });
    worklet.port.send({ type: "ready", frameSize: 256 });
    worklet.port.send({ type: "fault", faultKind: "failed", message: "late failure" });
    expect(onFault).not.toHaveBeenCalled();
    expect(context.close).toHaveBeenCalledTimes(1);
    expect(context.output.stop).toHaveBeenCalledTimes(1);
    expect(input.stop).not.toHaveBeenCalled();
  });

  it("rejects a fault after worklet readiness while resume remains pending", async () => {
    resume = () => new Promise(() => {});
    const result = createWorkletAudioNoiseProcessor(createTrack(), "standard", backend).catch(
      (cause: unknown) => cause,
    );
    const context = contexts[0]!;
    await vi.waitFor(() => expect(context.resume).toHaveBeenCalled());
    const worklet = worklets[0]!;
    worklet.port.send({ type: "ready" });
    worklet.port.send({
      type: "fault",
      faultKind: "overload",
      message: "render deadline exceeded",
    });
    await expect(result).resolves.toMatchObject({ faultKind: "overload" });
    expect(context.close).toHaveBeenCalledTimes(1);
  });

  it("releases the context when a backend module cannot load", async () => {
    loadModule = () => Promise.reject(new Error("backend asset unavailable"));
    const input = createTrack();

    await expect(
      createWorkletAudioNoiseProcessor(input, "standard", backend),
    ).rejects.toMatchObject({ faultKind: "failed", message: "backend asset unavailable" });
    const context = contexts[0]!;
    expect(context.close).toHaveBeenCalledTimes(1);
    expect(context.createMediaStreamSource).not.toHaveBeenCalled();
    expect(input.stop).not.toHaveBeenCalled();
  });
  it.each(["processorerror", "output-ended", "context-suspended"])(
    "reports %s once and releases only processor resources",
    async (failure) => {
      const input = createTrack();
      const onFault = vi.fn();
      const pending = createWorkletAudioNoiseProcessor(input, "standard", backend, { onFault });
      await vi.waitFor(() => expect(worklets).toHaveLength(1));
      const context = contexts[0]!;
      const worklet = worklets[0]!;
      context.state = "running";
      worklet.port.send({ type: "ready" });
      const processor = await pending;
      if (failure === "processorerror") worklet.dispatchEvent(new Event("processorerror"));
      else if (failure === "output-ended") context.output.dispatchEvent(new Event("ended"));
      else {
        context.state = "suspended";
        context.dispatchEvent(new Event("statechange"));
      }
      expect(onFault).toHaveBeenCalledTimes(1);
      expect(onFault).toHaveBeenCalledWith(expect.objectContaining({ faultKind: "failed" }));
      worklet.port.send({ type: "fault", faultKind: "failed", message: "duplicate" });
      expect(onFault).toHaveBeenCalledTimes(1);
      processor.dispose();
      expect(context.close).toHaveBeenCalledTimes(1);
      expect(context.output.stop).toHaveBeenCalledTimes(1);
      expect(input.stop).not.toHaveBeenCalled();
    },
  );

  it("bounds readiness and closes a graph which never produces usable output", async () => {
    const input = createTrack();
    await expect(
      createWorkletAudioNoiseProcessor(input, "standard", backend, { startupTimeoutMs: 10 }),
    ).rejects.toMatchObject({
      faultKind: "failed",
      message: expect.stringContaining("within 10 ms"),
    });
    expect(contexts[0]!.close).toHaveBeenCalledTimes(1);
    expect(input.stop).not.toHaveBeenCalled();
  });
});
