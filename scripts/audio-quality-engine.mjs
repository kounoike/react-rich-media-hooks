// Offline measurement only; execute the reviewed native artifact without browser scheduling.
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
const manifest = JSON.parse(readFileSync("native/rnnoise/manifest.json", "utf8"));
const bytes = readFileSync(manifest.artifact.path);
if (createHash("sha256").update(bytes).digest("hex") !== manifest.artifact.sha256) {
  throw new Error("Unreviewed measurement artifact.");
}
const native = new WebAssembly.Instance(new WebAssembly.Module(bytes)).exports;
native._initialize();
if (native.engine_init() !== 0) throw new Error("Engine initialization failed.");
const inputBytes = readFileSync(0);
const input = new Float32Array(inputBytes.buffer, inputBytes.byteOffset, inputBytes.length / 4);
const frame = new Float32Array(native.memory.buffer, native.engine_frame_ptr(), 480);
const output = new Float32Array(Math.ceil(input.length / 480) * 480 + 960);
for (let offset = 0; offset < output.length; offset += 480) {
  for (let i = 0; i < 480; i += 1) frame[i] = (input[offset + i] ?? 0) * 32768;
  if (!Number.isFinite(native.engine_process())) throw new Error("Invalid native frame.");
  for (let i = 0; i < 480; i += 1) output[offset + i] = frame[i] / 32768;
}
native.engine_dispose();
// Remove the pinned model's two-frame analysis delay; host frame staging is not modeled here.
process.stdout.write(Buffer.from(output.subarray(960, 960 + input.length).buffer,
  output.byteOffset + 960 * 4, input.length * 4));
