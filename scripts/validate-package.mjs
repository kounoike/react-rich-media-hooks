import { access, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const expectedEntries = ["index", "core/index", "effects/video/index", "effects/audio/index"];
const requiredFiles = ["dist/index.js", "dist/index.cjs", "dist/index.d.ts"];
const packagePathFor = (subpath) => `${packageJson.name}${subpath ? `/${subpath.slice(2)}` : ""}`;

const checkExists = async (path) => {
  try {
    await access(path);
  } catch {
    throw new Error(`Missing package artifact: ${path}`);
  }
};

for (const path of requiredFiles) await checkExists(path);
for (const entry of expectedEntries) {
  await checkExists(`dist/${entry}.js`);
  await checkExists(`dist/${entry}.cjs`);
  await checkExists(`dist/${entry}.d.ts`);
  await checkExists(`dist/${entry}.d.cts`);
}

const packageFiles = await readdir("dist", { recursive: true });
if (packageFiles.some((file) => file.endsWith(".map")))
  throw new Error("Unexpected source map in package output.");

const packageRequire = createRequire(join(process.cwd(), "package.json"));
for (const subpath of ["", "./core", "./effects/video", "./effects/audio"]) {
  const loaded = packageRequire(packagePathFor(subpath));
  if (!loaded || typeof loaded !== "object")
    throw new Error(`CJS import failed for ${subpath || "."}`);
}

const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
await execFileAsync(command, ["pack", "--pack-destination", ".artifacts"], { stdio: "inherit" });

const tarballs = (await readdir(".artifacts")).filter((file) => file.endsWith(".tgz"));
if (tarballs.length !== 1)
  throw new Error(`Expected one packed artifact, found ${tarballs.length}.`);
const tarballPath = resolve(".artifacts", tarballs[0]);

const { stdout: tarContents } = await execFileAsync("tar", ["-tzf", tarballPath], {
  encoding: "utf8",
});
const allowedTarEntries = /^(package\/(?:package\.json|README\.md|LICENSE)|package\/dist\/.+)$/;
for (const entry of tarContents.trim().split("\n")) {
  if (entry && !allowedTarEntries.test(entry))
    throw new Error(`Unexpected tarball entry: ${entry}`);
}

await execFileAsync(command, ["exec", "publint", "run", tarballPath, "--strict"], {
  stdio: "inherit",
});
await execFileAsync(
  command,
  [
    "exec",
    "attw",
    tarballPath,
    "--profile",
    "strict",
    "--entrypoints",
    ".",
    "./core",
    "./effects/video",
    "./effects/audio",
    "--no-color",
  ],
  { stdio: "inherit" },
);

if (packageJson.private) throw new Error("Published package must not remain private.");
if (packageJson.sideEffects !== false) throw new Error("Package must declare sideEffects: false.");
for (const subpath of ["", "./core", "./effects/video", "./effects/audio"]) {
  const packagePath = packagePathFor(subpath);
  const esm = await import(packagePath);
  const cjs = packageRequire(packagePath);
  if (Object.keys(esm).length === 0 || Object.keys(cjs).length === 0) {
    throw new Error(`Empty import result for ${packagePath}.`);
  }
}

for (const scenario of [
  { react: "18.2.0", reactTypes: "18.2.79" },
  { react: "19.1.1", reactTypes: null },
]) {
  const consumer = await mkdtemp(join(tmpdir(), "react-rich-media-hooks-consumer-"));
  try {
    await writeFile(
      join(consumer, "package.json"),
      JSON.stringify({ name: "package-consumer", private: true, type: "module" }),
    );
    const dependencies = ["add", tarballPath, `react@${scenario.react}`, "typescript@7.0.2"];
    if (scenario.reactTypes) dependencies.push(`@types/react@${scenario.reactTypes}`);
    await execFileAsync(command, dependencies, { cwd: consumer, stdio: "inherit" });
    await writeFile(
      join(consumer, "consumer.ts"),
      "import { createMediaSession } from 'react-rich-media-hooks'\nimport { crop } from 'react-rich-media-hooks/effects/video'\nconst session = createMediaSession({ video: { effects: [crop()] } })\nvoid session.getSnapshot()\n",
    );
    await execFileAsync(
      command,
      [
        "exec",
        "tsc",
        "--noEmit",
        "--strict",
        "--skipLibCheck",
        "--module",
        "NodeNext",
        "--moduleResolution",
        "NodeNext",
        "--target",
        "ES2022",
        "--lib",
        "ES2022,DOM",
        "consumer.ts",
      ],
      { cwd: consumer, stdio: "inherit" },
    );
    await execFileAsync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        "const root=await import('react-rich-media-hooks'); const core=await import('react-rich-media-hooks/core'); const video=await import('react-rich-media-hooks/effects/video'); const audio=await import('react-rich-media-hooks/effects/audio'); if(typeof root.createMediaSession!=='function'||typeof core.createMediaSession!=='function'||typeof video.crop!=='function'||typeof audio.noiseReduction!=='function') process.exit(1); if(core.createMediaSession().getServerSnapshot().availability!=='unavailable') process.exit(2);",
      ],
      { cwd: consumer, stdio: "inherit" },
    );
    await execFileAsync(
      process.execPath,
      [
        "-e",
        "const root=require('react-rich-media-hooks'); const core=require('react-rich-media-hooks/core'); const video=require('react-rich-media-hooks/effects/video'); const audio=require('react-rich-media-hooks/effects/audio'); if(typeof root.createMediaSession!=='function'||typeof core.createMediaSession!=='function'||typeof video.crop!=='function'||typeof audio.noiseReduction!=='function') process.exit(1);",
      ],
      { cwd: consumer, stdio: "inherit" },
    );
    console.log(`Packed ESM, SSR, CJS, and TypeScript consumer pass (React ${scenario.react}).`);
  } finally {
    await rm(consumer, { recursive: true, force: true });
  }
}
console.log(`Package validation passed: ${tarballs[0]}`);
