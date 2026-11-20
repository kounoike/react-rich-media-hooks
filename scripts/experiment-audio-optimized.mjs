// Opt-in hybrid prototype only; never writes native/rnnoise or production assets.
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { resolve, join } from "node:path";
const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const manifest = JSON.parse(await readFile(join(root, "native/rnnoise/manifest.json"), "utf8"));
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
assert.equal(execFileSync("zig", ["version"], { encoding: "utf8" }).trim(), manifest.zigVersion);
execFileSync(process.execPath, ["scripts/build-audio-engine.mjs"], { cwd: root, stdio: "inherit" });
const cache = join(root, ".cache/audio-optimized");
await mkdir(cache, { recursive: true });
const work = await mkdtemp(join(cache, "source-"));
try {
  for (const [kind, input] of [
    ["source", manifest.source],
    ["model", manifest.model],
  ]) {
    const archive = join(root, ".cache/audio-native", input.sha256 + ".tar.gz");
    assert.equal(hash(await readFile(archive)), input.sha256);
    execFileSync(
      "tar",
      kind === "source"
        ? ["-xzf", archive, "--strip-components=1", "-C", work]
        : ["-xzf", archive, "-C", work, "src/rnnoise_data.c", "src/rnnoise_data.h"],
    );
  }
  // Rename only the C affine definition in a temporary verified-source copy.
  // All C callers keep rnn_compute_linear_c and resolve to the Zig implementation.
  const header = join(work, "src/nnet_arch.h");
  const original = await readFile(header, "utf8");
  const needle = "void RTCD_SUF(compute_linear_) (";
  assert.equal(original.split(needle).length, 2);
  await writeFile(header, original.replace(needle, "void experiment_unused_c_linear ("));
  const fftPath = join(work, "src/kiss_fft.c"),
    fft = await readFile(fftPath, "utf8");
  const pattern = /static void kf_bfly4\s*\(([^{}]*?)\)\s*\{/m;
  const found = pattern.exec(fft);
  assert(found, "FFT radix-4 definition missing");
  const replacement =
    "extern void experiment_fft4(kiss_fft_cpx *,const kiss_twiddle_cpx *,size_t,int,int,int);\nstatic void kf_bfly4(" +
    found[1] +
    ") { experiment_fft4(Fout,st->twiddles,fstride,m,N,mm); }\nstatic void unused_c_fft4(" +
    found[1] +
    ") {";
  await writeFile(
    fftPath,
    fft.slice(0, found.index) + replacement + fft.slice(found.index + found[0].length),
  );
  const port = await readFile(join(root, "experiments/rnnoise-zig/kernels-next.zig"));
  await writeFile(join(work, "kernels.zig"), port);
  const adapter = await readFile(join(root, "native/rnnoise/adapter.zig"), "utf8");
  await writeFile(
    join(work, "adapter.zig"),
    'comptime { _ = @import("kernels.zig"); }\n' + adapter,
  );
  const report = {
    experimentalOnly: true,
    scope:
      "Profile-selected register-tiled affine plus radix-4 FFT; C model/other FFT/features/activation/GRU control retained",
    source: manifest.source,
    model: manifest.model,
    zigVersion: manifest.zigVersion,
    target: "wasm32-wasi",
    prototypeSourceSha256: hash(port),
    modifiedCDefinition: needle,
    artifacts: {},
  };
  for (const [name, cpu] of [
    ["zig-generic", "baseline"],
    ["zig-simd128", "baseline+simd128"],
  ]) {
    const output = join(cache, name + ".wasm");
    const args = [
      "build-exe",
      join(work, "adapter.zig"),
      "-target",
      "wasm32-wasi",
      "-mcpu",
      cpu,
      "-mexec-model=reactor",
      "-O",
      "ReleaseFast",
      "-fno-entry",
      "-fstrip",
      `-femit-bin=${output}`,
      "-lc",
      "-I",
      join(root, "native/rnnoise"),
      "-I",
      join(work, "include"),
      "-I",
      join(work, "src"),
      "-cflags",
      "-O3",
      "-DNDEBUG",
      "-DRNNOISE_BUILD",
      "--",
      ...manifest.cSources.map((p) => join(work, "src", p)),
      "--export-memory",
      `--initial-memory=${manifest.artifact.memoryBytes}`,
      `--max-memory=${manifest.artifact.memoryBytes}`,
      "--stack",
      String(manifest.artifact.stackBytes),
      ...[
        "engine_abi_version",
        "engine_init",
        "engine_frame_ptr",
        "engine_process",
        "engine_dispose",
        "experiment_dense_float_calls",
        "experiment_sparse_float_calls",
        "experiment_dense_q8_calls",
        "experiment_sparse_q8_calls",
        "experiment_port_revision",
        "experiment_fft4_calls",
      ].map((x) => `--export=${x}`),
    ];
    execFileSync("zig", args, { cwd: root, stdio: "inherit" });
    const bytes = await readFile(output);
    const module = new WebAssembly.Module(bytes);
    assert.deepEqual(WebAssembly.Module.imports(module), []);
    const e = new WebAssembly.Instance(module).exports;
    e._initialize();
    assert.equal(e.engine_init(), 0);
    assert.equal(e.experiment_port_revision(), 1);
    const frame = new Float32Array(e.memory.buffer, e.engine_frame_ptr(), 480);
    frame.fill(100);
    e.engine_process();
    assert.equal(e.memory.buffer.byteLength, manifest.artifact.memoryBytes);
    assert.throws(() => e.memory.grow(1), RangeError);
    report.artifacts[name] = {
      path: ".cache/audio-optimized/" + name + ".wasm",
      cpu,
      sha256: hash(bytes),
      bytes: bytes.length,
      gzipBytes: gzipSync(bytes).length,
      imports: [],
      fixedMemoryBytes: e.memory.buffer.byteLength,
      stackBytes: manifest.artifact.stackBytes,
      callsAfterOneFrame: Object.fromEntries(
        ["dense_float", "sparse_float", "dense_q8", "sparse_q8"].map((kind) => [
          kind,
          e["experiment_" + kind + "_calls"](),
        ]),
      ),
      arguments: args.map((x) => x.replaceAll(work, "<source>").replaceAll(root, "<repo>")),
    };
    e.engine_dispose();
  }
  assert.equal(hash(await readFile(join(root, manifest.artifact.path))), manifest.artifact.sha256);
  await writeFile(join(cache, "build.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
} finally {
  await rm(work, { recursive: true, force: true });
}
