import noiseWorkletUrl from "../noise-worklet.ts?worker&url";
import wasmUrl from "../assets/rnnoise.wasm?url&no-inline";
import type { AudioDenoiserBackend } from "../backend.js";

/** The only selected backend. Alternative engines stay outside the public effect API. */
export const rnnoiseBackend: AudioDenoiserBackend = {
  id: "rnnoise",
  label: "RNNoise",
  workletUrl: noiseWorkletUrl,
  processorName: "rnnoise-noise-reduction",
  contextSampleRate: 48_000,
  channelCount: 1,
  prepare: async (signal) => {
    const response = await fetch(wasmUrl, signal === undefined ? {} : { signal });
    if (!response.ok) throw new Error(`RNNoise asset could not load (${response.status}).`);
    const bytes = await response.arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const actual = Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
    if (actual !== "43acc555d5612d3bc59ac3dac5a387059fd33c473d3282f871c8c9475a854b56") {
      throw new Error("RNNoise asset integrity verification failed.");
    }
    const module = await WebAssembly.compile(bytes);
    if (WebAssembly.Module.imports(module).length !== 0) {
      throw new Error("RNNoise unexpectedly requires host imports.");
    }
    return { module };
  },
};
