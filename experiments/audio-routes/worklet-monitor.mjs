(() => {
  const Base = AudioWorkletNode;
  window.nativeKernelTimes = new Float64Array(72000);
  window.nativeKernelCount = 0;
  window.nativeRealtimeFault = null;
  window.AudioWorkletNode = class extends Base {
    constructor(context, name, options) {
      super(context, name, options);
      if (name === "rnnoise-noise-reduction") {
        const began = performance.now();
        this.port.addEventListener("message", ({ data }) => {
          if (data.type === "timing" && window.nativeKernelCount < 72000)
            window.nativeKernelTimes[window.nativeKernelCount++] = data.processingMs;
          if (data.type === "fault")
            window.nativeRealtimeFault = {
              ...data,
              elapsedSinceNodeMs: performance.now() - began,
              observedKernelTimings: window.nativeKernelCount,
            };
        });
      }
    }
  };
  Object.assign(window.nativeResearchOptions, {
    mode: "endurance",
    duration: 600,
    windows: 60,
    cases: ["current-next"],
  });
  return "Existing Worklet kernel messages observed; no audio-thread instrumentation or guard changes";
})();
