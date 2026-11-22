// Actual browser WASM frame interoperability; no browser scheduling/latency claim.
export const PROTOCOL = "audio-routes-v6";
export async function comparison({ artifacts }) {
  const bytes = await (await fetch("/research-input")).arrayBuffer();
  const source = new Float32Array(bytes),
    frames = Math.ceil(source.length / 480),
    reference = new Float32Array(frames * 480),
    probabilities = new Float32Array(frames),
    variants = [];
  for (const [name, url] of Object.entries(artifacts)) {
    const module = await WebAssembly.compile(await (await fetch(url)).arrayBuffer());
    if (WebAssembly.Module.imports(module).length) throw Error("Unexpected engine imports");
    const e = new WebAssembly.Instance(module).exports;
    e._initialize();
    if (e.engine_abi_version() !== 1 || e.engine_init() !== 0)
      throw Error("Native ABI/init failure");
    const memory = e.memory.buffer;
    if (memory.byteLength !== 8388608) throw Error("Unexpected fixed memory");
    const frame = new Float32Array(memory, e.engine_frame_ptr(), 480),
      bits = new Uint32Array(memory, frame.byteOffset, 480),
      referenceBits = new Uint32Array(reference.buffer);
    let differentBits = 0,
      peak = 0,
      squared = 0,
      probabilityDifference = 0;
    for (let n = 0; n < frames; n++) {
      for (let i = 0; i < 480; i++) frame[i] = (source[n * 480 + i] ?? 0) * 32768;
      const probability = e.engine_process();
      if (!Number.isFinite(probability)) throw Error("Nonfinite probability");
      if (name === "c") {
        reference.set(frame, n * 480);
        probabilities[n] = probability;
      } else
        probabilityDifference = Math.max(
          probabilityDifference,
          Math.abs(probability - probabilities[n]),
        );
      for (let i = 0; i < 480; i++) {
        if (!Number.isFinite(frame[i])) throw Error("Nonfinite output");
        if (bits[i] !== referenceBits[n * 480 + i]) differentBits++;
        const delta = (frame[i] - reference[n * 480 + i]) / 32768;
        peak = Math.max(peak, Math.abs(delta));
        squared += delta * delta;
      }
      if (e.memory.buffer !== memory) throw Error("Memory changed");
    }
    const counters = {
      denseFloat: e.experiment_dense_float_calls?.(),
      sparseFloat: e.experiment_sparse_float_calls?.(),
      fftRadix4: e.experiment_fft4_calls?.(),
    };
    let fixedMemoryEnforced = false;
    try {
      e.memory.grow(1);
    } catch (error) {
      if (!(error instanceof RangeError)) throw error;
      fixedMemoryEnforced = true;
    }
    if (!fixedMemoryEnforced) throw Error("Memory limit not enforced");
    e.engine_dispose();
    variants.push({
      name,
      frames,
      samples: frames * 480,
      differentBits,
      normalizedPeakDifference: peak,
      normalizedRmsDifference: Math.sqrt(squared / (frames * 480)),
      probabilityMaxAbsDifference: probabilityDifference,
      fixedMemoryEnforced,
      memoryBytes: memory.byteLength,
      imports: [],
      counters,
    });
  }
  return {
    protocol: PROTOCOL,
    userAgent: navigator.userAgent,
    comparison:
      "Identical 480-sample streaming frames, fresh state per artifact; no delay compensation, cross-correlation, tolerance consumption or audio graph",
    variants,
  };
}
