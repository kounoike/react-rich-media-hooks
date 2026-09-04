import { readFile, writeFile } from "node:fs/promises";

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const version = packageJson.version;
const prerelease = version.includes("-");
const channel = prerelease ? version.split("-")[1].split(".")[0] : "latest";
if (prerelease && !["alpha", "beta", "rc"].includes(channel)) {
  throw new Error(`Unsupported prerelease channel: ${channel}; use alpha, beta, or rc`);
}
const sourceCommit = process.env.RELEASE_SOURCE_COMMIT ?? null;
const manifest = {
  schemaVersion: 1,
  status: sourceCommit ? "verified" : "proposed",
  version,
  tag: `v${version}`,
  sourceCommit,
  packages: [
    {
      name: packageJson.name,
      version,
      registry: packageJson.publishConfig?.registry ?? "https://registry.npmjs.org/",
      distTag: channel === "alpha" ? "next" : channel,
    },
  ],
  artifacts: {
    sha256: null,
    sha512: null,
  },
  provenance: "npm-trusted-publishing-oidc",
};

await writeFile("release-manifest.json", `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Release manifest generated for ${manifest.tag} (${manifest.status}).`);
