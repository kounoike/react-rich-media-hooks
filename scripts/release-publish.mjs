import { createHash } from "node:crypto";
import { access, readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const argument = process.argv[index];
  if (argument === "--") continue;
  if (argument.startsWith("--")) args.set(argument.slice(2), process.argv[++index]);
}

const mode = args.get("mode");
const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const tag = args.get("tag");
const mergeSha = args.get("merge-sha");
const artifact = args.get("artifact");
const registry = packageJson.publishConfig?.registry ?? "https://registry.npmjs.org/";
const expectedTag = `v${packageJson.version}`;
const prereleaseChannel = packageJson.version.includes("-")
  ? packageJson.version.split("-")[1].split(".")[0]
  : "latest";
const distTag = prereleaseChannel === "alpha" ? "next" : prereleaseChannel;
const repository = process.env.GITHUB_REPOSITORY;

if (!mode || !["publish", "finalize"].includes(mode)) {
  throw new Error("--mode must be publish or finalize");
}
if (tag !== expectedTag) throw new Error(`tag ${tag ?? "<missing>"} must match ${expectedTag}`);
if (mode === "publish" && !/^[0-9a-f]{40}$/i.test(mergeSha ?? "")) {
  throw new Error("--merge-sha must be a full commit SHA");
}
if (!repository || !process.env.GH_TOKEN) throw new Error("GITHUB_REPOSITORY and GH_TOKEN are required");
if (process.env.NPM_TOKEN || process.env.NODE_AUTH_TOKEN) {
  throw new Error("Long-lived npm credentials are forbidden; configure npm trusted publishing/OIDC");
}

async function run(command, commandArgs, options = {}) {
  const result = await execFileAsync(command, commandArgs, { encoding: "utf8", ...options });
  return result.stdout.trim();
}

function transient(error) {
  const text = `${error.message ?? ""} ${error.stderr ?? ""}`;
  return /EAI_AGAIN|ECONNRESET|ECONNREFUSED|ETIMEDOUT|ENETUNREACH|network|5\d\d|503|504/i.test(text);
}

async function retry(label, operation) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (!transient(error) || attempt === 3) throw error;
      console.warn(`${label} transient failure; retrying (${attempt}/3).`);
    }
  }
  throw new Error(`${label} exhausted retries`);
}

async function registryVersion() {
  try {
    const output = await retry("npm registry inspection", () =>
      run("npm", ["view", `${packageJson.name}@${packageJson.version}`, "--json", "--registry", registry]),
    );
    return JSON.parse(output);
  } catch (error) {
    const text = `${error.message ?? ""} ${error.stderr ?? ""}`;
    if (/E404|not found|404/i.test(text)) return null;
    throw error;
  }
}

async function githubRelease() {
  const output = await retry("GitHub Release inspection", () =>
    run("gh", ["api", `repos/${repository}/releases/tags/${tag}`]),
  );
  return JSON.parse(output);
}

function hasProvenance(metadata) {
  return Boolean(metadata?.dist?.attestations?.provenance || metadata?.dist?.attestations?.url);
}

async function inspectArtifact() {
  if (!artifact) throw new Error("--artifact is required for publication");
  await access(artifact);
  const bytes = await readFile(artifact);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const sha512 = `sha512-${createHash("sha512").update(bytes).digest("base64")}`;
  const packageManifest = JSON.parse(await run("tar", ["-xOzf", artifact, "package/package.json"]));
  if (packageManifest.name !== packageJson.name || packageManifest.version !== packageJson.version) {
    throw new Error("package tarball name/version does not match the release package");
  }
  return { sha256, sha512, bytes: bytes.length };
}

async function writeEvidence(evidencePath, evidence) {
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(`Release evidence written to ${evidencePath}.`);
}

if (mode === "publish") {
  const artifactInfo = await inspectArtifact();
  const release = await githubRelease();
  if (release.tag_name !== tag) throw new Error("GitHub Release tag does not match release identity");
  if (!release.draft) throw new Error("GitHub Release is already published; do not republish an immutable release");
  if (!`${release.name ?? ""}\n${release.body ?? ""}`.includes(packageJson.version)) {
    throw new Error("draft GitHub Release name/body does not identify the package version");
  }

  let metadata = await registryVersion();
  let registryState = "unpublished";
  if (metadata) {
    if (metadata.name !== packageJson.name || metadata.version !== packageJson.version) {
      throw new Error("registry metadata name/version mismatch");
    }
    if (metadata.dist?.integrity !== artifactInfo.sha512) {
      throw new Error("immutable registry version exists with a different tarball digest; stop for superseding release");
    }
    if (!hasProvenance(metadata)) throw new Error("matching registry artifact has no npm provenance attestation");
    registryState = "already-published-matching";
  } else {
    const publishOutput = await retry("npm publish", async () => {
      const output = await run("npm", ["publish", artifact, "--provenance", "--access", "public", "--tag", distTag, "--registry", registry]);
      return output;
    });
    if (publishOutput) console.log(publishOutput);
    metadata = await retry("post-publish registry inspection", registryVersion);
    if (!metadata) throw new Error("npm publish returned successfully but registry version is not visible");
    if (metadata.dist?.integrity !== artifactInfo.sha512) throw new Error("published registry tarball digest mismatch");
    if (!hasProvenance(metadata)) throw new Error("published registry artifact has no npm provenance attestation");
    registryState = "published-and-verified";
  }

  const evidencePath = args.get("evidence") ?? "release-artifacts/release-evidence.json";
  const evidence = {
    schemaVersion: 1,
    package: packageJson.name,
    version: packageJson.version,
    tag,
    mergeSha,
    registry,
    distTag,
    tarball: artifactInfo,
    registryState,
    provenance: hasProvenance(metadata),
    githubReleaseId: release.id,
    githubReleaseDraft: true,
    generatedAt: new Date().toISOString(),
  };
  await writeEvidence(evidencePath, evidence);

  const manifest = JSON.parse(await readFile("release-manifest.json", "utf8"));
  manifest.status = "verified";
  manifest.sourceCommit = mergeSha;
  manifest.artifacts = { sha256: artifactInfo.sha256, sha512: artifactInfo.sha512 };
  await writeFile(args.get("manifest") ?? "release-artifacts/release-manifest.json", `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Registry state ${registryState}; provenance verified; publication checkpoint is ready.`);
} else {
  const evidencePath = args.get("evidence") ?? "release-artifacts/release-evidence.json";
  const evidence = JSON.parse(await readFile(evidencePath, "utf8"));
  if (evidence.tag !== tag || evidence.version !== packageJson.version || evidence.mergeSha !== mergeSha) {
    throw new Error("release evidence does not match the finalization identity");
  }
  if (!evidence.provenance) throw new Error("release evidence does not prove npm provenance");
  const release = await githubRelease();
  if (!release.draft) throw new Error("GitHub Release is already published; finalization is not repeatable");
  const output = await retry("GitHub Release publication", () =>
    run("gh", [
      "api",
      "--method",
      "PATCH",
      `repos/${repository}/releases/${release.id}`,
      "-F",
      "draft=false",
      "-F",
      `prerelease=${packageJson.version.includes("-")}`,
    ]),
  );
  if (!output) throw new Error("GitHub Release publication returned no response");
  console.log(`GitHub Release ${release.id} published after registry and provenance verification.`);
}
