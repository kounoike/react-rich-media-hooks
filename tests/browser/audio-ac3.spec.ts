/* eslint-disable unicorn/require-post-message-target-origin -- Diagnostic MessagePort, no Window targetOrigin. */
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { expect, test } from "@playwright/test";

test("separates known delay, media bridges, native profiles and processor state", async ({
  page,
}) => {
  test.skip(process.env.AUDIO_AC3 !== "1", "Opt-in AC3 latency/profile and SIMD comparison.");
  test.setTimeout(420_000);
  const generic = readFileSync("src/effects/audio/assets/rnnoise.wasm");
  const measurementStage = process.env.AUDIO_AC3_STAGE ?? "all";
  expect(["all", "graph", "compute"]).toContain(measurementStage);
  const artifacts: Record<string, Buffer> = { generic };
  if (measurementStage !== "graph") {
    if (process.env.AUDIO_ZIG === "1") {
      for (const variant of ["zig-generic", "zig-simd128"])
        artifacts[variant] = readFileSync(`.cache/audio-zig/${variant}.wasm`);
    } else artifacts.simd128 = readFileSync(".cache/audio-experiment/rnnoise-simd128.wasm");
  }
  const input = readFileSync(".cache/audio-quality/speech.f32");
  const worklet = readdirSync("dist/assets").find((name) => /^noise-worklet-.*\.js$/.test(name));
  expect(worklet).toBeDefined();
  const identities = Object.fromEntries(
    Object.entries({ ...artifacts, input }).map(([name, bytes]) => [
      name,
      createHash("sha256").update(bytes).digest("hex"),
    ]),
  );
  const servedDiagnostic = await (
    await page.request.get("/tests/browser/audio-diagnostic-worklet.ts")
  ).text();
  const servedKernel = await (
    await page.request.get("/src/effects/audio/backends/rnnoise-kernel.ts")
  ).text();
  expect(servedDiagnostic).toContain("ac3-zig-v2");
  expect(servedKernel).toContain("get frameBuffer");
  const servedSources = {
    diagnosticModuleSha256: createHash("sha256").update(servedDiagnostic).digest("hex"),
    kernelModuleSha256: createHash("sha256").update(servedKernel).digest("hex"),
  };
  for (const [name, bytes] of Object.entries({ ...artifacts, input })) {
    await page.route(`**/audio-ac3-${name}`, (route) =>
      route.fulfill({ contentType: "application/octet-stream", body: bytes }),
    );
  }
  await page.route("**/tests/browser/index.html", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><button>Start measurement</button>",
    }),
  );
  await page.goto("/tests/browser/index.html");
  await page.getByRole("button", { name: "Start measurement" }).click();
  const result = await page.evaluate(
    async ({ productionWorklet, nativeWindows, stage, variants }) => {
      const library = await import(new URL("/dist/core/index.js", location.origin).href);
      const effects = await import(new URL("/dist/effects/audio/index.js", location.origin).href);
      const runtime = await import(new URL("/src/effects/audio/runtime.ts", location.origin).href);
      const context = new AudioContext({ sampleRate: 48_000 });
      const diagnosticUrl = new URL("/tests/browser/audio-diagnostic-worklet.ts", location.origin)
        .href;
      const modules: Record<string, WebAssembly.Module> = {};
      const featureErrors: Record<string, string> = {};
      for (const name of variants) {
        try {
          modules[name] = await WebAssembly.compile(
            await (await fetch(`/audio-ac3-${name}`)).arrayBuffer(),
          );
        } catch (cause) {
          featureErrors[name] = String(cause);
        }
      }
      const pcm = new Float32Array(await (await fetch("/audio-ac3-input")).arrayBuffer());
      const audio = context.createBuffer(1, pcm.length, 48_000);
      audio.copyToChannel(pcm, 0);
      const playback = context.createBufferSource();
      playback.buffer = audio;
      playback.loop = true;
      const capture = context.createMediaStreamDestination();
      playback.connect(capture);
      let acquisitions = 0;
      Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
        configurable: true,
        value: () => {
          acquisitions++;
          return Promise.resolve(capture.stream);
        },
      });
      const session = library.createMediaSession({ capture: { audio: true } });
      const NativeNode = AudioWorkletNode;
      let selectedModule: WebAssembly.Module | undefined;
      let rejectCandidate = false;
      globalThis.AudioWorkletNode = class extends NativeNode {
        constructor(ctx: BaseAudioContext, name: string, options?: AudioWorkletNodeOptions) {
          if (name === "rnnoise-noise-reduction" && rejectCandidate)
            throw new DOMException(
              "SIMD128 unavailable in controlled rejection probe",
              "NotSupportedError",
            );
          super(
            ctx,
            name,
            name === "rnnoise-noise-reduction" && selectedModule
              ? { ...options, processorOptions: { module: selectedModule } }
              : options,
          );
        }
      };
      type Window = {
        phase: string;
        sequence: number;
        startFrame: number;
        endFrame: number;
        droppedWindows: number;
        a: number[];
        b: number[];
      };
      const windows: Window[] = [];
      const history: {
        frame: number;
        status: string;
        original: boolean;
        reason: string;
        phase: string;
      }[] = [];
      const operations: { phase: string; result: string; message?: string }[] = [];
      const profiles: Record<string, unknown>[] = [];
      let phase = "setup";
      const graph: { source: AudioNode | null } = { source: null };
      const releaseSource = (): void => {
        graph.source?.disconnect();
        graph.source = null;
      };
      let collector: AudioWorkletNode | null = null;
      let original: MediaStreamTrack | undefined;
      let pending: { name: string; count: number; finish: () => void } | null = null;
      const mark = (reason: string): void => {
        history.push({
          frame: Math.round(context.currentTime * 48_000),
          status: session.getSnapshot().processors.audio.status,
          original: session.getOutput("audio")?.track === original,
          reason,
          phase,
        });
      };
      const bind = (): void => {
        graph.source?.disconnect();
        const output = session.getOutput("audio");
        if (collector && output) {
          graph.source = context.createMediaStreamSource(output.stream);
          graph.source.connect(collector, 0, 1);
        }
      };
      let previous: MediaStreamTrack | undefined;
      const unsubscribe = session.subscribe(() => {
        const output = session.getOutput("audio")?.track;
        if (output !== previous) {
          previous = output;
          if (phase.startsWith("rnnoise") || phase === "original") bind();
        }
        mark("session-transition");
      });
      const collect = async (name: string, count: number): Promise<void> => {
        phase = name;
        mark("phase-start");
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(
            () => {
              pending = null;
              reject(new Error(`No complete windows for ${name}`));
            },
            (count + 10) * 1000,
          );
          pending = {
            name,
            count,
            finish: () => {
              clearTimeout(timer);
              pending = null;
              resolve();
            },
          };
          collector!.port.postMessage({ type: "phase", phase: name });
        });
        mark("phase-end");
        collector!.port.postMessage({ type: "phase", phase: "idle" });
      };
      try {
        await context.audioWorklet.addModule(diagnosticUrl);
        collector = new NativeNode(context, "audio-evidence-collector", { numberOfInputs: 2 });
        collector.port.addEventListener(
          "message",
          (event: MessageEvent<Omit<Window, "a" | "b"> & { buffers: ArrayBuffer[] }>) => {
            const data = event.data;
            windows.push({
              phase: data.phase,
              sequence: data.sequence,
              startFrame: data.startFrame,
              endFrame: data.endFrame,
              droppedWindows: data.droppedWindows,
              a: Array.from(new Float32Array(data.buffers[0]!)),
              b: Array.from(new Float32Array(data.buffers[1]!)),
            });
            collector!.port.postMessage({ type: "recycle", buffers: data.buffers }, data.buffers);
            if (pending?.name === data.phase) {
              pending.count--;
              if (pending.count === 0) pending.finish();
            }
          },
        );
        collector.port.start();
        collector.connect(context.destination);
        playback.connect(collector, 0, 0);
        playback.start();
        await context.resume();
        await session.start();
        original = session.getOutput("audio")?.track;
        // Controls use the exact collector, signal and one-second framing used by the measured paths.
        for (const delayMs of [0, 30, 60]) {
          const delay = context.createDelay(1);
          delay.delayTime.value = delayMs / 1000;
          playback.connect(delay);
          delay.connect(collector, 0, 1);
          graph.source = delay;
          await collect(`known-${delayMs}`, 3);
          delay.disconnect();
          playback.disconnect(delay);
          graph.source = null;
        }
        phase = "original";
        bind();
        await collect("original", 4);
        graph.source?.disconnect();
        graph.source = null;
        for (const delaySamples of stage === "compute" ? [] : [0, 1440]) {
          const processor = await runtime.createWorkletAudioNoiseProcessor(original, "strong", {
            id: "diagnostic-pass",
            label: "Diagnostic pass",
            workletUrl: diagnosticUrl,
            processorName: "audio-evidence-pass",
            contextSampleRate: 48_000,
            channelCount: 1,
            prepare: () => Promise.resolve({ delaySamples }),
          });
          graph.source = context.createMediaStreamSource(new MediaStream([processor.track]));
          graph.source.connect(collector, 0, 1);
          await collect(`graph-${delaySamples}`, 4);
          graph.source.disconnect();
          graph.source = null;
          processor.dispose();
        }
        for (const variant of stage === "graph" ? [] : variants) {
          if (!modules[variant]) continue;
          selectedModule = modules[variant];
          phase = `rnnoise-${variant}`;
          const added = await session.setAudioEffects({
            effects: [effects.noiseReduction({ level: "strong" })],
          });
          operations.push({ phase, result: added.status, message: added.error?.message });
          bind();
          await collect(phase, nativeWindows);
          phase = "cleanup";
          await session.setAudioEffects({ effects: [] });
          releaseSource();
        }
        rejectCandidate = true;
        phase = "unsupported-simd";
        const rejected = await session.setAudioEffects({ effects: [effects.noiseReduction()] });
        const unsupportedFallback = {
          result: rejected.status,
          original: session.getOutput("audio")?.track === original,
          inputLive: original?.readyState === "live",
          message: rejected.error?.message,
          simulated: true,
        };
        rejectCandidate = false;
        for (const variant of stage === "graph" ? [] : variants) {
          if (!modules[variant]) continue;
          for (const mode of ["native", "kernel", "inplace"]) {
            const profile = await new Promise<Record<string, unknown>>((resolve, reject) => {
              const timer = setTimeout(() => {
                node.disconnect();
                reject(new Error("Profile timed out"));
              }, 20_000);
              const node = new NativeNode(context, "audio-evidence-profile", {
                processorOptions: { module: modules[variant], mode },
              });
              node.port.addEventListener(
                "message",
                (event: MessageEvent<Record<string, unknown>>) => {
                  if (event.data.profileProtocol !== "ac3-zig-v2") {
                    clearTimeout(timer);
                    node.disconnect();
                    node.port.close();
                    reject(new Error("Stale diagnostic Worklet; restart the frozen server."));
                    return;
                  }
                  if (
                    !(event.data.engineMs instanceof Float64Array) ||
                    !(event.data.callbackMs instanceof Float64Array)
                  )
                    return;
                  clearTimeout(timer);
                  node.disconnect();
                  node.port.close();
                  resolve({
                    ...event.data,
                    engineMs: Array.from(event.data.engineMs),
                    callbackMs: Array.from(event.data.callbackMs),
                    variant,
                  });
                },
                { once: true },
              );
              node.port.start();
              node.connect(context.destination);
            });
            profiles.push(profile);
          }
        }
        const { RnnoiseKernel } = await import(
          new URL("/src/effects/audio/backends/rnnoise-kernel.ts", location.origin).href
        );
        const numericalOutputs: Record<string, Float32Array> = {};
        for (const variant of stage === "graph" ? [] : variants) {
          if (!modules[variant]) continue;
          const kernel = new RnnoiseKernel(modules[variant]);
          const output = new Float32Array(pcm.length);
          for (let offset = 0; offset < pcm.length; offset += 480) {
            const frame = new Float32Array(480);
            frame.set(pcm.subarray(offset, offset + 480));
            for (let i = 0; i < 480; i++) frame[i] = frame[i]! * 32768;
            kernel.processFrame(frame);
            for (let i = 0; i < Math.min(480, pcm.length - offset); i++)
              output[offset + i] = frame[i]! / 32768;
          }
          kernel.destroy();
          numericalOutputs[variant] = output;
        }
        const numericalComparison = Object.fromEntries(
          Object.entries(numericalOutputs).map(([variant, b]) => {
            const a = numericalOutputs.generic!;
            let maxAbsDiff = 0,
              squares = 0,
              differentBits = 0;
            const aBits = new Uint32Array(a.buffer),
              bBits = new Uint32Array(b.buffer);
            for (let i = 0; i < a.length; i++) {
              const delta = a[i]! - b[i]!;
              maxAbsDiff = Math.max(maxAbsDiff, Math.abs(delta));
              squares += delta * delta;
              if (aBits[i] !== bBits[i]) differentBits++;
            }
            return [
              variant,
              {
                batchOnly: true,
                samples: a.length,
                maxAbsDiff,
                rmsDiff: Math.sqrt(squares / a.length),
                differentBits,
                allFinite: b.every(Number.isFinite),
              },
            ];
          }),
        );
        return {
          measurementStage: stage,
          addedLatencyDefinition:
            "processed lag minus this run original-track median; includes graph/model/staging; no graph subtraction; fallback never qualifies",
          userAgent: navigator.userAgent,
          sampleRate: context.sampleRate,
          captureRate: 16_000,
          acquisitions,
          browserReportedBaseLatencyMs: context.baseLatency * 1000,
          windows,
          history,
          operations,
          profiles,
          featureErrors,
          numericalComparison,
          unsupportedFallback,
          producerWindowFrames: 48_000,
          productionWorklet,
          fixture:
            "same cached speech PCM, 48kHz mono; native generic module or experimental SIMD module injected at private AudioWorklet construction, no public selector",
        };
      } finally {
        unsubscribe();
        globalThis.AudioWorkletNode = NativeNode;
        graph.source?.disconnect();
        collector?.disconnect();
        collector?.port.close();
        playback.stop();
        await session.dispose();
        capture.stream.getTracks().forEach((track) => track.stop());
        await context.close();
      }
    },
    {
      productionWorklet: worklet,
      nativeWindows: Number(process.env.AUDIO_AC3_WINDOWS ?? 8),
      stage: measurementStage,
      variants: Object.keys(artifacts),
    },
  );
  await test.info().attach("audio-ac3.json", {
    body: Buffer.from(JSON.stringify({ identities, servedSources, ...result })),
    contentType: "application/json",
  });
  expect(result.acquisitions).toBe(1);
  expect(
    result.windows.every(
      (window) =>
        window.a.length === 16_000 &&
        window.b.length === 16_000 &&
        Number.isFinite(window.endFrame - window.startFrame),
    ),
  ).toBe(true);
  expect(result.unsupportedFallback).toMatchObject({
    result: "failed",
    original: true,
    inputLive: true,
  });
});
