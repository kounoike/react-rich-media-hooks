import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(new URL("..", import.meta.url).pathname);
const failures = [];

function readJson(relativePath) {
  const path = join(root, relativePath);
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    failures.push(`${relativePath}: ${error.message}`);
    return {};
  }
}

function requireField(value, field, context) {
  if (typeof value?.[field] !== "string" || value[field].length === 0) {
    failures.push(`${context} must define ${field}`);
  }
}

const packageJson = readJson("package.json");
const policy = readJson("supply-chain/policy.json");
const inventory = readJson("supply-chain/dependencies.json");
const assets = readJson("supply-chain/assets.json");
const exceptions = readJson("supply-chain/exceptions.json");
const asOf = process.env.SUPPLY_CHAIN_AS_OF ?? new Date().toISOString().slice(0, 10);

const packageManager = packageJson.packageManager;
const expectedPackageManager = `${policy.packageManager?.name}@${policy.packageManager?.version}`;
if (packageManager !== expectedPackageManager) {
  failures.push(`packageManager must be ${expectedPackageManager}; found ${packageManager ?? "missing"}`);
}

const pnpm = spawnSync("pnpm", ["--version"], { cwd: root, encoding: "utf8" });
if (pnpm.status !== 0 || pnpm.stdout.trim() !== policy.packageManager?.version) {
  failures.push(`pnpm must report ${policy.packageManager?.version}; found ${pnpm.stdout.trim() || pnpm.stderr.trim()}`);
}

const lockfilePath = join(root, "pnpm-lock.yaml");
let lockfile = "";
try {
  lockfile = readFileSync(lockfilePath, "utf8");
} catch (error) {
  failures.push(`pnpm-lock.yaml: ${error.message}`);
}

if (!lockfile.startsWith(`lockfileVersion: '${policy.packageManager?.lockfileVersion}'`)) {
  failures.push(`pnpm-lock.yaml must use lockfile version ${policy.packageManager?.lockfileVersion}`);
}
const resolutionLines = lockfile.split("\n").filter((line) => /^ {4}resolution:/.test(line));
if (resolutionLines.length === 0) {
  failures.push("pnpm-lock.yaml has no package resolutions to validate");
}
if (resolutionLines.some((line) => !line.includes("integrity:"))) {
  failures.push("every registry resolution in pnpm-lock.yaml must include integrity");
}
if (resolutionLines.some((line) => /(?:git\+|file:|link:|tarball:|resolution:\s*https?:)/.test(line))) {
  failures.push("pnpm-lock.yaml contains a non-registry resolution without explicit review");
}

const directDependencies = {
  ...(packageJson.dependencies ?? {}),
  ...(packageJson.optionalDependencies ?? {}),
  ...(packageJson.devDependencies ?? {}),
  ...(packageJson.peerDependencies ?? {}),
};
const inventoryEntries = Array.isArray(inventory.entries) ? inventory.entries : [];
const inventoryByName = new Map();
for (const entry of inventoryEntries) {
  if (inventoryByName.has(entry.name)) {
    failures.push(`dependency inventory contains duplicate ${entry.name}`);
  }
  inventoryByName.set(entry.name, entry);
  for (const field of ["name", "role", "version", "license", "registryTarball", "source", "owner", "updateCadence"]) {
    requireField(entry, field, `dependency inventory entry ${entry.name ?? "<unnamed>"}`);
  }
  if (entry.registryTarball && !entry.registryTarball.startsWith(`${policy.packageManager?.registry}/`)) {
    failures.push(`${entry.name} registryTarball must use ${policy.packageManager?.registry}`);
  }
  if (entry.source && !/^https:\/\//.test(entry.source)) {
    failures.push(`${entry.name} source must be an HTTPS URL`);
  }
}
for (const name of Object.keys(directDependencies)) {
  const entry = inventoryByName.get(name);
  if (!entry) {
    failures.push(`dependency inventory is missing direct dependency ${name}`);
    continue;
  }
  const specifier = directDependencies[name];
  if (packageJson.devDependencies?.[name] && packageJson.devDependencies[name] === specifier && specifier !== entry.version) {
    failures.push(`${name} inventory version ${entry.version} does not match devDependency ${specifier}`);
  }
  if (packageJson.peerDependencies?.[name] && entry.requestedRange !== packageJson.peerDependencies[name]) {
    failures.push(`${name} inventory requestedRange does not match peerDependency ${packageJson.peerDependencies[name]}`);
  }
}
for (const name of inventoryByName.keys()) {
  if (!Object.hasOwn(directDependencies, name)) {
    failures.push(`dependency inventory contains non-direct dependency ${name}`);
  }
}

for (const entry of inventoryEntries) {
  const packagePath = join(root, "node_modules", entry.name, "package.json");
  try {
    const installed = JSON.parse(readFileSync(packagePath, "utf8"));
    if (installed.version !== entry.version) {
      failures.push(`${entry.name} inventory version ${entry.version} does not match installed ${installed.version}`);
    }
    const installedLicense = typeof installed.license === "string" ? installed.license : undefined;
    if (installedLicense && installedLicense !== entry.license) {
      failures.push(`${entry.name} inventory license ${entry.license} does not match installed ${installedLicense}`);
    }
  } catch (error) {
    failures.push(`${entry.name} is not installed; run pnpm install --frozen-lockfile first (${error.message})`);
  }
}

const licenseExceptions = Array.isArray(exceptions.licenseExceptions) ? exceptions.licenseExceptions : [];
const vulnerabilityExceptions = Array.isArray(exceptions.vulnerabilityExceptions) ? exceptions.vulnerabilityExceptions : [];
const allowedLicenses = new Set(policy.licenses?.allowedSpdx ?? []);
const licenseRun = spawnSync("pnpm", ["licenses", "list", "--json"], { cwd: root, encoding: "utf8" });
if (licenseRun.status !== 0) {
  failures.push(`pnpm licenses list failed: ${licenseRun.stderr.trim()}`);
} else {
  try {
    const licenseReport = JSON.parse(licenseRun.stdout);
    for (const [license, records] of Object.entries(licenseReport)) {
      for (const record of records) {
        for (const version of record.versions ?? []) {
          const coveredByException = licenseExceptions.some(
            (exception) => exception.package === record.name && exception.version === version && exception.license === license,
          );
          if (!allowedLicenses.has(license) && !coveredByException) {
            failures.push(`${record.name}@${version} uses unapproved license ${license}; record a reviewed exception`);
          }
        }
      }
    }
  } catch (error) {
    failures.push(`pnpm licenses list did not return JSON: ${error.message}`);
  }
}

const allExceptions = [...licenseExceptions, ...vulnerabilityExceptions];
const seenVulnerabilities = new Set();
for (const exception of allExceptions) {
  for (const field of ["package", "version", "reason", "reviewer", "owner", "opened", "expires"]) {
    requireField(exception, field, "supply-chain exception");
  }
  if (exception.expires && exception.expires <= asOf) {
    failures.push(`expired supply-chain exception for ${exception.package}@${exception.version}: ${exception.expires}`);
  }
}
for (const exception of vulnerabilityExceptions) {
  requireField(exception, "advisory", "vulnerability exception");
  if (exception.advisory) {
    if (seenVulnerabilities.has(exception.advisory)) {
      failures.push(`duplicate vulnerability exception ${exception.advisory}`);
    }
    seenVulnerabilities.add(exception.advisory);
  }
  requireField(exception, "mitigation", "vulnerability exception");
}

const assetEntries = Array.isArray(assets.assets) ? assets.assets : [];
for (const asset of assetEntries) {
  for (const field of assets.requiredFieldsWhenAdded ?? []) {
    requireField(asset, field, `asset ${asset.name ?? "<unnamed>"}`);
  }
  if (asset.sha256 && !/^[a-f0-9]{64}$/i.test(asset.sha256)) {
    failures.push(`asset ${asset.name} must use a 64-character SHA-256 digest`);
  }
}

const actionPolicy = new Map((policy.thirdPartyInputs?.actions ?? []).map((action) => [action.name, action]));
const workflowsPath = join(root, ".github", "workflows");
if (existsSync(workflowsPath)) {
  for (const filename of readdirSync(workflowsPath).filter((name) => /\.ya?ml$/.test(name))) {
    const workflow = readFileSync(join(workflowsPath, filename), "utf8");
    for (const match of workflow.matchAll(/^\s*uses:\s*([^\s#]+)@([^\s#]+).*$/gm)) {
      const [, actionName, ref] = match;
      if (actionName.startsWith("./")) continue;
      if (!/^[a-f0-9]{40}$/i.test(ref)) {
        failures.push(`${filename}: ${actionName} must use a full 40-character commit SHA`);
        continue;
      }
      const approved = actionPolicy.get(actionName);
      if (!approved || approved.sha.toLowerCase() !== ref.toLowerCase()) {
        failures.push(`${filename}: ${actionName}@${ref} is not recorded in policy.json`);
      }
    }
  }
}

if (failures.length > 0) {
  console.error("Supply-chain checks failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(
    `Supply-chain checks passed: ${inventoryEntries.length} direct dependencies, ${resolutionLines.length} integrity-pinned resolutions, ${licenseExceptions.length} license exceptions, ${assetEntries.length} distributed assets.`,
  );
}
