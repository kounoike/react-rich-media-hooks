import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const manifest = JSON.parse(await readFile(join(root, "native/rnnoise/manifest.json"), "utf8"));
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const zig = process.env.ZIG ?? "zig";
if (execFileSync(zig, ["version"], { encoding: "utf8" }).trim() !== manifest.zigVersion) {
  throw new Error(`Rebuilding RNNoise requires Zig ${manifest.zigVersion}.`);
}
const cache = join(root, ".cache/audio-native");
await mkdir(cache, { recursive: true });

async function download(input) {
  const filename = join(cache, `${input.sha256}.tar.gz`);
  let bytes;
  try {
    bytes = await readFile(filename);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    const response = await fetch(input.url);
    if (!response.ok) throw new Error(`Source download failed: ${response.status} ${input.url}`);
    bytes = Buffer.from(await response.arrayBuffer());
    if (digest(bytes) !== input.sha256) throw new Error(`Source digest mismatch: ${input.url}`);
    await writeFile(filename, bytes);
  }
  if (digest(bytes) !== input.sha256) throw new Error(`Cached source digest mismatch: ${filename}`);
  return filename;
}

const sourceArchive = await download(manifest.source);
const modelArchive = await download(manifest.model);
const work = await mkdtemp(join(cache, "rebuild-"));
try {
  // Both archives are immutable digest-verified upstream inputs; never execute their scripts.
  execFileSync("tar", ["-xzf", sourceArchive, "--strip-components=1", "-C", work]);
  execFileSync("tar", ["-xzf", modelArchive, "-C", work, "src/rnnoise_data.c", "src/rnnoise_data.h"]);
  const output = join(work, "rnnoise.wasm");
  execFileSync(zig, [
    "build-exe", join(root, "native/rnnoise/adapter.zig"),
    "-target", "wasm32-wasi", "-mexec-model=reactor", "-O", "ReleaseFast", "-fno-entry", "-fstrip",
    `-femit-bin=${output}`, "-lc",
    "-I", join(root, "native/rnnoise"), "-I", join(work, "include"), "-I", join(work, "src"),
    "-cflags", "-O3", "-DNDEBUG", "-DRNNOISE_BUILD", "--",
    ...manifest.cSources.map((source) => join(work, "src", source)),
    "--export-memory", `--initial-memory=${manifest.artifact.memoryBytes}`,
    `--max-memory=${manifest.artifact.memoryBytes}`, "--stack", String(manifest.artifact.stackBytes),
    ...["engine_abi_version", "engine_init", "engine_frame_ptr", "engine_process", "engine_dispose"].map((name) => `--export=${name}`),
  ], { cwd: root, stdio: "inherit" });
  const built = await readFile(output);
  if (digest(built) !== manifest.artifact.sha256) {
    throw new Error(`Rebuilt WASM differs from the reviewed artifact: ${digest(built)}`);
  }
  if (process.argv.includes("--write")) await writeFile(join(root, manifest.artifact.path), built);
  else if (!built.equals(await readFile(join(root, manifest.artifact.path)))) {
    throw new Error("Tracked WASM differs from the source rebuild.");
  }
  console.log(`RNNoise rebuild matches ${manifest.artifact.sha256} (${built.length} bytes).`);
} finally {
  await rm(work, { recursive: true, force: true });
}
