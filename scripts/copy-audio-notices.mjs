import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";

const manifest = JSON.parse(await readFile("native/rnnoise/manifest.json", "utf8"));
const inventory = JSON.parse(await readFile("supply-chain/assets.json", "utf8"));
const worklet = inventory.assets.find((asset) => asset.name === "rnnoise-worklet");
assert(worklet, "The distributed Worklet must be inventoried.");
const output = (await readdir("dist/assets")).find((file) => file.startsWith("noise-worklet-") && file.endsWith(".js"));
assert(output, "The Worklet must be emitted as a local asset.");
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
assert.equal(
  `sha256:${digest(Buffer.concat(await Promise.all(worklet.sourceFiles.map((file) => readFile(file)))))}`,
  worklet.sourceRevision,
  "Worklet sources differ from their reviewed provenance digest.",
);
assert.equal(digest(await readFile(`dist/assets/${output}`)), worklet.sha256, "Built Worklet differs from its reviewed inventory digest.");
assert.equal(digest(await readFile("dist/rnnoise.wasm")), manifest.artifact.sha256, "Built WASM differs from its reviewed inventory digest.");

await mkdir("dist/assets", { recursive: true });
await copyFile("native/rnnoise/THIRD-PARTY-NOTICES.txt", "dist/assets/RNNOISE-NOTICES.txt");
await writeFile("dist/assets/rnnoise-build.json", JSON.stringify({ ...manifest, worklet }, null, 2) + "\n");
