import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import Ajv from "ajv";
import { parseDocument } from "yaml";

// Do not fetch editor $schema URLs: validation must work offline after install.
const ajv = new Ajv({ allErrors: true, strict: false, validateFormats: false });
const object = { type: "object" };
const strings = { type: "array", items: { type: "string" } };
const stringMap = { type: "object", additionalProperties: { type: "string" } };
const contract = (required, properties) => ({ type: "object", required, properties });
const schemas = new Map([
  ["native/rnnoise/manifest.json", contract(["engine", "version", "abiVersion", "zigVersion", "source", "model", "artifact", "cSources"], {
    engine: { const: "RNNoise" }, version: { const: "0.2" }, abiVersion: { const: 1 }, zigVersion: { const: "0.15.2" },
    source: contract(["url", "revision", "sha256"], { url: { type: "string" }, revision: { type: "string" }, sha256: { type: "string", pattern: "^[0-9a-f]{64}$" } }),
    model: contract(["url", "revision", "sha256"], { url: { type: "string" }, revision: { type: "string" }, sha256: { type: "string", pattern: "^[0-9a-f]{64}$" } }),
    artifact: contract(["path", "sha256", "memoryBytes", "stackBytes"], {
      path: { const: "src/effects/audio/assets/rnnoise.wasm" }, sha256: { type: "string", pattern: "^[0-9a-f]{64}$" },
      memoryBytes: { type: "integer", minimum: 1 }, stackBytes: { type: "integer", minimum: 1 },
    }), cSources: { type: "array", minItems: 1, items: { type: "string" } },
  })],
  ["tests/fixtures/audio-quality-sources.json", { type: "array", minItems: 1,
    items: contract(["name", "archivePath", "sha256", "license", "source", "attribution"], {
      name: { type: "string" }, archivePath: { type: "string" }, sha256: { type: "string", pattern: "^[0-9a-f]{64}$" },
      license: { const: "CC-BY-4.0" }, source: { type: "string" }, attribution: { type: "string" },
    }),
  }],
  [".oxfmtrc.json", JSON.parse(readFileSync("node_modules/oxfmt/configuration_schema.json", "utf8"))],
  [".oxlintrc.json", JSON.parse(readFileSync("node_modules/oxlint/configuration_schema.json", "utf8"))],
  ["package.json", contract(["name", "version", "scripts", "packageManager"], {
    name: { type: "string", minLength: 1 }, version: { type: "string", pattern: "^\\d+\\.\\d+\\.\\d+" },
    scripts: stringMap, dependencies: stringMap, devDependencies: stringMap,
    peerDependencies: stringMap, engines: stringMap, private: { type: "boolean" },
    packageManager: { const: "pnpm@11.21.0" },
  })],
  ["tsconfig.json", contract(["compilerOptions"], {
    compilerOptions: object, extends: { type: ["string", "array"] },
    include: strings, exclude: strings, files: strings,
  })],
  ["release-manifest.json", contract(["schemaVersion", "status", "version", "tag", "packages", "artifacts", "provenance"], {
    schemaVersion: { const: 1 }, status: { enum: ["proposed", "verified", "published"] },
    version: { type: "string" }, tag: { type: "string" },
    packages: { type: "array", minItems: 1, items: contract(["name", "version", "registry", "distTag"], {
      name: { type: "string" }, version: { type: "string" }, registry: { type: "string" }, distTag: { type: "string" },
    }) }, artifacts: object, provenance: { type: "string" },
  })],
  ["supply-chain/policy.json", contract(["schemaVersion", "packageManager", "licenses", "thirdPartyInputs"], {
    schemaVersion: { const: 1 }, packageManager: object, licenses: object, thirdPartyInputs: object,
  })],
  ["supply-chain/dependencies.json", contract(["schemaVersion", "entries"], {
    schemaVersion: { const: 1 }, entries: { type: "array", items: contract(["name", "version", "license", "source"], {
      name: { type: "string" }, version: { type: "string" }, license: { type: "string" }, source: { type: "string" },
    }) },
  })],
  ["supply-chain/assets.json", contract(["schemaVersion", "assets", "requiredFieldsWhenAdded"], {
    schemaVersion: { const: 1 }, assets: { type: "array", items: object }, requiredFieldsWhenAdded: strings,
  })],
  ["supply-chain/exceptions.json", contract(["schemaVersion", "licenseExceptions", "vulnerabilityExceptions"], {
    schemaVersion: { const: 1 }, licenseExceptions: { type: "array", items: object }, vulnerabilityExceptions: { type: "array", items: object },
  })],
  [".orca/task-pr-lifecycle.json", contract(["version", "lifecycle"], { version: { const: 1 }, lifecycle: object })],
  ["pnpm-workspace.yaml", contract([], { packages: strings, overrides: stringMap })],
  [".github/release.yml", contract(["changelog"], { changelog: contract(["categories"], {
    categories: { type: "array", items: contract(["title", "labels"], { title: { type: "string" }, labels: strings }) },
    exclude: object,
  }) })],
  ["backlog/config.yml", contract(["project_name", "statuses", "default_status"], {
    project_name: { type: "string" }, statuses: strings, default_status: { type: "string" },
  })],
]);
const files = [...new Set(execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  { encoding: "utf8" }).split("\0").filter(Boolean))].sort();
let checked = 0;
let failed = false;
for (const file of files) {
  if (!/\.(json|ya?ml)$/.test(file) || !existsSync(file)) continue;
  try {
    const source = readFileSync(file, "utf8");
    let value;
    if (file.endsWith(".json")) value = JSON.parse(source);
    else {
      const document = parseDocument(source, { uniqueKeys: true });
      if (document.errors.length) throw new Error(document.errors.map((error) => error.message).join("; "));
      value = document.toJS();
    }
    // Measurement evidence and generated lockfiles get syntax checks only.
    if (file.startsWith("docs/measurements/") || file.endsWith("pnpm-lock.yaml")) {
      checked++;
      continue;
    }
    // actionlint owns the full GitHub Actions syntax/expression schema.
    if (/^\.github\/workflows\/[^/]+\.ya?ml$/.test(file)) {
      checked++;
      continue;
    }
    const key = /(^|\/)package\.json$/.test(file) ? "package.json"
      : /(^|\/)tsconfig[^/]*\.json$/.test(file) ? "tsconfig.json"
      : file.endsWith("pnpm-workspace.yaml") ? "pnpm-workspace.yaml" : file;
    const schema = schemas.get(key);
    if (!schema) throw new Error("configuration has no schema owner; add it to scripts/check-config.mjs and docs/quality-gates.md");
    const validate = ajv.compile(schema);
    if (!validate(value)) throw new Error(ajv.errorsText(validate.errors, { separator: "; " }));
    if (key === "tsconfig.json") {
      execFileSync("pnpm", ["exec", "tsc", "--showConfig", "-p", file], { stdio: ["ignore", "pipe", "pipe"] });
    }
    checked++;
  } catch (error) {
    failed = true;
    console.error(`${file}: ${error.message}${error.stdout ? `\n${error.stdout}` : ""}`);
  }
}
console.log(`Configuration inventory: ${checked} JSON/YAML files checked (no remote schemas).`);
process.exitCode = failed ? 1 : 0;
