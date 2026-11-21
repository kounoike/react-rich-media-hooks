// Diagnostic builds only; a timing import is intentionally absent from production artifacts.
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { resolve, join } from "node:path";
const root = process.cwd(),
  manifest = JSON.parse(await readFile("native/rnnoise/manifest.json", "utf8"));
assert.equal(execFileSync("zig", ["version"], { encoding: "utf8" }).trim(), manifest.zigVersion);
const hash = (b) => createHash("sha256").update(b).digest("hex");
const cache = join(root, ".cache/audio-routes");
await mkdir(cache, { recursive: true });
const work = await mkdtemp(join(cache, "stage-"));
const stages = [
  ["denoise.c", "rnnoise_process_frame", "total"],
  ["denoise.c", "rnn_compute_frame_features", "features"],
  ["denoise.c", "forward_transform", "fftForward"],
  ["denoise.c", "inverse_transform", "fftInverse"],
  ["pitch.c", "rnn_pitch_downsample", "pitchDownsample"],
  ["pitch.c", "rnn_pitch_search", "pitchSearch"],
  ["pitch.c", "rnn_remove_doubling", "pitchDoubling"],
  ["rnn.c", "compute_rnn", "model"],
  ["nnet.c", "compute_generic_conv1d", "conv"],
  ["nnet.c", "compute_generic_gru", "gru"],
  ["nnet_arch.h", "RTCD_SUF(compute_linear_)", "affine"],
  ["nnet_arch.h", "RTCD_SUF(compute_activation_)", "activation"],
  ["denoise.c", "frame_synthesis", "synthesis"],
  ["denoise.c", "rnn_pitch_filter", "pitchFilter"],
  ["kiss_fft.c", "kf_bfly4", "fftRadix4"],
];
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
  for (const [id, [file, name]] of stages.entries()) {
    const path = join(work, "src", file);
    let source = await readFile(path, "utf8");
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(
      "^(static\\s+)?(void|float|int|opus_val16)\\s+" + escaped + "\\s*\\(([^;{}]*?)\\)\\s*\\{",
      "ms",
    );
    const match = pattern.exec(source);
    assert(match, `Missing stage ${file}:${name}`);
    const qualifier = match[1] ?? "",
      type = match[2],
      params = match[3];
    const args = params
      .split(",")
      .map((p) => {
        const m = /([a-zA-Z_]\w*)\s*(?:\[[^\]]*\])?\s*$/.exec(p.trim());
        assert(m, p);
        return m[1];
      })
      .join(",");
    const original = "probe_original_" + id;
    const declaration = `${qualifier}${type} ${name}(${params});\n${qualifier}${type} ${original}(${params}) {`;
    source =
      source.slice(0, match.index) + declaration + source.slice(match.index + match[0].length);
    const call = `${original}(${args})`;
    source += `\n${qualifier}${type} ${name}(${params}) { probe_mark(${id},1); ${type === "void" ? call + ";" : type + " result=" + call + ";"} probe_mark(${id},0); ${type === "void" ? "" : "return result;"} }\n`;
    if (!source.includes('import_module("probe")'))
      source =
        '__attribute__((import_module("probe"), import_name("mark"))) extern void probe_mark(int,int);\n' +
        source;
    await writeFile(path, source);
  }
  const report = {
    diagnosticOnly: true,
    source: manifest.source,
    model: manifest.model,
    stages: stages.map((x, id) => ({ id, file: x[0], function: x[1], stage: x[2] })),
    artifacts: {},
  };
  const headerPath = join(work, "src/nnet_arch.h"),
    cHeader = await readFile(headerPath, "utf8");
  const kernel = await readFile(join(root, "experiments/rnnoise-zig/kernels.zig"), "utf8");
  await writeFile(
    join(work, "kernels.zig"),
    kernel.replace("export fn rnn_compute_linear_c(", "export fn experiment_zig_linear("),
  );
  await writeFile(
    join(work, "adapter.zig"),
    'comptime { _ = @import("kernels.zig"); }\n' +
      (await readFile(join(root, "native/rnnoise/adapter.zig"), "utf8")),
  );
  for (const [name, cpu, zig] of [
    ["c-profile", "baseline", false],
    ["c-profile-simd", "baseline+simd128", false],
    ["zig-profile", "baseline", true],
    ["zig-profile-simd", "baseline+simd128", true],
  ]) {
    await writeFile(
      headerPath,
      zig
        ? cHeader
            .replace(
              '#include "nnet.h"',
              '#include "nnet.h"\nextern void experiment_zig_linear(const LinearLayer *,float *,const float *);',
            )
            .replace("probe_original_10(linear,out,in);", "experiment_zig_linear(linear,out,in);")
        : cHeader,
    );
    const output = join(cache, name + ".wasm");
    const args = [
      "build-exe",
      zig ? join(work, "adapter.zig") : join(root, "native/rnnoise/adapter.zig"),
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
      "--import-symbols",
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
      ].map((x) => "--export=" + x),
    ];
    execFileSync("zig", args, { stdio: "inherit" });
    const bytes = await readFile(output);
    const module = new WebAssembly.Module(bytes);
    const imports = WebAssembly.Module.imports(module);
    assert.deepEqual(imports, [{ module: "probe", name: "mark", kind: "function" }]);
    report.artifacts[name] = {
      path: resolve(output),
      sha256: hash(bytes),
      bytes: bytes.length,
      gzipBytes: gzipSync(bytes).length,
      imports,
      cpu,
    };
  }
  await writeFile(join(cache, "stages.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
} finally {
  await rm(work, { recursive: true, force: true });
}
