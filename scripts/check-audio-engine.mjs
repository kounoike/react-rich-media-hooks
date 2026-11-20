import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";

const manifest = JSON.parse(await readFile("native/rnnoise/manifest.json", "utf8"));
const bytes = await readFile(manifest.artifact.path);
assert.equal(createHash("sha256").update(bytes).digest("hex"), manifest.artifact.sha256);
const module = new WebAssembly.Module(bytes);
assert.deepEqual(WebAssembly.Module.imports(module), [], "The browser must not need WASI or other host imports.");
const engine = new WebAssembly.Instance(module).exports;
engine._initialize();
assert.equal(engine.engine_abi_version(), manifest.abiVersion);
assert.equal(engine.engine_init(), 0);
assert.equal(engine.memory.buffer.byteLength, manifest.artifact.memoryBytes);
assert.throws(() => engine.memory.grow(1), RangeError, "The memory maximum must be fixed.");
const buffer = engine.memory.buffer;
const frame = new Float32Array(buffer, engine.engine_frame_ptr(), 480);
for (let index = 0; index < 100; index += 1) {
  for (let sample = 0; sample < frame.length; sample += 1) {
    frame[sample] = 1000 * Math.sin(((index * 480 + sample) * 2 * Math.PI * 440) / 48_000);
  }
  assert(Number.isFinite(engine.engine_process()));
  assert(frame.every(Number.isFinite));
  assert.equal(engine.memory.buffer, buffer, "Frame processing must not replace/grow memory.");
}
engine.engine_dispose();
assert.equal(engine.engine_process(), -1);
const assets = JSON.parse(await readFile("supply-chain/assets.json", "utf8"));
assert(assets.assets.some((asset) => asset.name === "rnnoise-wasm" && asset.sha256 === manifest.artifact.sha256));
const backend = await readFile("src/effects/audio/backends/rnnoise.ts", "utf8");
assert(backend.includes(manifest.artifact.sha256), "Runtime digest must match the reviewed asset.");
assert(gzipSync(bytes).length <= 5 * 1024 * 1024, "Entire compressed module exceeds the model-asset budget.");
await readFile("native/rnnoise/THIRD-PARTY-NOTICES.txt");
console.log(`RNNoise asset verified: no imports, fixed 8 MiB memory, ${bytes.length} bytes (${gzipSync(bytes).length} gzip).`);
