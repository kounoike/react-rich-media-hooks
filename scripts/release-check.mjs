import { access, readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const argument = process.argv[index];
  if (argument === "--") continue;
  if (argument === "--dry-run") {
    args.set("dry-run", true);
  } else if (argument.startsWith("--")) {
    args.set(argument.slice(2), process.argv[++index]);
  }
}

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const changelog = await readFile("CHANGELOG.md", "utf8");
const tagpr = await readFile(".tagpr", "utf8");
const releaseConfig = await readFile(".github/release.yml", "utf8");
const workflow = await readFile(".github/workflows/release.yml", "utf8");
const publisher = await readFile("scripts/release-publish.mjs", "utf8");
const manifest = JSON.parse(await readFile("release-manifest.json", "utf8"));
const failures = [];

function requireText(text, expected, context) {
  if (!text.includes(expected)) failures.push(`${context} must contain ${expected}`);
}

function requirePattern(text, pattern, context) {
  if (!pattern.test(text)) failures.push(`${context} does not satisfy ${pattern}`);
}

requirePattern(packageJson.version, /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/, "package version");
if (packageJson.version.includes("-")) {
  const channel = packageJson.version.split("-")[1].split(".")[0];
  if (!["alpha", "beta", "rc"].includes(channel)) failures.push(`unsupported prerelease channel ${channel}`);
}
if (packageJson.private !== false) failures.push("package.json must be public for release publishing");
if (packageJson.publishConfig?.access !== "public") failures.push("publishConfig.access must be public");
if (packageJson.publishConfig?.registry !== "https://registry.npmjs.org/") {
  failures.push("publishConfig.registry must be https://registry.npmjs.org/");
}
requireText(packageJson.repository?.url ?? "", "github.com/kounoike/react-rich-media-hooks", "package repository");

for (const [key, value] of Object.entries({
  "releaseBranch = main": "tagpr release branch",
  "versionFile = package.json": "tagpr version file",
  "vPrefix = true": "tagpr v-prefix",
  "changelog = true": "tagpr changelog",
  "changelogFile = CHANGELOG.md": "tagpr changelog file",
  "releaseYAMLPath = .github/release.yml": "tagpr release-note config",
  "release = draft": "tagpr draft release",
  "majorLabels = release:major": "tagpr major label",
  "minorLabels = release:minor": "tagpr minor label",
  "postVersionCommand = pnpm release:manifest": "tagpr manifest hook",
})) requireText(tagpr, key, value);

requireText(changelog, "# Changelog", "changelog title");
requirePattern(changelog, /^## \[Unreleased\]/m, "changelog Unreleased section");
for (const category of ["Added", "Changed", "Deprecated", "Removed", "Fixed", "Security"]) {
  requirePattern(changelog, new RegExp(`^### ${category}$`, "m"), `changelog ${category} category`);
}
for (const label of ["release:none", "release:patch", "release:minor", "release:major", "release:security"]) {
  requireText(releaseConfig, `"${label}"`, `release-note label ${label}`);
}
requireText(releaseConfig, '"tagpr"', "release-note tagpr exclusion");
requireText(releaseConfig, '"dependabot[bot]"', "release-note bot exclusion");

if (manifest.schemaVersion !== 1) failures.push("release-manifest schemaVersion must be 1");
if (manifest.version !== packageJson.version) failures.push("release-manifest version must match package.json");
if (manifest.tag !== `v${packageJson.version}`) failures.push("release-manifest tag must match package.json");
if (manifest.packages?.length !== 1 || manifest.packages[0]?.name !== packageJson.name) {
  failures.push("release-manifest must list the package exactly once");
}
if (manifest.packages[0]?.version !== packageJson.version) failures.push("release-manifest package version mismatch");
if (manifest.provenance !== "npm-trusted-publishing-oidc") failures.push("release-manifest must require npm OIDC provenance");

requirePattern(workflow, /^permissions:\n  contents: read/m, "release workflow read-only default permissions");
requireText(workflow, "cancel-in-progress: false", "release workflow concurrency");
requireText(workflow, "environment: npm-publish", "protected publication environment");
requireText(workflow, "contents: write", "tag/release write permission");
requireText(workflow, "id-token: write", "npm OIDC permission");
requireText(workflow, "pull-requests: write", "tagpr pull request permission");
requireText(workflow, "issues: read", "tagpr issue permission");
requireText(`${workflow}\n${publisher}`, "--provenance", "npm provenance publish flag");
requireText(`${workflow}\n${publisher}`, "--access", "public npm publish access");
requireText(workflow, "workflow_dispatch:", "manual dry-run trigger");
requireText(workflow, "dry_run:", "manual dry-run input");
requireText(workflow, "scripts/release-publish.mjs", "release publication script");
for (const command of ["pnpm package:check", "pnpm test:browser:smoke", "pnpm run supply-chain:check", "pnpm pack --dry-run"]) {
  requireText(workflow, command, `release gate command ${command}`);
}
for (const forbidden of ["NPM_TOKEN", "NODE_AUTH_TOKEN", "npm-token"]) {
  if (workflow.includes(forbidden)) failures.push(`release workflow must not use long-lived credential ${forbidden}`);
}

const dryRun = args.get("dry-run") === true;
const tag = args.get("tag");
const mergeSha = args.get("merge-sha");
if (!dryRun && !tag) failures.push("--tag is required for a tagged release check");
if (!dryRun && tag) {
  const expectedTag = `v${packageJson.version}`;
  if (tag !== expectedTag) failures.push(`tag ${tag} must match ${expectedTag}`);
  if (!/^[vV]\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(tag)) failures.push(`tag ${tag} is not normalized SemVer`);
  const escapedVersion = packageJson.version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (!new RegExp(`^## \\[?v?${escapedVersion}\\]?`, "m").test(changelog)) {
    failures.push(`changelog must contain the released version ${packageJson.version}`);
  }
  if (!/^[0-9a-f]{40}$/i.test(mergeSha ?? "")) failures.push("merge-sha must be a full commit SHA");
  try {
    const { stdout } = await execFileAsync("git", ["rev-parse", `${tag}^{commit}`], { encoding: "utf8" });
    if (stdout.trim() !== mergeSha) failures.push(`tag ${tag} points to ${stdout.trim()}, expected ${mergeSha}`);
  } catch (error) {
    failures.push(`cannot resolve tag ${tag}: ${error.message}`);
  }
  if (process.env.GH_TOKEN && process.env.GITHUB_REPOSITORY) {
    try {
      const { stdout } = await execFileAsync("gh", ["api", `repos/${process.env.GITHUB_REPOSITORY}/releases/tags/${tag}`], { encoding: "utf8" });
      const release = JSON.parse(stdout);
      if (release.tag_name !== tag) failures.push("draft GitHub Release tag mismatch");
      if (!release.draft) failures.push("GitHub Release must remain draft until registry verification completes");
      if (!`${release.name ?? ""}\n${release.body ?? ""}`.includes(packageJson.version)) failures.push("draft GitHub Release name/body must identify its version");
      console.log(`Draft GitHub Release ${release.id} reconciled for ${tag}.`);
    } catch (error) {
      failures.push(`cannot reconcile draft GitHub Release: ${error.message}`);
    }
  } else {
    failures.push("GH_TOKEN and GITHUB_REPOSITORY are required for a tagged release check");
  }
}

try {
  await access(".artifacts");
  const tarballs = (await readdir(".artifacts")).filter((file) => file.endsWith(".tgz"));
  if (tarballs.length !== 1) failures.push(`expected one package tarball in .artifacts, found ${tarballs.length}`);
  if (tarballs.length === 1) {
    const { stdout: tarContents } = await execFileAsync("tar", ["-tzf", `.artifacts/${tarballs[0]}`], { encoding: "utf8" });
    for (const entry of tarContents.trim().split("\n")) {
      if (entry && !/^package\/(?:package\.json|README\.md|LICENSE|dist\/.+)$/.test(entry)) {
        failures.push(`unexpected package entry: ${entry}`);
      }
    }
    const { stdout: packedManifest } = await execFileAsync("tar", ["-xOzf", `.artifacts/${tarballs[0]}`, "package/package.json"], { encoding: "utf8" });
    const packedPackage = JSON.parse(packedManifest);
    if (packedPackage.name !== packageJson.name || packedPackage.version !== packageJson.version) {
      failures.push("packed package name/version must match package.json");
    }
    const digest = createHash("sha256").update(await readFile(`.artifacts/${tarballs[0]}`)).digest("hex");
    console.log(`Package dry-run artifact ${tarballs[0]} sha256=${digest}.`);
  }
} catch (error) {
  if (!dryRun) failures.push(`package artifact inspection failed: ${error.message}`);
}

if (failures.length > 0) {
  console.error("Release checks failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(dryRun ? "Release dry-run checks passed; no publish or release mutation was attempted." : `Release identity checks passed for ${tag}.`);
}
