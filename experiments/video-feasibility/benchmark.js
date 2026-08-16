/*
 * Disposable, dependency-free browser probe for TASK-1.4.
 *
 * It intentionally uses a deterministic canvas scene rather than a camera or a
 * model download. This makes timing, transfer, backpressure, and cleanup
 * comparisons repeatable. It does not claim segmentation-model quality.
 */

(function () {
  "use strict";

  const query = new URLSearchParams(window.location.search);
  const mode = query.get("mode") || "capabilities";
  const width = 1280;
  const height = 720;
  const fps = 30;
  const intervalMs = 1000 / fps;
  const warmupMs = Number(query.get("warmup")) || 500;
  const measureMs = Number(query.get("duration")) || 2500;
  const overloadMs = Number(query.get("overload")) || 55;
  const runInterop = query.get("interop") === "1";
  const outputVideo = document.getElementById("output");
  const resultElement = document.getElementById("result");
  let overloadSink = 0;

  const now = () => performance.now();

  function sleep(milliseconds) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }

  function busyWait(milliseconds) {
    // A finite loop keeps virtual-time headless runs deterministic. The
    // iteration count is a synthetic overload dial, not a CPU-time claim.
    const iterations = Math.max(1, Math.round(milliseconds * 100000));
    let value = overloadSink;
    for (let index = 0; index < iterations; index += 1) {
      value = (value + index * 17) % 1000003;
    }
    overloadSink = value;
  }

  function percentile(values, quantile) {
    if (values.length === 0) return null;
    const sorted = values.slice().sort((a, b) => a - b);
    const position = (sorted.length - 1) * quantile;
    const lower = Math.floor(position);
    const upper = Math.ceil(position);
    if (lower === upper) return Number(sorted[lower].toFixed(3));
    const value = sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
    return Number(value.toFixed(3));
  }

  function summary(values) {
    if (values.length === 0) {
      return { count: 0, mean: null, p50: null, p95: null, max: null };
    }
    const total = values.reduce((sum, value) => sum + value, 0);
    return {
      count: values.length,
      mean: Number((total / values.length).toFixed(3)),
      p50: percentile(values, 0.5),
      p95: percentile(values, 0.95),
      max: Number(Math.max(...values).toFixed(3)),
    };
  }

  function memorySignal() {
    if (performance.memory && typeof performance.memory.usedJSHeapSize === "number") {
      return {
        source: "performance.memory.usedJSHeapSize",
        bytes: performance.memory.usedJSHeapSize,
      };
    }
    return { source: "unavailable", bytes: null };
  }

  function browserCapabilities() {
    const canvas = document.createElement("canvas");
    const video = document.createElement("video");
    const workerProbe = `
      self.postMessage({
        MediaStreamTrackProcessor: typeof self.MediaStreamTrackProcessor,
        MediaStreamTrackGenerator: typeof self.MediaStreamTrackGenerator,
        VideoTrackGenerator: typeof self.VideoTrackGenerator,
        VideoFrame: typeof self.VideoFrame,
        VideoEncoder: typeof self.VideoEncoder,
        OffscreenCanvas: typeof self.OffscreenCanvas,
      });
    `;
    const workerUrl = URL.createObjectURL(new Blob([workerProbe], { type: "text/javascript" }));
    const worker = new Worker(workerUrl);
    const workerResult = new Promise((resolve) => {
      const timeout = setTimeout(() => resolve({ timeout: true }), 1000);
      worker.onmessage = (event) => {
        clearTimeout(timeout);
        resolve(event.data);
      };
      worker.onerror = () => {
        clearTimeout(timeout);
        resolve({ error: true });
      };
    }).finally(() => {
      worker.terminate();
      URL.revokeObjectURL(workerUrl);
    });

    return workerResult.then((workerContext) => ({
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      isSecureContext: window.isSecureContext,
      crossOriginIsolated: window.crossOriginIsolated,
      canvasCaptureStream: typeof canvas.captureStream === "function",
      mediaElementCaptureStream: typeof video.captureStream === "function",
      requestVideoFrameCallback: typeof video.requestVideoFrameCallback === "function",
      MediaStream: typeof window.MediaStream,
      MediaStreamTrackProcessor: typeof window.MediaStreamTrackProcessor,
      MediaStreamTrackGenerator: typeof window.MediaStreamTrackGenerator,
      VideoTrackGenerator: typeof window.VideoTrackGenerator,
      VideoFrame: typeof window.VideoFrame,
      VideoEncoder: typeof window.VideoEncoder,
      OffscreenCanvas: typeof window.OffscreenCanvas,
      WebGL2: Boolean(canvas.getContext("webgl2")),
      WebGPU: typeof window.navigator.gpu,
      MediaRecorder: typeof window.MediaRecorder,
      RTCPeerConnection: typeof window.RTCPeerConnection,
      performanceMemory: Boolean(performance.memory),
      workerContext,
    }));
  }

  function makeCanvas() {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  function subjectPosition(frameIndex) {
    const phase = frameIndex / fps;
    return {
      x: width * 0.5 + Math.sin(phase * 1.7) * width * 0.17,
      y: height * 0.5 + Math.sin(phase * 2.3) * height * 0.04,
      scale: 1 + Math.sin(phase * 1.1) * 0.04,
    };
  }

  function drawScene(context, frameIndex, variant) {
    const phase = frameIndex / fps;
    const lighting = 0.72 + (Math.sin(phase * 0.7) + 1) * 0.14;
    const position = subjectPosition(frameIndex);

    const background = context.createLinearGradient(0, 0, width, height);
    background.addColorStop(0, `rgb(${Math.round(22 * lighting)}, ${Math.round(52 * lighting)}, ${Math.round(92 * lighting)})`);
    background.addColorStop(1, `rgb(${Math.round(100 * lighting)}, ${Math.round(48 * lighting)}, ${Math.round(36 * lighting)})`);
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);

    context.globalAlpha = 0.25;
    context.strokeStyle = "#d5efff";
    context.lineWidth = 3;
    for (let x = -height; x < width + height; x += 80) {
      context.beginPath();
      context.moveTo(x + (frameIndex % 80), 0);
      context.lineTo(x - height + (frameIndex % 80), height);
      context.stroke();
    }
    context.globalAlpha = 1;

    context.save();
    context.translate(position.x, position.y);
    context.scale(position.scale, position.scale);
    context.rotate(Math.sin(phase * 1.3) * 0.035);
    context.fillStyle = "#f2c6a0";
    context.beginPath();
    context.ellipse(0, -145, 78, 92, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#1e293b";
    context.beginPath();
    context.ellipse(0, -185, 84, 62, 0, Math.PI, Math.PI * 2);
    context.fill();
    context.fillStyle = "#236b82";
    context.beginPath();
    context.roundRect(-145, -45, 290, 280, 55);
    context.fill();
    context.fillStyle = "#eab59a";
    context.fillRect(-190, -15, 45, 150);
    context.fillRect(145, -15, 45, 150);
    context.strokeStyle = "#172033";
    context.lineWidth = 7;
    for (let hair = -60; hair <= 60; hair += 20) {
      context.beginPath();
      context.moveTo(hair, -245);
      context.lineTo(hair + Math.sin(phase * 2 + hair) * 15, -170);
      context.stroke();
    }
    context.restore();

    if (variant === "occlusion" || frameIndex % 45 >= 30) {
      context.fillStyle = "rgba(245, 238, 220, 0.82)";
      context.fillRect(width * 0.46, height * 0.22, width * 0.17, height * 0.62);
    }
    if (variant === "low-light") {
      context.fillStyle = "rgba(0, 0, 0, 0.45)";
      context.fillRect(0, 0, width, height);
    }
  }

  function drawMask(context, frameIndex, variant) {
    const position = subjectPosition(frameIndex);
    const erosion = variant === "boundary" || variant === "low-light" ? 0.9 : 1;
    const motionFrame = variant === "motion-lag" ? Math.max(0, frameIndex - 5) : frameIndex;
    const actualPosition = subjectPosition(motionFrame);
    context.clearRect(0, 0, width, height);
    context.save();
    context.translate(actualPosition.x, actualPosition.y);
    context.scale(actualPosition.scale * erosion, actualPosition.scale * erosion);
    context.fillStyle = "white";
    context.beginPath();
    context.ellipse(0, -145, 88, 104, 0, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.roundRect(-155, -55, 310, 300, 62);
    context.fill();
    context.restore();
    if (variant === "occlusion") {
      context.clearRect(width * 0.46, height * 0.22, width * 0.17, height * 0.62);
    }
    // Keep this read so static analysis does not mistake position for dead data
    // in the oracle path; the expected mask is intentionally based on the current
    // subject while a motion-lag candidate uses a stale position above.
    void position;
  }

  function drawReplacementBackground(context, frameIndex) {
    const phase = frameIndex / fps;
    const gradient = context.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, `hsl(${Math.round(180 + phase * 12) % 360} 48% 35%)`);
    gradient.addColorStop(1, `hsl(${Math.round(270 + phase * 8) % 360} 50% 22%)`);
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
    context.fillStyle = "rgba(235, 248, 255, 0.22)";
    for (let x = -height; x < width + height; x += 110) {
      context.beginPath();
      context.arc(x + (frameIndex % 110), height * 0.75, 45, 0, Math.PI * 2);
      context.fill();
    }
  }

  function cropRectangle(frameIndex) {
    const position = subjectPosition(frameIndex);
    const cropWidth = width * 0.62;
    const cropHeight = height * 0.86;
    return {
      x: Math.max(0, Math.min(width - cropWidth, position.x - cropWidth / 2)),
      y: Math.max(0, Math.min(height - cropHeight, position.y - cropHeight / 2)),
      width: cropWidth,
      height: cropHeight,
    };
  }

  function renderTransform(sourceCanvas, outputCanvas, maskCanvas, frameIndex, kind, maskVariant) {
    const sourceContext = sourceCanvas.getContext("2d");
    const outputContext = outputCanvas.getContext("2d");
    if (kind === "crop" || kind === "autoframe") {
      const crop = cropRectangle(frameIndex);
      outputContext.clearRect(0, 0, width, height);
      outputContext.drawImage(sourceCanvas, crop.x, crop.y, crop.width, crop.height, 0, 0, width, height);
      return;
    }

    drawMask(maskCanvas.getContext("2d"), frameIndex, maskVariant || "oracle");
    outputContext.clearRect(0, 0, width, height);
    if (kind === "blur" && "filter" in outputContext) {
      outputContext.save();
      outputContext.filter = "blur(12px)";
      outputContext.drawImage(sourceCanvas, 0, 0);
      outputContext.restore();
    } else {
      outputContext.drawImage(sourceCanvas, 0, 0);
    }
    outputContext.save();
    outputContext.globalCompositeOperation = "destination-in";
    outputContext.drawImage(maskCanvas, 0, 0);
    outputContext.restore();
    outputContext.save();
    outputContext.globalCompositeOperation = "destination-over";
    drawReplacementBackground(outputContext, frameIndex);
    outputContext.restore();
    void sourceContext;
  }

  function observeOutputVideo(video, activeState, latencyValues) {
    const callbackStart = now();
    const output = { callbacks: 0, firstCallbackMs: null, lastCallbackMs: null };
    function callback(timestamp) {
      if (!activeState.active) return;
      output.callbacks += 1;
      output.lastCallbackMs = timestamp;
      if (output.firstCallbackMs === null) output.firstCallbackMs = timestamp - callbackStart;
      if (activeState.lastTransformDone !== null) {
        latencyValues.push(Math.max(0, now() - activeState.lastTransformDone));
      }
      video.requestVideoFrameCallback(callback);
    }
    if (typeof video.requestVideoFrameCallback === "function") {
      video.requestVideoFrameCallback(callback);
    }
    return output;
  }

  async function playVideo(video) {
    try {
      const playPromise = video.play();
      await Promise.race([playPromise, sleep(500)]);
      return video.paused ? { started: false, timeout: true } : true;
    } catch (error) {
      return { error: String(error) };
    }
  }

  function trackCapabilities(track) {
    return track
      ? { kind: track.kind, readyState: track.readyState, enabled: track.enabled, muted: track.muted }
      : null;
  }

  async function recorderSignal(stream) {
    if (typeof MediaRecorder !== "function") return { supported: false };
    let recorder;
    try {
      recorder = new MediaRecorder(stream);
    } catch (error) {
      return { supported: true, created: false, error: String(error) };
    }
    let chunks = 0;
    let bytes = 0;
    recorder.ondataavailable = (event) => {
      chunks += 1;
      bytes += event.data.size;
    };
    try {
      recorder.start(250);
      await sleep(700);
      recorder.stop();
      await new Promise((resolve) => {
        recorder.onstop = resolve;
        setTimeout(resolve, 1000);
      });
      return { supported: true, created: true, chunks, bytes };
    } catch (error) {
      return { supported: true, created: true, error: String(error), chunks, bytes };
    }
  }

  function rtcSignal(track) {
    if (!track || typeof RTCPeerConnection !== "function") return { supported: false };
    let peer;
    try {
      peer = new RTCPeerConnection();
      const sender = peer.addTrack(track, new MediaStream([track]));
      const result = { supported: true, senderKind: sender.track && sender.track.kind };
      peer.close();
      return result;
    } catch (error) {
      if (peer) peer.close();
      return { supported: true, error: String(error) };
    }
  }

  function createObserver() {
    const state = { count: 0, totalMs: 0, maxMs: 0 };
    if (typeof PerformanceObserver !== "function") return state;
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          state.count += 1;
          state.totalMs += entry.duration;
          state.maxMs = Math.max(state.maxMs, entry.duration);
        }
      });
      observer.observe({ type: "longtask", buffered: true });
      state.disconnect = () => observer.disconnect();
    } catch (error) {
      state.error = String(error);
    }
    return state;
  }

  function commonResult(modeName, startTime, finishTime, metrics) {
    const measuredMs = Math.max(1, finishTime - startTime);
    const memoryAfter = memorySignal();
    const longTasks = metrics.longTasks || { count: 0, totalMs: 0, maxMs: 0 };
    if (typeof longTasks.disconnect === "function") longTasks.disconnect();
    return {
      mode: modeName,
      browser: {
        userAgent: navigator.userAgent,
        isSecureContext: window.isSecureContext,
        crossOriginIsolated: window.crossOriginIsolated,
      },
      input: { width, height, fps, frameIntervalMs: intervalMs },
      schedule: {
        warmupMs,
        measureMs: Number(measuredMs.toFixed(3)),
        requestedOverloadMs: metrics.requestedOverloadMs || 0,
      },
      startupMs: metrics.startupMs === null ? null : Number(metrics.startupMs.toFixed(3)),
      throughputFps: Number(((metrics.processedFrames / measuredMs) * 1000).toFixed(3)),
      processedFrames: metrics.processedFrames,
      outputFrames: metrics.outputFrames,
      droppedInputFrames: metrics.droppedInputFrames || 0,
      droppedOutputFrames: metrics.droppedOutputFrames || 0,
      processingMs: summary(metrics.processingDurations || []),
      endToEndMs: summary(metrics.latencyValues || []),
      transferMs: summary(metrics.transferDurations || []),
      mainThreadLongTasks: {
        count: longTasks.count,
        totalMs: Number(longTasks.totalMs.toFixed(3)),
        maxMs: Number(longTasks.maxMs.toFixed(3)),
      },
      memory: {
        before: metrics.memoryBefore,
        after: memoryAfter,
        deltaBytes:
          metrics.memoryBefore.bytes !== null && memoryAfter.bytes !== null
            ? memoryAfter.bytes - metrics.memoryBefore.bytes
            : null,
      },
      outputVideo: metrics.outputVideo,
      interoperability: metrics.interoperability,
      overloadRecovery: metrics.overloadRecovery || null,
      cleanup: metrics.cleanup,
      notes: metrics.notes || [],
    };
  }

  async function runCanvasMain(kind, overload) {
    const sourceCanvas = makeCanvas();
    const outputCanvas = makeCanvas();
    const maskCanvas = makeCanvas();
    const sourceContext = sourceCanvas.getContext("2d");
    const sourceStream = sourceCanvas.captureStream(fps);
    const outputStream = outputCanvas.captureStream(fps);
    const sourceTrack = sourceStream.getVideoTracks()[0];
    const outputTrack = outputStream.getVideoTracks()[0];
    outputVideo.srcObject = outputStream;
    const memoryBefore = memorySignal();
    const longTasks = createObserver();
    const startupStart = now();
    const activeState = { active: true, lastTransformDone: null };
    const latencyValues = [];
    const videoObserver = observeOutputVideo(outputVideo, activeState, latencyValues);
    const played = await playVideo(outputVideo);
    const startupMs = now() - startupStart;
    const processingDurations = [];
    let processedFrames = 0;
    let droppedInputFrames = 0;
    let previousFrameIndex = -1;
    let sourceFrameIndex = 0;
    let measured = false;
    let measureStart = 0;
    let timer;
    const runStart = now();

    const tick = () => {
      const frameIndex = sourceFrameIndex++;
      if (previousFrameIndex >= 0 && frameIndex > previousFrameIndex + 1) {
        droppedInputFrames += frameIndex - previousFrameIndex - 1;
      }
      previousFrameIndex = frameIndex;
      const start = now();
      drawScene(sourceContext, frameIndex, frameIndex % 90 >= 60 ? "occlusion" : "motion");
      renderTransform(sourceCanvas, outputCanvas, maskCanvas, frameIndex, kind, "oracle");
      if (overload) busyWait(overloadMs);
      const finish = now();
      if (!measured && finish - runStart >= warmupMs) {
        measured = true;
        measureStart = finish;
        processingDurations.length = 0;
        latencyValues.length = 0;
        droppedInputFrames = 0;
      }
      if (measured && finish - measureStart <= measureMs) {
        processingDurations.push(finish - start);
        processedFrames += 1;
        activeState.lastTransformDone = finish;
      }
      if (measured && finish - measureStart > measureMs + 150) {
        clearInterval(timer);
      }
    };

    timer = setInterval(tick, intervalMs);
    await sleep(warmupMs + measureMs + 300);
    clearInterval(timer);
    activeState.active = false;
    const finish = now();
    const recorder = runInterop ? await recorderSignal(outputStream) : { skipped: true, enableWith: "interop=1" };
    const rtc = runInterop ? rtcSignal(outputTrack) : { skipped: true, enableWith: "interop=1" };
    const rawOutputQuality = typeof outputVideo.getVideoPlaybackQuality === "function"
      ? outputVideo.getVideoPlaybackQuality()
      : null;
    const outputQuality = rawOutputQuality
      ? {
          totalVideoFrames: rawOutputQuality.totalVideoFrames,
          droppedVideoFrames: rawOutputQuality.droppedVideoFrames,
        }
      : null;
    sourceTrack.stop();
    outputTrack.stop();
    outputVideo.pause();
    outputVideo.srcObject = null;
    await sleep(100);
    return commonResult(`canvas-main-${kind}${overload ? "-overload" : ""}`, measureStart, finish, {
      startupMs,
      processedFrames,
      outputFrames: videoObserver.callbacks,
      droppedInputFrames,
      droppedOutputFrames: outputQuality ? outputQuality.droppedVideoFrames : 0,
      processingDurations,
      latencyValues,
      transferDurations: [],
      requestedOverloadMs: overload || 0,
      longTasks,
      memoryBefore,
      outputVideo: { played, callbacks: videoObserver.callbacks, quality: outputQuality },
      interoperability: { recorder, rtc },
      overloadRecovery: overload
        ? {
            observedFps: Number(((processedFrames / Math.max(1, finish - measureStart)) * 1000).toFixed(3)),
            recovered: processedFrames > 0,
            definition: "main-thread scheduler remained live after the deliberate busy wait",
          }
        : null,
      cleanup: {
        sourceTrackAfterStop: trackCapabilities(sourceTrack),
        outputTrackAfterStop: trackCapabilities(outputTrack),
        videoDetached: outputVideo.srcObject === null,
      },
      notes: [
        "Canvas capture is the rendered-output fallback category; it does not exercise a segmentation model.",
        "CPU and memory are browser-page signals. Use external process profiling for release claims.",
      ],
    });
  }

  function workerSource() {
    return `
      let canvas;
      let context;
      let cancelled = false;
      function wait(ms) {
        const iterations = Math.max(1, Math.round(ms * 100000));
        let value = 0;
        for (let index = 0; index < iterations; index += 1) {
          value = (value + index * 17) % 1000003;
        }
        return value;
      }
      self.onmessage = (event) => {
        const data = event.data;
        if (data.type === "init") {
          canvas = new OffscreenCanvas(data.width, data.height);
          context = canvas.getContext("2d");
          self.postMessage({ type: "ready", supported: Boolean(context) });
          return;
        }
        if (data.type === "cancel") {
          cancelled = true;
          return;
        }
        if (data.type === "frame") {
          if (cancelled) {
            if (data.bitmap && data.bitmap.close) data.bitmap.close();
            return;
          }
          const started = performance.now();
          context.clearRect(0, 0, data.width, data.height);
          context.drawImage(data.bitmap, 0, 0, data.width, data.height);
          if (data.kind === "replacement") {
            context.globalAlpha = 0.18;
            context.fillStyle = "#14244a";
            context.fillRect(0, 0, data.width, data.height);
            context.globalAlpha = 1;
          }
          if (data.overloadMs) wait(data.overloadMs);
          if (data.bitmap && data.bitmap.close) data.bitmap.close();
          const result = canvas.transferToImageBitmap();
          self.postMessage({
            type: "result",
            index: data.index,
            sentAt: data.sentAt,
            started,
            finished: performance.now(),
            result,
          }, [result]);
        }
      };
    `;
  }

  async function runWorkerTransfer(overload) {
    const sourceCanvas = makeCanvas();
    const outputCanvas = makeCanvas();
    const sourceContext = sourceCanvas.getContext("2d");
    const outputContext = outputCanvas.getContext("2d");
    const sourceStream = sourceCanvas.captureStream(fps);
    const outputStream = outputCanvas.captureStream(fps);
    const sourceTrack = sourceStream.getVideoTracks()[0];
    const outputTrack = outputStream.getVideoTracks()[0];
    outputVideo.srcObject = outputStream;
    const workerUrl = URL.createObjectURL(new Blob([workerSource()], { type: "text/javascript" }));
    const worker = new Worker(workerUrl);
    const workerStartupStart = now();
    let workerReady = false;
    let inFlight = false;
    let cancelled = false;
    let pendingFrames = 0;
    let processedFrames = 0;
    let droppedInputFrames = 0;
    let sourceFrameIndex = 0;
    let previousFrameIndex = -1;
    let measureStart = 0;
    let measured = false;
    let timer;
    const processingDurations = [];
    const transferDurations = [];
    const latencyValues = [];
    const activeState = { active: true, lastTransformDone: null };
    const outputObserver = observeOutputVideo(outputVideo, activeState, latencyValues);
    const longTasks = createObserver();
    const memoryBefore = memorySignal();
    const played = await playVideo(outputVideo);
    const workerReadyPromise = new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(false), 1000);
      worker.onmessage = (event) => {
        if (event.data.type === "ready") {
          clearTimeout(timeout);
          workerReady = event.data.supported;
          resolve(workerReady);
          return;
        }
        if (event.data.type === "result") {
          pendingFrames = Math.max(0, pendingFrames - 1);
          inFlight = false;
          if (cancelled) {
            if (event.data.result && event.data.result.close) event.data.result.close();
            return;
          }
          const received = now();
          outputContext.drawImage(event.data.result, 0, 0, width, height);
          if (event.data.result && event.data.result.close) event.data.result.close();
          const transformDone = event.data.finished;
          if (measured && transformDone - measureStart <= measureMs) {
            processedFrames += 1;
            processingDurations.push(event.data.finished - event.data.started);
            transferDurations.push(received - event.data.sentAt);
            activeState.lastTransformDone = received;
          }
          return;
        }
      };
      worker.onerror = () => {
        clearTimeout(timeout);
        resolve(false);
      };
    });
    worker.postMessage({ type: "init", width, height });
    const workerReadyResult = await workerReadyPromise;
    const startupMs = now() - workerStartupStart;
    const runStart = now();

    const tick = () => {
      const frameIndex = sourceFrameIndex++;
      if (previousFrameIndex >= 0 && frameIndex > previousFrameIndex + 1) {
        droppedInputFrames += frameIndex - previousFrameIndex - 1;
      }
      previousFrameIndex = frameIndex;
      const current = now();
      drawScene(sourceContext, frameIndex, frameIndex % 90 >= 60 ? "occlusion" : "motion");
      if (!measured && current - runStart >= warmupMs) {
        measured = true;
        measureStart = current;
        droppedInputFrames = 0;
      }
      if (measured && current - measureStart <= measureMs && inFlight) {
        droppedInputFrames += 1;
        return;
      }
      if (measured && current - measureStart > measureMs + 200) {
        clearInterval(timer);
        return;
      }
      if (inFlight || cancelled) {
        if (measured) droppedInputFrames += 1;
        return;
      }
      inFlight = true;
      pendingFrames += 1;
      const sentAt = now();
      createImageBitmap(sourceCanvas)
        .then((bitmap) => {
          if (cancelled) {
            bitmap.close();
            inFlight = false;
            pendingFrames = Math.max(0, pendingFrames - 1);
            return;
          }
          worker.postMessage(
            { type: "frame", bitmap, index: frameIndex, sentAt, width, height, kind: "replacement", overloadMs: overload || 0 },
            [bitmap],
          );
        })
        .catch(() => {
          inFlight = false;
          pendingFrames = Math.max(0, pendingFrames - 1);
        });
    };
    timer = setInterval(tick, intervalMs);
    await sleep(warmupMs + measureMs + 400);
    clearInterval(timer);
    activeState.active = false;
    cancelled = true;
    worker.postMessage({ type: "cancel" });
    const finish = now();
    await sleep(100);
    const recorder = runInterop ? await recorderSignal(outputStream) : { skipped: true, enableWith: "interop=1" };
    const rtc = runInterop ? rtcSignal(outputTrack) : { skipped: true, enableWith: "interop=1" };
    const rawOutputQuality = typeof outputVideo.getVideoPlaybackQuality === "function"
      ? outputVideo.getVideoPlaybackQuality()
      : null;
    const outputQuality = rawOutputQuality
      ? {
          totalVideoFrames: rawOutputQuality.totalVideoFrames,
          droppedVideoFrames: rawOutputQuality.droppedVideoFrames,
        }
      : null;
    sourceTrack.stop();
    outputTrack.stop();
    outputVideo.pause();
    outputVideo.srcObject = null;
    worker.terminate();
    URL.revokeObjectURL(workerUrl);
    await sleep(100);
    return commonResult(`worker-transfer${overload ? "-overload" : ""}`, measureStart, finish, {
      startupMs,
      processedFrames,
      outputFrames: outputObserver.callbacks,
      droppedInputFrames,
      droppedOutputFrames: outputQuality ? outputQuality.droppedVideoFrames : 0,
      processingDurations,
      latencyValues,
      transferDurations,
      requestedOverloadMs: overload || 0,
      longTasks,
      memoryBefore,
      outputVideo: { played, callbacks: outputObserver.callbacks, quality: outputQuality },
      interoperability: { recorder, rtc },
      overloadRecovery: overload
        ? {
            observedFps: Number(((processedFrames / Math.max(1, finish - measureStart)) * 1000).toFixed(3)),
            recovered: processedFrames > 0 && pendingFrames === 0,
            definition: "latest-frame backpressure kept the worker bounded after deliberate worker overload",
          }
        : null,
      cleanup: {
        sourceTrackAfterStop: trackCapabilities(sourceTrack),
        outputTrackAfterStop: trackCapabilities(outputTrack),
        workerTerminated: true,
        pendingFrames,
        inFlight,
      },
      notes: [
        "The worker path transfers ImageBitmap into a bounded single-frame queue and transfers an ImageBitmap back.",
        workerReadyResult ? "Off-main-thread OffscreenCanvas path was available." : "Worker/OffscreenCanvas path was unavailable or timed out.",
      ],
    });
  }

  async function runRawTrack(overload) {
    const processorConstructor = window.MediaStreamTrackProcessor;
    const generatorConstructor = window.VideoTrackGenerator || window.MediaStreamTrackGenerator;
    if (typeof processorConstructor !== "function" || typeof generatorConstructor !== "function") {
      return {
        mode: `raw-track${overload ? "-overload" : ""}`,
        status: "unsupported",
        reason: "MediaStreamTrackProcessor and a video generator constructor were not both exposed in Window",
        capabilities: {
          MediaStreamTrackProcessor: typeof processorConstructor,
          VideoTrackGenerator: typeof window.VideoTrackGenerator,
          MediaStreamTrackGenerator: typeof window.MediaStreamTrackGenerator,
        },
      };
    }

    const sourceCanvas = makeCanvas();
    const outputCanvas = makeCanvas();
    const sourceContext = sourceCanvas.getContext("2d");
    const processingContext = outputCanvas.getContext("2d");
    drawScene(sourceContext, 0, "motion");
    const sourceStream = sourceCanvas.captureStream(fps);
    const sourceTrack = sourceStream.getVideoTracks()[0];
    let processor;
    let generator;
    try {
      processor = new processorConstructor({ track: sourceTrack });
      generator = new generatorConstructor({ kind: "video" });
    } catch (error) {
      sourceTrack.stop();
      return {
        mode: `raw-track${overload ? "-overload" : ""}`,
        status: "unsupported",
        reason: String(error),
      };
    }
    // Chromium's legacy MediaStreamTrackGenerator is itself a track, while
    // the current VideoTrackGenerator draft exposes the track as .track.
    const generatedTrack = generator.track || generator;
    const generatedWritable = generator.writable || (generator.track && generator.track.writable);
    const outputStream = new MediaStream([generatedTrack]);
    const outputTrack = outputStream.getVideoTracks()[0];
    outputVideo.srcObject = outputStream;
    const memoryBefore = memorySignal();
    const longTasks = createObserver();
    const latencyValues = [];
    const transferDurations = [];
    const activeState = { active: true, lastTransformDone: null };
    const outputObserver = observeOutputVideo(outputVideo, activeState, latencyValues);
    const played = await playVideo(outputVideo);
    const processingDurations = [];
    let processedFrames = 0;
    let droppedInputFrames = 0;
    let previousTimestamp = null;
    let measured = false;
    let measureStart = 0;
    let firstProcessedAt = null;
    const abortController = new AbortController();
    const transformer = new TransformStream({
      transform(frame, controller) {
        const started = now();
        const timestamp = frame.timestamp;
        if (previousTimestamp !== null && Number.isFinite(timestamp)) {
          const expected = Math.max(1, Math.round((timestamp - previousTimestamp) / (intervalMs * 1000)));
          if (expected > 1) droppedInputFrames += expected - 1;
        }
        previousTimestamp = timestamp;
        processingContext.clearRect(0, 0, width, height);
        processingContext.drawImage(frame, 0, 0, width, height);
        if (overload) busyWait(overloadMs);
        const outputFrame = new VideoFrame(outputCanvas, {
          timestamp: Number.isFinite(timestamp) ? timestamp : Math.round(started * 1000),
        });
        frame.close();
        controller.enqueue(outputFrame);
        const finished = now();
        if (firstProcessedAt === null) firstProcessedAt = finished;
        if (!measured && finished - pipelineStart >= warmupMs) {
          measured = true;
          measureStart = finished;
          droppedInputFrames = 0;
        }
        if (measured && finished - measureStart <= measureMs) {
          processedFrames += 1;
          processingDurations.push(finished - started);
          activeState.lastTransformDone = finished;
          if (typeof controller.desiredSize === "number") transferDurations.push(Math.max(0, 1 - controller.desiredSize));
        }
      },
    });
    const pipelineStart = now();
    let pipeError = null;
    const pipePromise = processor.readable
      .pipeThrough(transformer)
      .pipeTo(generatedWritable, { signal: abortController.signal })
      .catch((error) => {
        pipeError = String(error);
      });
    let sourceFrameIndex = 1;
    const sourceTimer = setInterval(() => {
      drawScene(sourceContext, sourceFrameIndex, sourceFrameIndex % 90 >= 60 ? "occlusion" : "motion");
      sourceFrameIndex += 1;
    }, intervalMs);
    await sleep(warmupMs + measureMs + 300);
    clearInterval(sourceTimer);
    activeState.active = false;
    abortController.abort();
    try {
      await Promise.race([pipePromise, sleep(500)]);
    } catch (error) {
      pipeError = String(error);
    }
    const finish = now();
    const recorder = runInterop ? await recorderSignal(outputStream) : { skipped: true, enableWith: "interop=1" };
    const rtc = runInterop ? rtcSignal(outputTrack) : { skipped: true, enableWith: "interop=1" };
    const rawOutputQuality = typeof outputVideo.getVideoPlaybackQuality === "function"
      ? outputVideo.getVideoPlaybackQuality()
      : null;
    const outputQuality = rawOutputQuality
      ? {
          totalVideoFrames: rawOutputQuality.totalVideoFrames,
          droppedVideoFrames: rawOutputQuality.droppedVideoFrames,
        }
      : null;
    sourceTrack.stop();
    outputTrack.stop();
    outputVideo.pause();
    outputVideo.srcObject = null;
    await sleep(100);
    return commonResult(`raw-track${overload ? "-overload" : ""}`, measureStart, finish, {
      startupMs: firstProcessedAt === null ? null : firstProcessedAt - pipelineStart,
      processedFrames,
      outputFrames: outputObserver.callbacks,
      droppedInputFrames,
      droppedOutputFrames: outputQuality ? outputQuality.droppedVideoFrames : 0,
      processingDurations,
      latencyValues,
      transferDurations,
      requestedOverloadMs: overload || 0,
      longTasks,
      memoryBefore,
      outputVideo: { played, callbacks: outputObserver.callbacks, quality: outputQuality },
      interoperability: { recorder, rtc },
      overloadRecovery: overload
        ? {
            observedFps: Number(((processedFrames / Math.max(1, finish - measureStart)) * 1000).toFixed(3)),
            recovered: processedFrames > 0 && pipeError !== null,
            definition: "abort/cancellation completed after deliberate transform overload",
          }
        : null,
      cleanup: {
        sourceTrackAfterStop: trackCapabilities(sourceTrack),
        outputTrackAfterStop: trackCapabilities(outputTrack),
        pipeSettled: pipeError !== null,
        pipeError,
      },
      notes: [
        "This path uses the constructor names exposed by the current browser; it is not a release-wide support claim.",
        "Input VideoFrames are closed in the transform; output frames are handed to the generator and the pipe is aborted on teardown.",
      ],
    });
  }

  function imageDataMetric(reference, candidate) {
    let absoluteError = 0;
    let squaredError = 0;
    let pixels = 0;
    for (let index = 0; index < reference.data.length; index += 4) {
      for (let channel = 0; channel < 3; channel += 1) {
        const difference = reference.data[index + channel] - candidate.data[index + channel];
        absoluteError += Math.abs(difference);
        squaredError += difference * difference;
      }
      pixels += 1;
    }
    const mae = absoluteError / (pixels * 3);
    const mse = squaredError / (pixels * 3);
    return {
      mae: Number(mae.toFixed(4)),
      psnrDb: mse === 0 ? null : Number((10 * Math.log10((255 * 255) / mse)).toFixed(4)),
    };
  }

  function maskMetric(reference, candidate) {
    let intersection = 0;
    let union = 0;
    let boundaryErrors = 0;
    for (let index = 0; index < reference.data.length; index += 4) {
      const expected = reference.data[index] > 127;
      const actual = candidate.data[index] > 127;
      if (expected && actual) intersection += 1;
      if (expected || actual) union += 1;
      if (expected !== actual) boundaryErrors += 1;
    }
    return {
      iou: union === 0 ? 1 : Number((intersection / union).toFixed(4)),
      differingPixels: boundaryErrors,
    };
  }

  function qualityScenario(variant) {
    const smallWidth = 320;
    const smallHeight = 180;
    const source = document.createElement("canvas");
    const oracle = document.createElement("canvas");
    const candidate = document.createElement("canvas");
    const expectedMask = document.createElement("canvas");
    const candidateMask = document.createElement("canvas");
    for (const canvas of [source, oracle, candidate, expectedMask, candidateMask]) {
      canvas.width = smallWidth;
      canvas.height = smallHeight;
    }
    const sourceContext = source.getContext("2d");
    const oracleContext = oracle.getContext("2d");
    const candidateContext = candidate.getContext("2d");
    const expectedMaskContext = expectedMask.getContext("2d");
    const candidateMaskContext = candidateMask.getContext("2d");
    const frameIndex = variant === "motion-lag" ? 28 : 12;
    drawSceneScaled(sourceContext, smallWidth, smallHeight, frameIndex, variant === "low-light" ? "low-light" : variant === "occlusion" ? "occlusion" : "motion");
    drawMaskScaled(expectedMaskContext, smallWidth, smallHeight, frameIndex, "oracle");
    drawMaskScaled(candidateMaskContext, smallWidth, smallHeight, frameIndex, variant);
    renderReplacementSmall(oracleContext, source, expectedMask, frameIndex);
    if (variant === "fallback") {
      candidateContext.drawImage(source, 0, 0);
    } else {
      renderReplacementSmall(candidateContext, source, candidateMask, frameIndex);
    }
    const originalMetric = imageDataMetric(oracleContext.getImageData(0, 0, smallWidth, smallHeight), sourceContext.getImageData(0, 0, smallWidth, smallHeight));
    const candidateMetric = imageDataMetric(oracleContext.getImageData(0, 0, smallWidth, smallHeight), candidateContext.getImageData(0, 0, smallWidth, smallHeight));
    const maskMetrics = maskMetric(expectedMaskContext.getImageData(0, 0, smallWidth, smallHeight), candidateMaskContext.getImageData(0, 0, smallWidth, smallHeight));
    return {
      variant,
      dimensions: `${smallWidth}x${smallHeight}`,
      baseline: { original: originalMetric },
      candidate: candidateMetric,
      mask: maskMetrics,
      interpretation: variant === "fallback"
        ? "Original-frame bypass is measured as a privacy/visual-effect gap, not a segmentation-quality failure."
        : "Synthetic mask/compositor repeatability only; no model inference is included.",
    };
  }

  function drawSceneScaled(context, sceneWidth, sceneHeight, frameIndex, variant) {
    context.save();
    context.scale(sceneWidth / width, sceneHeight / height);
    drawScene(context, frameIndex, variant);
    context.restore();
  }

  function drawMaskScaled(context, sceneWidth, sceneHeight, frameIndex, variant) {
    context.save();
    context.scale(sceneWidth / width, sceneHeight / height);
    drawMask(context, frameIndex, variant);
    context.restore();
  }

  function renderReplacementSmall(context, source, mask, frameIndex) {
    context.drawImage(source, 0, 0);
    context.save();
    context.globalCompositeOperation = "destination-in";
    context.drawImage(mask, 0, 0);
    context.restore();
    context.save();
    context.globalCompositeOperation = "destination-over";
    const gradient = context.createLinearGradient(0, 0, source.width, source.height);
    gradient.addColorStop(0, "#1d8795");
    gradient.addColorStop(1, "#23154f");
    context.fillStyle = gradient;
    context.fillRect(0, 0, source.width, source.height);
    context.restore();
    void frameIndex;
  }

  async function runQuality() {
    const variants = ["boundary", "motion-lag", "occlusion", "low-light", "fallback"];
    return {
      mode: "quality-synthetic",
      status: "measured",
      source: {
        dimensions: "320x180",
        scene: "deterministic moving foreground with high-contrast boundary, hair-like lines, occlusion stripe, and changing exposure",
        baseline: "oracle mask generated from the same known synthetic subject geometry",
      },
      scenarios: variants.map(qualityScenario),
      limitations: [
        "These scores validate a reproducible compositor/mask comparison harness; they do not estimate the quality of an unselected segmentation or face model.",
        "A release-quality corpus must add real representative faces, skin tones, hair, clothing, lighting, motion, and occlusion under an approved privacy/data policy.",
      ],
    };
  }

  async function run() {
    let result;
    if (mode === "capabilities") {
      result = { mode, status: "measured", capabilities: await browserCapabilities() };
    } else if (mode === "quality") {
      result = await runQuality();
    } else if (mode === "canvas-crop") {
      result = await runCanvasMain("crop", 0);
    } else if (mode === "canvas-replacement") {
      result = await runCanvasMain("replacement", 0);
    } else if (mode === "canvas-blur") {
      result = await runCanvasMain("blur", 0);
    } else if (mode === "canvas-overload") {
      result = await runCanvasMain("replacement", overloadMs);
    } else if (mode === "worker-transfer") {
      result = await runWorkerTransfer(0);
    } else if (mode === "worker-overload") {
      result = await runWorkerTransfer(overloadMs);
    } else if (mode === "raw-track") {
      result = await runRawTrack(0);
    } else if (mode === "raw-overload") {
      result = await runRawTrack(overloadMs);
    } else {
      result = { mode, status: "error", reason: "unknown mode" };
    }
    result.generatedAt = new Date().toISOString();
    window.__VIDEO_FEASIBILITY_RESULT__ = result;
    resultElement.textContent = JSON.stringify(result, null, 2);
  }

  run().catch((error) => {
    const result = { mode, status: "error", error: String(error), stack: error && error.stack };
    window.__VIDEO_FEASIBILITY_RESULT__ = result;
    resultElement.textContent = JSON.stringify(result, null, 2);
  });
})();
