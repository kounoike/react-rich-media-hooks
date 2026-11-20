// Local algorithm equivalence only; no live media or main-thread runtime bridge.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
const build = JSON.parse(readFileSync(process.env.AUDIO_COMPARISON_BUILD ?? ".cache/audio-zig/build.json", "utf8"));
const manifest = JSON.parse(readFileSync("native/rnnoise/manifest.json", "utf8"));
const variants = { generic: manifest.artifact, ...build.artifacts };
const pcmBytes = readFileSync(".cache/audio-quality/speech.f32");
const speech = new Float32Array(pcmBytes.buffer, pcmBytes.byteOffset, pcmBytes.length / 4);
let seed = 1212;
const stress = Float32Array.from({ length: 480 * 1000 }, (_, i) => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return i < 480 ? 0 : i < 960 ? (i === 480 ? .9 : 0) : .07 * Math.sin(i * .053) + .02 * ((seed / 2**32) * 2 - 1);
});
const report = { experimentalOnly: true, frameSamples: 480, sampleRate: 48000,
  comparison: "same streaming 480-sample input/state reset per fixture, no delay compensation or cross-correlation", provisionalNormalizedMaxAbsTolerance: 1e-5, provisionalNormalizedRmsTolerance: 1e-6,
  fixtures: {} };
for (const [fixture, input] of [["speech", speech], ["seeded-noise-voiced-impulse-silence", stress]]) {
  const outputs = {};
  for (const [variant, artifact] of Object.entries(variants)) {
    const bytes = readFileSync(artifact.path); assert.equal(createHash("sha256").update(bytes).digest("hex"), artifact.sha256);
    const module = new WebAssembly.Module(bytes); assert.deepEqual(WebAssembly.Module.imports(module), []);
    const e = new WebAssembly.Instance(module).exports; e._initialize(); assert.equal(e.engine_init(), 0);
    const memory = e.memory.buffer, frame = new Float32Array(memory, e.engine_frame_ptr(), 480);
    const output = new Float32Array(Math.ceil(input.length / 480) * 480), probabilities = [];
    for (let offset = 0; offset < output.length; offset += 480) {
      for (let i = 0; i < 480; i++) frame[i] = (input[offset+i] ?? 0) * 32768;
      probabilities.push(e.engine_process()); assert.equal(e.memory.buffer, memory);
      for (let i = 0; i < 480; i++) output[offset+i] = frame[i] / 32768;
    }
    assert(output.every(Number.isFinite)); assert(probabilities.every(Number.isFinite));
    outputs[variant] = {output, probabilities, sha256: artifact.sha256}; e.engine_dispose();
  }
  const a = outputs.generic.output, aBits = new Uint32Array(a.buffer);
  const rows = {};
  for (const [name, { output: b, probabilities, sha256 }] of Object.entries(outputs)) {
    const bBits = new Uint32Array(b.buffer); let maxAbsDiff=0, squares=0, differentBits=0, worstFrame=0;
    for (let i=0;i<a.length;i++) { const d=a[i]-b[i]; if(Math.abs(d)>maxAbsDiff){maxAbsDiff=Math.abs(d);worstFrame=Math.floor(i/480);} squares+=d*d; if(aBits[i]!==bBits[i])differentBits++; }
    const rmsDiff=Math.sqrt(squares/a.length), probabilityMaxAbsDiff=Math.max(...probabilities.map((p,i)=>Math.abs(p-outputs.generic.probabilities[i])));
    rows[name]={sha256, frames:a.length/480,samples:a.length,maxAbsDiff,rmsDiff,differentBits,worstFrame,probabilityMaxAbsDiff,finite:true,withinProvisionalTolerance:maxAbsDiff<=1e-5&&rmsDiff<=1e-6};
  }
  report.fixtures[fixture] = rows;
}
writeFileSync(process.env.AUDIO_COMPARISON_OUTPUT ?? ".cache/audio-zig/frame-comparison.json", JSON.stringify(report,null,2)+"\n");
console.log(JSON.stringify(report,null,2));
assert(Object.values(report.fixtures).every((rows)=>Object.values(rows).every((r)=>r.withinProvisionalTolerance)), "Prototype exceeds the stated experimental numerical tolerance");
