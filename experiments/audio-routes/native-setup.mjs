// Install only in an owned local fixture tab; CLI clicks start local, muted research.
(() => {
  const button = document.createElement("button");
  button.id = "task112-run";
  button.textContent = "Run local generated-audio research";
  const status = document.createElement("p");
  status.id = "task112-status";
  status.textContent = "Ready; fixture audio stays local and output is muted.";
  document.body.append(button, status);
  window.nativeResearchOptions = {
    artifacts: {
      c: "/src/effects/audio/assets/rnnoise.wasm",
      next: "/.cache/audio-optimized/zig-simd128.wasm",
    },
    inputUrl: "/.cache/audio-routes/corpus/latency-loop.f32",
    mode: "screen",
    windows: 8,
    cases: ["raw-c"],
  };
  button.onclick = () => {
    button.disabled = true;
    status.textContent = "Running";
    window.nativeResearchResult = null;
    window.nativeResearchError = null;
    window.nativeResearchVisibilityAtStart = document.visibilityState;
    window.nativeResearchJob = (async () => {
      const expected = {
        c: "43acc555d5612d3bc59ac3dac5a387059fd33c473d3282f871c8c9475a854b56",
        next: "da72f53a3586a9066b3cb61434921d4bef31da9a64a1cf166381541cf4c7925f",
        input: "cb0a291b17fffa822a95c6abf1ffeb02da69552395a7a897df73a1880c653ee2",
      };
      const urls = {
        ...window.nativeResearchOptions.artifacts,
        input: window.nativeResearchOptions.inputUrl,
      };
      for (const name of [
        "research.mjs",
        "inference-worker.mjs",
        "ring-worklet.mjs",
        "observer-worklet.mjs",
      ])
        urls["served:" + name] = "/experiments/audio-routes/" + name;
      const identities = {};
      for (const [name, url] of Object.entries(urls)) {
        const response = await fetch(url);
        if (!response.ok) throw Error("Missing native fixture " + url);
        const hash = Array.from(
          new Uint8Array(await crypto.subtle.digest("SHA-256", await response.arrayBuffer())),
        )
          .map((x) => x.toString(16).padStart(2, "0"))
          .join("");
        if (name in expected && hash !== expected[name])
          throw Error("Native fixture identity mismatch: " + name);
        identities[name] = hash;
      }
      window.nativeResearchIdentities = identities;
      return import("/experiments/audio-routes/research.mjs");
    })()
      .then((m) => {
        if (m.PROTOCOL !== "audio-routes-v6") throw Error("Stale native research module");
        return m.routes(window.nativeResearchOptions);
      })
      .then((data) => {
        window.nativeResearchResult = {
          ...data,
          identities: window.nativeResearchIdentities,
          nativeHost: {
            platform: navigator.platform,
            visibilityAtStart: window.nativeResearchVisibilityAtStart,
            visibilityAtEnd: document.visibilityState,
            userAgent: navigator.userAgent,
            renderer:
              "Orca embedded Electron Chromium; not standalone Chrome/Edge or a physical microphone loopback",
          },
        };
        status.textContent = "Complete";
        button.disabled = false;
      })
      .catch((error) => {
        status.textContent = String(error);
        window.nativeResearchError = String(error);
        button.disabled = false;
      });
  };
  return { prepared: true, options: window.nativeResearchOptions };
})();
