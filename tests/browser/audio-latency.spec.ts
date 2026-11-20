import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

test("records paired browser loopback latency against the same original track", async ({
  page,
}) => {
  test.skip(
    process.env.AUDIO_MEASURE !== "1",
    "Generate the documented PCM fixture and set AUDIO_MEASURE=1.",
  );
  test.setTimeout(60_000);
  if (process.env.AUDIO_LOW_LATENCY === "1") {
    // Disposable measurement of a browser hint; no product setting or support claim.
    await page.addInitScript(() => {
      const NativeContext = AudioContext;
      globalThis.AudioContext = class extends NativeContext {
        constructor(options: AudioContextOptions = {}) {
          super({ ...options, latencyHint: 0 });
        }
      };
    });
  }
  const pcm = readFileSync(".cache/audio-quality/speech.f32");
  await page.route("**/audio-latency-input.f32", (route) =>
    route.fulfill({ contentType: "application/octet-stream", body: pcm }),
  );
  await page.goto("/tests/browser/index.html");
  const result = await page.evaluate(async () => {
    const library = await import(new URL("/dist/core/index.js", location.origin).href);
    const effects = await import(new URL("/dist/effects/audio/index.js", location.origin).href);
    const context = new AudioContext({ sampleRate: 48_000 });
    const samples = new Float32Array(await (await fetch("/audio-latency-input.f32")).arrayBuffer());
    const buffer = context.createBuffer(1, samples.length, 48_000);
    buffer.copyToChannel(samples, 0);
    const playback = context.createBufferSource();
    playback.buffer = buffer;
    playback.loop = true;
    const input = context.createMediaStreamDestination();
    playback.connect(input);
    let acquisitions = 0;
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      configurable: true,
      value: () => {
        acquisitions += 1;
        return Promise.resolve(input.stream);
      },
    });
    const moduleUrl = URL.createObjectURL(
      new Blob(
        [
          `
      class Collector extends AudioWorkletProcessor {
        a = []; b = [];
        process(inputs, outputs) {
          const a = inputs[0]?.[0], b = inputs[1]?.[0];
          for (let i = 0; i < outputs[0][0].length; i++) {
            if ((currentFrame + i) % 3 !== 0) continue;
            this.a.push(a?.[i] ?? 0); this.b.push(b?.[i] ?? 0);
          }
          if (this.a.length >= 16000) {
            this.port.postMessage({ a: this.a, b: this.b }); this.a = []; this.b = [];
          }
          return true;
        }
      }
      registerProcessor('latency-collector', Collector);
    `,
        ],
        { type: "text/javascript" },
      ),
    );
    const session = library.createMediaSession({ capture: { audio: true } });
    let collector: AudioWorkletNode | null = null;
    let source: MediaStreamAudioSourceNode | null = null;
    const windows: { phase: string; a: number[]; b: number[] }[] = [];
    let phase = "baseline";
    let addedStatus = "not-started";
    let finalStatus = "off";
    let error: string | undefined;
    try {
      await context.audioWorklet.addModule(moduleUrl);
      collector = new AudioWorkletNode(context, "latency-collector", { numberOfInputs: 2 });
      collector.port.addEventListener(
        "message",
        (event: MessageEvent<{ a: number[]; b: number[] }>) => {
          windows.push({ phase, ...event.data });
        },
      );
      collector.port.start();
      collector.connect(context.destination);
      playback.connect(collector, 0, 0);
      playback.start();
      await context.resume();
      await session.start();
      source = context.createMediaStreamSource(session.getOutput("audio").stream);
      source.connect(collector, 0, 1);
      await new Promise<void>((resolve) => setTimeout(resolve, 6000));
      phase = "transition";
      const added = await session.setAudioEffects({
        effects: [effects.noiseReduction({ level: "strong" })],
      });
      addedStatus = added.status;
      error = added.error?.message;
      source.disconnect();
      source = context.createMediaStreamSource(session.getOutput("audio").stream);
      source.connect(collector, 0, 1);
      await new Promise<void>((resolve) => setTimeout(resolve, 1000));
      phase = "processed";
      await new Promise<void>((resolve) => setTimeout(resolve, 8000));
      finalStatus = session.getSnapshot().processors.audio.status;
      error ??= session.getSnapshot().error?.message;
      return {
        userAgent: navigator.userAgent,
        acquisitions,
        addedStatus,
        finalStatus,
        error,
        browserReportedBaseLatencyMs: context.baseLatency * 1000,
        // Uniform 3:1 sampling of both channels preserves their relative time axis.
        captureRate: 16_000,
        windows,
      };
    } finally {
      source?.disconnect();
      collector?.disconnect();
      collector?.port.close();
      playback.stop();
      input.stream.getTracks().forEach((track) => track.stop());
      await session.dispose();
      await context.close();
      URL.revokeObjectURL(moduleUrl);
    }
  });
  await test.info().attach("audio-loopback.json", {
    body: Buffer.from(JSON.stringify(result)),
    contentType: "application/json",
  });
  expect(result.acquisitions).toBe(1);
  expect(result.windows.some((window) => window.phase === "baseline")).toBe(true);
  expect(["active", "degraded", "failed", "unsupported"]).toContain(result.finalStatus);
});
