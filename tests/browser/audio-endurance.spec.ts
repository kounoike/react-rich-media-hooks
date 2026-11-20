import { expect, test } from "@playwright/test";

// Opt-in: ten minutes of real wall time; kept out of normal smoke/CI runs.
test("records sustained audio rendering and original-media fallback under UI contention", async ({
  page,
}) => {
  test.skip(process.env.AUDIO_ENDURANCE !== "1", "Set AUDIO_ENDURANCE=1 for the ten-minute probe.");
  test.setTimeout(660_000);
  await page.goto("/tests/browser/index.html");
  const result = await page.evaluate(async () => {
    const library = await import(new URL("/dist/core/index.js", location.origin).href);
    const effects = await import(new URL("/dist/effects/audio/index.js", location.origin).href);
    const acquire = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    let acquisitions = 0;
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      configurable: true,
      value: (constraints: MediaStreamConstraints) => {
        acquisitions += 1;
        return acquire(constraints);
      },
    });
    const session = library.createMediaSession({ capture: { audio: { noiseSuppression: false } } });
    const context = new AudioContext({ sampleRate: 48_000 });
    const moduleUrl = URL.createObjectURL(
      new Blob(
        [
          `
      class Probe extends AudioWorkletProcessor {
        samples = 0; missing = 0; invalid = 0; zero = 0; quanta = 0;
        process(inputs, outputs) {
          const input = inputs[0]?.[0];
          const output = outputs[0][0];
          this.quanta++;
          if (!input) this.missing++;
          let energy = 0;
          for (let i = 0; i < output.length; i++) {
            const value = input?.[i] ?? 0;
            if (!Number.isFinite(value)) this.invalid++;
            energy += value * value;
            output[i] = 0;
          }
          if (energy === 0) this.zero++;
          this.samples += output.length;
          if (this.quanta % 375 === 0) this.port.postMessage({ samples: this.samples,
            quanta: this.quanta, missing: this.missing, invalid: this.invalid, zero: this.zero });
          return true;
        }
      }
      registerProcessor('audio-evidence-probe', Probe);
    `,
        ],
        { type: "text/javascript" },
      ),
    );
    const phases: Record<string, number> = {};
    const setups: { status: string; ms: number; message?: string }[] = [];
    let counts = { samples: 0, quanta: 0, missing: 0, invalid: 0, zero: 0 };
    const graph: { source: MediaStreamAudioSourceNode | null } = { source: null };
    let probe: AudioWorkletNode | null = null;
    let clone: MediaStreamTrack | null = null;
    let original: MediaStreamTrack | undefined;
    let initialSettings: MediaTrackSettings = {};
    let outputChanges = 0;
    let contentionTicks = 0;
    const bind = (): void => {
      graph.source?.disconnect();
      const output = session.getOutput("audio");
      if (output && probe) {
        graph.source = context.createMediaStreamSource(output.stream);
        graph.source.connect(probe);
        outputChanges += 1;
      }
    };
    let previousTrack: MediaStreamTrack | undefined;
    const unsubscribe = session.subscribe(() => {
      const current = session.getOutput("audio")?.track;
      if (current !== previousTrack) {
        previousTrack = current;
        bind();
      }
    });
    let durationMs = 0;
    let originalOnExit = false;
    try {
      await session.start();
      original = session.getOutput("audio")?.track;
      initialSettings = original?.getSettings() ?? {};
      clone = session.getOutput("audio")?.clone().track ?? null;
      for (let cycle = 0; cycle < 5; cycle += 1) {
        const started = performance.now();
        const added = await session.setAudioEffects({ effects: [effects.noiseReduction()] });
        setups.push({
          status: added.status,
          ms: performance.now() - started,
          message: added.error?.message,
        });
        if (cycle < 4) await session.setAudioEffects({ effects: [], bypass: true });
      }
      await context.audioWorklet.addModule(moduleUrl);
      probe = new AudioWorkletNode(context, "audio-evidence-probe");
      probe.port.addEventListener("message", (event: MessageEvent<typeof counts>) => {
        counts = event.data;
      });
      probe.port.start();
      probe.connect(context.destination);
      bind();
      await context.resume();
      const started = performance.now();
      let nextUpdate = 60_000;
      while (performance.now() - started < 600_000) {
        await new Promise<void>((resolve) => setTimeout(resolve, 250));
        const status = session.getSnapshot().processors.audio.status;
        phases[status] = (phases[status] ?? 0) + 1;
        if (performance.now() - started >= nextUpdate) {
          const level = nextUpdate % 120_000 === 0 ? "strong" : "light";
          // An explicit retry is observable if a previous graph has fallen back.
          const updated = await session.setAudioEffects({
            effects: [effects.noiseReduction({ level })],
          });
          setups.push({ status: updated.status, ms: 0, message: updated.error?.message });
          nextUpdate += 60_000;
        }
        const busyUntil = performance.now() + 20;
        while (performance.now() < busyUntil) {
          Math.sqrt(contentionTicks + 1);
        }
        contentionTicks += 1;
      }
      durationMs = performance.now() - started;
      originalOnExit = session.getOutput("audio")?.track === original;
    } finally {
      unsubscribe();
      graph.source?.disconnect();
      probe?.disconnect();
      probe?.port.close();
      await context.close();
      URL.revokeObjectURL(moduleUrl);
      await session.dispose();
    }
    const cloneLiveAfterDispose = clone?.readyState === "live";
    clone?.stop();
    return {
      userAgent: navigator.userAgent,
      initialSettings,
      durationMs,
      acquisitions,
      setups,
      phases,
      counts,
      outputChanges,
      contentionTicks,
      originalOnExit,
      cloneLiveAfterDispose,
      originalEnded: original?.readyState === "ended",
      contextClosed: context.state === "closed",
    };
  });
  await test.info().attach("audio-endurance.json", {
    body: Buffer.from(JSON.stringify(result, null, 2)),
    contentType: "application/json",
  });
  expect(result.durationMs).toBeGreaterThanOrEqual(600_000);
  expect(result.acquisitions).toBe(1);
  expect(result.counts.samples).toBeGreaterThan(48_000 * 590);
  expect(result.counts.invalid).toBe(0);
  expect(result.cloneLiveAfterDispose).toBe(true);
  expect(result.originalEnded).toBe(true);
  expect(result.contextClosed).toBe(true);
});
