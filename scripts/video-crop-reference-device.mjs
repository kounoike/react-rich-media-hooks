import { execFileSync, spawn } from "node:child_process";
import { readFile, writeFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const repoPath = path.resolve(path.dirname(scriptPath), "..");
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function withTimeout(promise, ms, message) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function optionsFor(args) {
  const options = {
    url: "http://localhost:4173/tests/browser/video-crop-benchmark.html",
    headless: false,
    synthetic: false,
    autorun: false,
    commit: null,
    chrome: null,
    output: null,
  };
  for (let i = 0; i < args.length; i += 1) {
    const flag = args[i];
    if (flag === "--") continue;
    if (flag === "--help") return { help: true };
    if (["--headless", "--synthetic", "--autorun"].includes(flag)) options[flag.slice(2)] = true;
    else if (["--url", "--commit", "--chrome", "--output"].includes(flag)) {
      const value = args[++i];
      if (value === undefined || value.startsWith("--"))
        throw new Error(`Missing value for ${flag}.`);
      options[flag.slice(2)] = value;
    } else throw new Error(`Unknown option: ${flag}`);
  }
  const url = new URL(options.url);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
    url.pathname !== "/tests/browser/video-crop-benchmark.html"
  )
    throw new Error("The URL must be a localhost video-crop-benchmark page.");
  if ((options.autorun || options.headless) && !options.synthetic)
    throw new Error(
      "--autorun and --headless require --synthetic; physical camera operation is manual.",
    );
  if (options.commit !== null && !/^[a-f\d]{40}$/iu.test(options.commit))
    throw new Error("--commit requires a full 40-character SHA.");
  return options;
}

function forwardFromWsl(options, args) {
  if (
    process.platform !== "linux" ||
    !readFileSync("/proc/sys/kernel/osrelease", "utf8").toLowerCase().includes("microsoft")
  )
    return false;
  const nativeNode = execFileSync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", "(Get-Command node -ErrorAction Stop).Source"],
    { encoding: "utf8" },
  ).trim();
  const executable = execFileSync("wslpath", ["-u", nativeNode], { encoding: "utf8" }).trim();
  const nativeScript = execFileSync("wslpath", ["-w", scriptPath], { encoding: "utf8" }).trim();
  const forwarded = [...args];
  if (options.commit === null)
    forwarded.push(
      "--commit",
      execFileSync("git", ["-C", repoPath, "rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    );
  if (options.output !== null) {
    const index = forwarded.indexOf("--output");
    forwarded[index + 1] = execFileSync("wslpath", ["-w", path.resolve(options.output)], {
      encoding: "utf8",
    }).trim();
  }
  const child = spawn(executable, [nativeScript, ...forwarded], { stdio: "inherit" });
  // The Windows process owns browser cleanup; let it observe Ctrl+C directly.
  process.on("SIGINT", () => {});
  child.on("error", (error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
  child.on("exit", (code) => {
    process.exitCode = code ?? 1;
  });
  return true;
}

async function connect(endpoint) {
  const socket = new WebSocket(endpoint);
  const pending = new Map();
  const listeners = new Set();
  let nextId = 0;
  let ended = false;
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  const closed = new Promise((resolve) =>
    socket.addEventListener("close", resolve, { once: true }),
  );
  socket.addEventListener("close", () => {
    ended = true;
    for (const entry of pending.values()) {
      clearTimeout(entry.timer);
      entry.reject(new Error("Owned Chrome connection closed."));
    }
    pending.clear();
  });
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id !== undefined) {
      const entry = pending.get(message.id);
      if (!entry) return;
      clearTimeout(entry.timer);
      pending.delete(message.id);
      if (message.error) entry.reject(new Error(message.error.message));
      else entry.resolve(message.result);
    } else for (const listener of listeners) listener(message);
  });
  return {
    closed,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    call(method, params = {}, sessionId) {
      if (ended) return Promise.reject(new Error("Owned Chrome connection is closed."));
      return new Promise((resolve, reject) => {
        const id = ++nextId;
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`CDP ${method} timed out.`));
        }, 30000);
        pending.set(id, { resolve, reject, timer });
        socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
      });
    },
  };
}

// Installed only in the dedicated target's main document; no camera click in manual mode.
function installController(settings) {
  let next = 0;
  const pending = new Map();
  window.videoCropBenchmarkHeapController = {
    protocol: "Chrome DevTools Protocol",
    browserVersion: settings.browserVersion,
    input: settings.synthetic ? "synthetic" : "physical-user-operated",
    collections: 0,
    nodeVersion: settings.nodeVersion,
  };
  window.__rrmhResolveHeap = (id, value, error) => {
    const entry = pending.get(id);
    if (!entry) return;
    pending.delete(id);
    if (error) entry.reject(new Error(error));
    else {
      window.videoCropBenchmarkHeapController.collections += 1;
      entry.resolve(value);
    }
  };
  window.videoCropBenchmarkCollectGarbage = () =>
    new Promise((resolve, reject) => {
      const id = ++next;
      pending.set(id, { resolve, reject });
      window.__rrmhHeapRequest(JSON.stringify({ id }));
    });
  window.addEventListener("video-crop-benchmark-result", () => {
    const record = window.videoCropBenchmarkRecord;
    if (record && record.status !== "running") window.__rrmhReport(JSON.stringify(record));
  });
  if (settings.synthetic) {
    const cleanup = [];
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      configurable: true,
      value: async () => {
        const canvas = document.createElement("canvas");
        canvas.width = 1280;
        canvas.height = 720;
        const context = canvas.getContext("2d", { alpha: false });
        if (!context) throw new Error("Synthetic input unavailable.");
        let frame = 0;
        const paint = () => {
          context.fillStyle = "#202020";
          context.fillRect(0, 0, 1280, 720);
          context.fillStyle = "#ffffff";
          context.fillRect((frame++ % 100) * 8, 100, 80, 80);
        };
        paint();
        const stream = canvas.captureStream(30);
        const track = stream.getVideoTracks()[0];
        const timer = setInterval(() => {
          paint();
          track.requestFrame?.();
        }, 1000 / 30);
        const stop = track.stop.bind(track);
        track.stop = () => {
          clearInterval(timer);
          stop();
        };
        cleanup.push(() => clearInterval(timer));
        return stream;
      },
    });
    window.addEventListener("pagehide", () => cleanup.forEach((stop) => stop()));
    window.addEventListener("video-crop-benchmark-result", () => cleanup.forEach((stop) => stop()));
  }
  const ready = async () => {
    if (window.videoCropBenchmarkProtocolVersion !== "endpoint-gc-v1")
      throw new Error("The page collector is incompatible; use the current task-worktree page.");
    const values = {
      "commit-sha": settings.commit,
      "host-description": settings.host,
      "runtime-description": settings.runtime,
      "camera-description": settings.synthetic
        ? "Synthetic canvas; no physical camera"
        : "Default camera; actual model is recorded after Start",
    };
    for (const [id, value] of Object.entries(values)) {
      const input = document.getElementById(id);
      if (input && !input.value) input.value = value;
    }
    const note = document.getElementById("heap-controller-status");
    if (note) {
      note.textContent = "GC計測接続済み — 操作の前後でGC後のヒープを自動計測します。";
      note.dataset.state = "ok";
    }
    window.__rrmhReady("ready");
    if (!settings.autorun) return;
    document.getElementById("physical-camera-confirm").checked = true;
    document.getElementById("start-camera").click();
    const start = performance.now();
    while (document.getElementById("run-measurements").disabled) {
      if (performance.now() - start > 15000) throw new Error("Synthetic camera startup timed out.");
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    document.getElementById("run-measurements").click();
  };
  document.addEventListener(
    "DOMContentLoaded",
    () => void ready().catch((error) => window.__rrmhReady(`error: ${error.message}`)),
    { once: true },
  );
}

async function run(options) {
  if (typeof WebSocket !== "function")
    throw new Error("The reference launcher requires Node 22 or newer.");
  const chrome =
    options.chrome ??
    (process.platform === "win32"
      ? path.join(
          process.env.ProgramFiles ?? "C:/Program Files",
          "Google",
          "Chrome",
          "Application",
          "chrome.exe",
        )
      : "/usr/bin/google-chrome");
  if (!existsSync(chrome))
    throw new Error(`Chrome executable not found: ${chrome}. Use --chrome <path>.`);
  const commit =
    options.commit ??
    execFileSync("git", ["-C", repoPath, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const output = path.resolve(
    options.output ?? path.join(repoPath, ".artifacts", "reference-device"),
  );
  await mkdir(output, { recursive: true });
  const response = await fetch(options.url, { signal: AbortSignal.timeout(5000) });
  if (!response.ok)
    throw new Error(
      `Benchmark server returned ${response.status}; start the task-worktree Vite server first.`,
    );
  const html = await response.text();
  if (!html.includes('name="video-crop-benchmark-protocol" content="endpoint-gc-v1"'))
    throw new Error(
      "The server is serving an older benchmark page; serve the current task worktree or select its URL.",
    );
  const profile = await mkdtemp(path.join(os.tmpdir(), "rrmh-crop-reference-"));
  const args = [
    `--user-data-dir=${profile}`,
    "--remote-debugging-port=0",
    "--no-first-run",
    "--no-default-browser-check",
    "--autoplay-policy=no-user-gesture-required",
  ];
  if (options.headless) args.push("--headless=new");
  if (options.synthetic)
    args.push("--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream");
  args.push("about:blank");
  const child = spawn(chrome, args, { stdio: "ignore" });
  let cdp;
  let serial = Promise.resolve();
  let saved = 0;
  let collected = 0;
  let readyResolve;
  let readyReject;
  const ready = new Promise((resolve, reject) => {
    readyResolve = resolve;
    readyReject = reject;
  });
  let resultResolve;
  const result = new Promise((resolve) => {
    resultResolve = resolve;
  });
  try {
    let active;
    for (let attempt = 0; attempt < 60; attempt += 1) {
      try {
        active = (await readFile(path.join(profile, "DevToolsActivePort"), "utf8"))
          .trim()
          .split(/\r?\n/u);
        break;
      } catch {
        await delay(200);
      }
    }
    if (!active)
      throw new Error(`Owned Chrome debug endpoint unavailable; retained profile: ${profile}`);
    const version = await (
      await fetch(`http://127.0.0.1:${Number(active[0])}/json/version`)
    ).json();
    if (!version.webSocketDebuggerUrl.endsWith(active[1]))
      throw new Error("Debug endpoint does not match the newly created profile.");
    cdp = await connect(version.webSocketDebuggerUrl);
    const { targetInfos } = await cdp.call("Target.getTargets");
    const target = targetInfos.find(
      (entry) => entry.type === "page" && entry.url === "about:blank",
    );
    if (!target) throw new Error("Owned initial Chrome page is unavailable.");
    const { sessionId } = await cdp.call("Target.attachToTarget", {
      targetId: target.targetId,
      flatten: true,
    });
    const pageCall = (method, params = {}) => cdp.call(method, params, sessionId);
    await pageCall("Runtime.enable");
    await pageCall("Page.enable");
    for (const name of ["__rrmhHeapRequest", "__rrmhReport", "__rrmhReady"])
      await pageCall("Runtime.addBinding", { name });
    cdp.subscribe((message) => {
      if (message.sessionId !== sessionId || message.method !== "Runtime.bindingCalled") return;
      const { name, payload, executionContextId } = message.params;
      if (name === "__rrmhReady") {
        if (payload === "ready") readyResolve();
        else readyReject(new Error(payload));
        return;
      }
      if (name === "__rrmhHeapRequest") {
        serial = serial
          .then(async () => {
            const { id } = JSON.parse(payload);
            if (!Number.isSafeInteger(id) || id < 1) throw new Error("Invalid heap request ID.");
            let value = null;
            let error = null;
            try {
              await pageCall("HeapProfiler.collectGarbage");
              const heap = await pageCall("Runtime.getHeapUsage");
              value = heap.usedSize;
              if (!Number.isFinite(value) || value < 0)
                throw new Error("CDP returned invalid used heap.");
              collected += 1;
            } catch (cause) {
              error = cause.message;
            }
            await pageCall("Runtime.evaluate", {
              contextId: executionContextId,
              expression: `window.__rrmhResolveHeap(${id}, ${JSON.stringify(value)}, ${JSON.stringify(error)})`,
            });
          })
          .catch((error) => console.error(`GC bridge error: ${error.message}`));
      } else if (name === "__rrmhReport") {
        serial = serial
          .then(async () => {
            const report = JSON.parse(payload);
            if (
              report.taskId !== "TASK-1.25" ||
              !["completed", "failed", "stopped"].includes(report.status)
            )
              throw new Error("Unexpected benchmark report.");
            const filename = `camera-crop-${String(report.startedAt).replace(/[^\dT]/gu, "_")}.json`;
            const destination = path.join(output, filename);
            await writeFile(destination, JSON.stringify(report, null, 2) + "\n");
            saved += 1;
            console.log(`Report saved: ${destination}`);
            console.log(
              JSON.stringify({
                status: report.status,
                garbageCollections: collected,
                retainedHeapWithinBudget: report.retainedHeapGrowthWithinBudget,
                liveTracks:
                  report.cleanup?.liveTracksAfterDispose ?? report.cleanup?.liveTracksAfterStop,
                cropFps: report.stages
                  .filter((stage) => stage.profile === "fixed-crop")
                  .map((stage) => stage.frameRateFps),
                cropP95: report.stages
                  .filter((stage) => stage.profile === "fixed-crop")
                  .map((stage) => stage.sourceToPreviewP95Ms),
              }),
            );
            resultResolve(report);
          })
          .catch((error) => console.error(`Report write error: ${error.message}`));
      }
    });
    const settings = {
      commit,
      synthetic: options.synthetic,
      autorun: options.autorun,
      browserVersion: version.Browser,
      nodeVersion: process.version,
      host: `${os.type()} ${os.release()} · ${os.cpus()[0]?.model ?? "CPU unknown"}`,
      runtime: `Node ${process.version} (GC controller); repository ${JSON.parse(readFileSync(path.join(repoPath, "package.json"), "utf8")).packageManager}; Vite ${new URL(options.url).origin}`,
    };
    await pageCall("Page.addScriptToEvaluateOnNewDocument", {
      source: `(${installController.toString()})(${JSON.stringify(settings)});`,
    });
    await pageCall("Page.navigate", { url: options.url });
    await withTimeout(ready, 15000, "GC page setup timed out.");
    console.log(`Controlled-GC page ready: ${options.url}`);
    console.log(
      "Use Start camera and Run measurements in the dedicated window. Reports are saved locally; close this window to finish.",
    );
    const interrupt = () => void cdp.call("Browser.close").catch(() => {});
    process.once("SIGINT", interrupt);
    try {
      if (options.autorun) {
        const report = await withTimeout(
          Promise.race([
            result,
            cdp.closed.then(() => {
              throw new Error("Chrome closed before a result was saved.");
            }),
          ]),
          120000,
          "Synthetic benchmark timed out.",
        );
        if (
          report.status !== "completed" ||
          collected !== 4 ||
          report.retainedHeapGrowthWithinBudget !== true ||
          report.cleanup?.liveTracksAfterDispose !== 0
        )
          throw new Error("Synthetic GC benchmark did not satisfy its protocol checks.");
      } else await cdp.closed;
    } finally {
      process.removeListener("SIGINT", interrupt);
    }
  } finally {
    await serial;
    if (cdp) {
      try {
        await cdp.call("Browser.close");
      } catch {}
      await cdp.closed;
    } else child.kill();
    if (cdp) {
      try {
        await rm(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
      } catch {
        console.error(`Retained owned profile: ${profile}`);
      }
    }
    console.log(
      `Reference session ended; ${saved} report write(s), ${collected} GC observation(s).`,
    );
  }
}

try {
  const args = process.argv.slice(2);
  const options = optionsFor(args);
  if (options.help)
    console.log(
      "Usage: node scripts/video-crop-reference-device.mjs [--url <localhost benchmark URL>] [--commit <40-char SHA>] [--chrome <path>] [--output <directory>]\nDefault: user-operated physical camera. Synthetic verification only: --synthetic --headless --autorun. WSL forwards to the installed Windows Node and Chrome.",
    );
  else if (!forwardFromWsl(options, args)) await run(options);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
