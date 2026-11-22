// Install after native-setup.mjs, before clicking; bounded instrumentation only, never package code.
(() => {
  const NativeWorker = Worker;
  window.privateWorkerEvidence = [];
  globalThis.Worker = class extends NativeWorker {
    constructor(url, options) {
      super(url, options);
      if (options?.name !== "rnnoise-raw-audio") return;
      const record = { url: String(url), prepared: false, ready: [], faults: [], diagnostics: [], stopped: false, closeRequested: false, processingMs: [] };
      window.privateWorkerEvidence.push(record);
      const nativePost = this.postMessage.bind(this);
      this.postMessage = (...args) => { if (args[0]?.type === "stop") record.closeRequested = true; return nativePost(...args); };
      this.addEventListener("message", ({ data }) => {
        if (data.type === "prepared") record.prepared = true;
        if (data.type === "ready") record.ready.push(data);
        if (data.type === "fault") record.faults.push({ ...data, duringClose: record.closeRequested });
        if (data.type === "diagnostics" && record.diagnostics.length < 900) record.diagnostics.push(data);
        if (data.type === "stopped") record.stopped = true;
        if (data.type === "timing" && record.processingMs.length < 90000) record.processingMs.push(data.processingMs);
      });
    }
  };
  window.nativeResearchOptions = { ...window.nativeResearchOptions, artifacts: { c: "/src/effects/audio/assets/rnnoise.wasm" }, cases: ["private-session-c"], mode: "screen", windows: 8 };
  return { privateWorkerInstrumentation: true, cases: window.nativeResearchOptions.cases };
})();
