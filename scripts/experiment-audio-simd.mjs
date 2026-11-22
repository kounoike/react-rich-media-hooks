// Experimental comparison only: never replaces a packaged asset or its manifest.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readFile, writeFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import { resolve, join } from "node:path";
import { gzipSync } from "node:zlib";
const root = fileURLToPath(new URL("..", import.meta.url));
const manifest = JSON.parse(await readFile(join(root, "native/rnnoise/manifest.json"), "utf8"));
const zig = process.env.ZIG ?? "zig";
assert.equal(execFileSync(zig, ["version"], { encoding: "utf8" }).trim(), "0.15.2");
execFileSync(process.execPath, ["scripts/build-audio-engine.mjs"], { cwd: root, stdio: "inherit" });
const cache = join(root, ".cache/audio-experiment");
await mkdir(cache, { recursive: true });
const work = await mkdtemp(join(cache, "simd-build-"));
const sha256 = (data) => createHash("sha256").update(data).digest("hex");
try {
  for (const [name, input] of [["source", manifest.source], ["model", manifest.model]]) {
    const archive = join(root, ".cache/audio-native", input.sha256 + ".tar.gz");
    assert.equal(sha256(await readFile(archive)), input.sha256);
    execFileSync("tar", name === "source" ? ["-xzf", archive, "--strip-components=1", "-C", work]
      : ["-xzf", archive, "-C", work, "src/rnnoise_data.c", "src/rnnoise_data.h"]);
  }
  const output = join(cache, "rnnoise-simd128.wasm");
  const args = ["build-exe", "--verbose-cc", join(root, "native/rnnoise/adapter.zig"), "-target", "wasm32-wasi",
    "-mcpu", "baseline+simd128", "-mexec-model=reactor", "-O", "ReleaseFast", "-fno-entry", "-fstrip",
    `-femit-bin=${output}`, "-lc", "-I", join(root, "native/rnnoise"), "-I", join(work, "include"), "-I", join(work, "src"),
    "-cflags", "-O3", "-DNDEBUG", "-DRNNOISE_BUILD", "--", ...manifest.cSources.map((name) => join(work, "src", name)),
    "--export-memory", `--initial-memory=${manifest.artifact.memoryBytes}`, `--max-memory=${manifest.artifact.memoryBytes}`,
    "--stack", String(manifest.artifact.stackBytes), ...["engine_abi_version", "engine_init", "engine_frame_ptr", "engine_process", "engine_dispose"].map((name) => `--export=${name}`)];
  const compile = spawnSync(zig, args, { cwd: root, encoding: "utf8" });
  await writeFile(join(cache, "compile-stdout.log"), compile.stdout ?? "");
  await writeFile(join(cache, "compile-stderr.log"), compile.stderr ?? "");
  assert.equal(compile.status, 0, compile.error?.message ?? compile.stderr);
  // The shipping-equivalent -fstrip removes the feature custom section; retain a named diagnostic twin for inspection.
  const diagnostic = join(cache, "rnnoise-simd128-diagnostic.wasm");
  const diagnosticArgs = args.filter((arg) => arg !== "--verbose-cc").map((arg) => arg === "-fstrip" ? "-fno-strip" : arg.startsWith("-femit-bin=") ? `-femit-bin=${diagnostic}` : arg);
  execFileSync(zig, diagnosticArgs, { cwd: root, stdio: "inherit" });
  const features = (module) => WebAssembly.Module.customSections(module, "target_features").map((section) => {
    const bytes = new Uint8Array(section); let offset = 0;
    const number = () => { let value = 0, shift = 0, part; do { part = bytes[offset++]; value |= (part & 127) << shift; shift += 7; } while (part & 128); return value; };
    const count = number(); const result = [];
    for (let i = 0; i < count; i++) { const prefix = String.fromCharCode(bytes[offset++]); const length = number(); result.push(prefix + new TextDecoder().decode(bytes.slice(offset, offset += length))); }
    return result;
  }).flat();
  const report = { experimentalOnly: true, zigVersion: "0.15.2", target: "wasm32-wasi", cpu: "baseline+simd128", source: manifest.source, model: manifest.model, compilerArguments: args.map((arg) => arg.replaceAll(work, "<verified-source>").replaceAll(root, "<repo>")), artifacts: {} };
  for (const [name, filename] of [["generic", manifest.artifact.path], ["simd128", output]]) {
    const bytes = await readFile(resolve(root, filename)); const module = new WebAssembly.Module(bytes);
    assert.deepEqual(WebAssembly.Module.imports(module), []);
    const e = new WebAssembly.Instance(module).exports; e._initialize(); assert.equal(e.engine_abi_version(), manifest.abiVersion); assert.equal(e.engine_init(), 0);
    assert.equal(e.memory.buffer.byteLength, manifest.artifact.memoryBytes); assert.throws(() => e.memory.grow(1), RangeError); e.engine_dispose();
    report.artifacts[name] = { sha256: sha256(bytes), bytes: bytes.length, gzipBytes: gzipSync(bytes).length, imports: [], abiVersion: e.engine_abi_version(), stackBytes: manifest.artifact.stackBytes, fixedMemoryBytes: e.memory.buffer.byteLength, features: features(module) };
  }
  assert.equal(report.artifacts.generic.sha256, manifest.artifact.sha256);
  const baselineDiagnostic = join(cache, "rnnoise-generic-diagnostic.wasm");
  const baselineArgs = diagnosticArgs.filter((arg, index) => arg !== "-mcpu" && diagnosticArgs[index - 1] !== "-mcpu").map((arg) => arg.startsWith("-femit-bin=") ? `-femit-bin=${baselineDiagnostic}` : arg);
  execFileSync(zig, baselineArgs, { cwd: root, stdio: "inherit" });
  report.genericDiagnosticFeatures = features(new WebAssembly.Module(await readFile(baselineDiagnostic)));
  report.simdDiagnosticFeatures = features(new WebAssembly.Module(await readFile(diagnostic)));
  assert(report.simdDiagnosticFeatures.includes("+simd128"));
  await writeFile(join(cache, "build.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
} finally { await rm(work, { recursive: true, force: true }); }
