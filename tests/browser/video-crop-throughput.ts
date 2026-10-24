import {
  createCanvasCropProcessor,
  type VideoCropProcessor,
} from "../../src/effects/video/runtime.js";

type Mode = "direct" | "library" | "timer" | "request";
interface Sample {
  now: number;
  presented: number;
  mediaTime: number;
}
interface FrameStats {
  callbacks: number;
  callbackFps: number | null;
  presentedFps: number | null;
  wallWindowFps: number;
  callbackGaps: number;
  first: Sample | null;
  last: Sample | null;
}
interface Row {
  mode: Mode;
  trial: number;
  measuredMs: number;
  input: FrameStats;
  output: FrameStats;
  outputToInputRatio: number | null;
  drawCalls: number;
  drawP95Ms: number | null;
  outputSettings: {
    width: number | undefined;
    height: number | undefined;
    frameRate: number | undefined;
  };
}
interface Report {
  startedAt: string;
  source: "synthetic" | "camera";
  userAgent: string;
  inputConnected: boolean;
  status: "running" | "completed" | "stopped" | "failed";
  rows: Row[];
  error?: string;
  tracksReleased: boolean;
  tracksObserved?: number;
  liveTracksAfterCleanup?: number;
  sourceSettings?: {
    width: number | undefined;
    height: number | undefined;
    frameRate: number | undefined;
  };
}
declare global {
  interface Window {
    cropThroughputResult?: Report;
  }
}

const element = <T extends HTMLElement>(id: string, type: new () => T): T => {
  const node = document.getElementById(id);
  if (!(node instanceof type)) throw new Error(`Missing ${id}`);
  return node;
};
const container = element("videos", HTMLDivElement);
const status = element("status", HTMLParagraphElement);
const startButton = element("start", HTMLButtonElement);
const stopButton = element("stop", HTMLButtonElement);
const downloadButton = element("download", HTMLButtonElement);
let controller: AbortController | null = null;

const bounded = <T>(promise: Promise<T>, signal: AbortSignal, ms: number): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const abort = (): void => fail(new Error("Stopped"));
    const timer = window.setTimeout(() => fail(new Error("No video progress within deadline")), ms);
    const cleanup = (): void => {
      window.clearTimeout(timer);
      signal.removeEventListener("abort", abort);
    };
    const fail = (error: Error): void => {
      cleanup();
      reject(error);
    };
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
    promise.then(
      (value) => {
        cleanup();
        resolve(value);
      },
      (error) => fail(error instanceof Error ? error : new Error(String(error))),
    );
  });
const wait = (ms: number, signal: AbortSignal): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    const cleanup = (): void => {
      window.clearTimeout(timer);
      signal.removeEventListener("abort", abort);
    };
    const abort = (): void => {
      cleanup();
      reject(new Error("Stopped"));
    };
    const timer = window.setTimeout(() => {
      cleanup();
      resolve();
    }, ms);
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
  });
const videoFor = (stream: MediaStream, connected: boolean): HTMLVideoElement => {
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.srcObject = stream;
  if (connected) container.append(video);
  return video;
};
type RequestedTrack = MediaStreamTrack & { requestFrame: () => void };
const hasRequestFrame = (track: MediaStreamTrack | undefined): track is RequestedTrack =>
  track !== undefined && "requestFrame" in track && typeof track.requestFrame === "function";
const stats = (samples: Sample[], elapsed: number): FrameStats => {
  const first = samples[0] ?? null;
  const last = samples.at(-1) ?? null;
  const span = first === null || last === null ? 0 : last.now - first.now;
  const presented = first === null || last === null ? 0 : last.presented - first.presented;
  return {
    callbacks: samples.length,
    callbackFps: span > 0 ? ((samples.length - 1) * 1000) / span : null,
    presentedFps: span > 0 ? (presented * 1000) / span : null,
    wallWindowFps: (samples.length * 1000) / elapsed,
    callbackGaps: Math.max(0, presented - Math.max(0, samples.length - 1)),
    first,
    last,
  };
};
const sample = (now: number, metadata: VideoFrameCallbackMetadata): Sample => ({
  now,
  presented: metadata.presentedFrames,
  mediaTime: metadata.mediaTime,
});

const measure = async (
  source: MediaStream,
  mode: Mode,
  trial: number,
  duration: number,
  connected: boolean,
  signal: AbortSignal,
  knownTracks: Set<MediaStreamTrack>,
): Promise<Row> => {
  const input = videoFor(source, connected);
  let preview: HTMLVideoElement | null = null;
  let processor: VideoCropProcessor | null = null;
  let output: MediaStream | null = null;
  let inputHandle: number | null = null;
  let outputHandle: number | null = null;
  let active = true;
  let measuring = false;
  let fault: Error | null = null;
  const inputSamples: Sample[] = [],
    outputSamples: Sample[] = [],
    drawTimes: number[] = [];
  let draws = 0;
  const canvas = document.createElement("canvas");
  canvas.width = 960;
  canvas.height = 720;
  const context =
    mode === "timer" || mode === "request"
      ? canvas.getContext("2d", { alpha: false, desynchronized: true })
      : null;
  let requestedTrack: RequestedTrack | null = null;
  const startup = new AbortController();
  try {
    if (mode === "timer" || mode === "request") {
      if (context === null) throw new Error("2D canvas unavailable");
      output = canvas.captureStream(30);
      output.getTracks().forEach((track) => knownTracks.add(track));
      const track = output.getVideoTracks()[0];
      if (hasRequestFrame(track)) requestedTrack = track;
      if (mode === "request" && requestedTrack === null)
        throw new Error("requestFrame unavailable");
    }
    const onInput = (now: number, metadata: VideoFrameCallbackMetadata): void => {
      if (!active) return;
      try {
        if (context !== null) {
          const begin = performance.now();
          context.drawImage(input, 160, 0, 960, 720, 0, 0, 960, 720);
          if (mode === "request") requestedTrack?.requestFrame();
          if (measuring) {
            draws += 1;
            drawTimes.push(performance.now() - begin);
          }
        }
        if (measuring) inputSamples.push(sample(now, metadata));
        inputHandle = input.requestVideoFrameCallback(onInput);
      } catch (error) {
        fault = error instanceof Error ? error : new Error(String(error));
      }
    };
    inputHandle = input.requestVideoFrameCallback(onInput);
    await bounded(input.play(), signal, 5000);
    if (mode === "library") {
      processor = await bounded(
        createCanvasCropProcessor(
          source.getVideoTracks()[0]!,
          { region: { x: 0.125, y: 0, width: 0.75, height: 1 } },
          {
            signal: AbortSignal.any([signal, startup.signal]),
            onFault: (error) => {
              fault = error;
            },
          },
        ),
        signal,
        5000,
      );
      output = new MediaStream([processor.track]);
    }
    if (mode === "direct") output = source;
    if (output === null) throw new Error("Missing output stream");
    output.getTracks().forEach((track) => knownTracks.add(track));
    preview = videoFor(output, true);
    const outputVideo = preview;
    let firstFrame: (() => void) | undefined;
    const ready = new Promise<void>((resolve) => {
      firstFrame = resolve;
    });
    const onOutput = (now: number, metadata: VideoFrameCallbackMetadata): void => {
      if (!active) return;
      firstFrame?.();
      firstFrame = undefined;
      if (measuring) outputSamples.push(sample(now, metadata));
      outputHandle = outputVideo.requestVideoFrameCallback(onOutput);
    };
    outputHandle = preview.requestVideoFrameCallback(onOutput);
    await bounded(preview.play(), signal, 5000);
    await bounded(ready, signal, 5000);
    status.textContent = `${trial}: ${mode} — warm-up`;
    await wait(1000, signal);
    status.textContent = `${trial}: ${mode} — ${duration / 1000}s measurement`;
    const begin = performance.now();
    measuring = true;
    await wait(duration, signal);
    measuring = false;
    const elapsed = performance.now() - begin;
    if (fault !== null) throw fault;
    if (document.visibilityState !== "visible")
      throw new Error("Keep the page visible during measurement");
    const inputStats = stats(inputSamples, elapsed),
      outputStats = stats(outputSamples, elapsed);
    const settings = output.getVideoTracks()[0]!.getSettings();
    drawTimes.sort((a, b) => a - b);
    return {
      mode,
      trial,
      measuredMs: elapsed,
      input: inputStats,
      output: outputStats,
      outputToInputRatio:
        inputStats.presentedFps && outputStats.presentedFps
          ? outputStats.presentedFps / inputStats.presentedFps
          : null,
      drawCalls: draws,
      drawP95Ms: drawTimes[Math.max(0, Math.ceil(drawTimes.length * 0.95) - 1)] ?? null,
      outputSettings: {
        width: settings.width,
        height: settings.height,
        frameRate: settings.frameRate,
      },
    };
  } finally {
    startup.abort();
    active = false;
    measuring = false;
    if (inputHandle !== null) input.cancelVideoFrameCallback(inputHandle);
    if (preview !== null && outputHandle !== null) preview.cancelVideoFrameCallback(outputHandle);
    input.pause();
    input.srcObject = null;
    input.remove();
    if (preview !== null) {
      preview.pause();
      preview.srcObject = null;
      preview.remove();
    }
    processor?.dispose();
    if (output !== source) output?.getTracks().forEach((track) => track.stop());
  }
};

const syntheticSource = (fps: number): { stream: MediaStream; dispose: () => void } => {
  const canvas = document.createElement("canvas");
  canvas.width = 1280;
  canvas.height = 720;
  const context = canvas.getContext("2d", { alpha: false });
  if (context === null) throw new Error("Synthetic source unavailable");
  container.append(canvas);
  // Advertise the generated cadence; request each painted frame to avoid a second timer gate.
  const stream = canvas.captureStream(fps);
  const track = stream.getVideoTracks()[0];
  if (!hasRequestFrame(track)) {
    track?.stop();
    canvas.remove();
    throw new Error("Synthetic requestFrame unavailable");
  }
  let handle = 0,
    next = 0,
    sequence = 0;
  const paint = (now: number): void => {
    if (now >= next) {
      context.fillStyle = `rgb(${sequence++ % 256},80,100)`;
      context.fillRect(0, 0, canvas.width, canvas.height);
      track.requestFrame();
      next += 1000 / fps;
      if (next < now - 1000 / fps) next = now + 1000 / fps;
    }
    handle = requestAnimationFrame(paint);
  };
  handle = requestAnimationFrame(paint);
  return {
    stream,
    dispose: () => {
      cancelAnimationFrame(handle);
      track.stop();
      canvas.remove();
    },
  };
};
const render = (report: Report): void => {
  window.cropThroughputResult = report;
  element("result", HTMLPreElement).textContent = JSON.stringify(report, null, 2);
  const body = element("rows", HTMLTableSectionElement);
  body.replaceChildren();
  for (const row of report.rows) {
    const tr = document.createElement("tr");
    for (const value of [
      row.mode,
      row.trial,
      row.input.presentedFps?.toFixed(2) ?? "—",
      row.output.presentedFps?.toFixed(2) ?? "—",
      row.outputToInputRatio?.toFixed(3) ?? "—",
      row.output.callbackGaps,
      row.drawP95Ms?.toFixed(2) ?? "—",
    ]) {
      const td = document.createElement("td");
      td.textContent = String(value);
      tr.append(td);
    }
    body.append(tr);
  }
};
startButton.addEventListener("click", () => {
  controller = new AbortController();
  const signal = controller.signal;
  startButton.disabled = true;
  stopButton.disabled = false;
  downloadButton.disabled = true;
  const sourceKind =
    element("source", HTMLSelectElement).value === "camera" ? "camera" : "synthetic";
  const report: Report = {
    startedAt: new Date().toISOString(),
    source: sourceKind,
    userAgent: navigator.userAgent,
    inputConnected: element("connected", HTMLInputElement).checked,
    status: "running",
    rows: [],
    tracksReleased: false,
  };
  render(report);
  const run = async (): Promise<void> => {
    const knownTracks = new Set<MediaStreamTrack>();
    let source: MediaStream | null = null,
      disposeSynthetic: (() => void) | undefined;
    try {
      if (sourceKind === "synthetic") {
        const generated = syntheticSource(Number(element("source-fps", HTMLSelectElement).value));
        source = generated.stream;
        disposeSynthetic = generated.dispose;
      } else {
        source = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { exact: 1280 },
            height: { exact: 720 },
            frameRate: { ideal: 30, max: 30 },
          },
          audio: false,
        });
      }
      source.getTracks().forEach((track) => knownTracks.add(track));
      if (signal.aborted) throw new Error("Stopped");
      const { width, height, frameRate } = source.getVideoTracks()[0]!.getSettings();
      report.sourceSettings = { width, height, frameRate };
      const duration =
        Math.max(3, Math.min(30, Number(element("duration", HTMLInputElement).value))) * 1000;
      const repetitions = Math.max(
        1,
        Math.min(5, Number(element("repetitions", HTMLInputElement).value)),
      );
      for (let trial = 1; trial <= repetitions; trial += 1) {
        const selected = element("modes", HTMLSelectElement).value;
        const modes: Mode[] =
          selected === "library"
            ? ["library"]
            : selected === "pair"
              ? ["timer", "request"]
              : ["direct", "library", "timer", "request"];
        if (trial % 2 === 0) modes.reverse();
        for (const mode of modes) {
          report.rows.push(
            await measure(
              source,
              mode,
              trial,
              duration,
              report.inputConnected,
              signal,
              knownTracks,
            ),
          );
          render(report);
        }
      }
      report.status = "completed";
      status.textContent = "Comparison complete; all owned tracks released.";
    } catch (error) {
      report.status = signal.aborted ? "stopped" : "failed";
      report.error = error instanceof Error ? error.message : String(error);
      status.textContent = `${report.status}: ${report.error}`;
    } finally {
      disposeSynthetic?.();
      source?.getTracks().forEach((track) => track.stop());
      report.tracksObserved = knownTracks.size;
      report.liveTracksAfterCleanup = [...knownTracks].filter(
        (track) => track.readyState !== "ended",
      ).length;
      report.tracksReleased = report.liveTracksAfterCleanup === 0;
      render(report);
      controller = null;
      startButton.disabled = false;
      stopButton.disabled = true;
      downloadButton.disabled = false;
    }
  };
  void run();
});
stopButton.addEventListener("click", () => controller?.abort());
document.addEventListener("visibilitychange", () => {
  if (document.hidden) controller?.abort();
});
downloadButton.addEventListener("click", () => {
  const report = window.cropThroughputResult;
  if (report === undefined) return;
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "crop-throughput-comparison.json";
  anchor.click();
  URL.revokeObjectURL(url);
});
