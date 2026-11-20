# Local and CI quality gates

TASK-3 adds a shared, check-only gate under the accepted Decision-5 toolchain.
Install mise 2026.11.10 (the CI version), review/trust this repository's configuration,
then run:

```sh
mise trust
mise install
mise exec -- pnpm install --frozen-lockfile --ignore-scripts
mise run hooks-install
mise run quality
```

Keep mise on Git's PATH, including in GUI clients. `hooks-install` runs
`hk install --mise`: hk installs the repository's `pre-commit` launcher through
mise, so contributors do not need shell activation. Git worktrees share hook
storage; inspect an existing `core.hooksPath` or custom hook before installation
and preserve any existing hook commands. Do not force-overwrite custom hooks.
Repositories without `hk.pkl` are ignored by hk's launcher. Install hooks explicitly;
package installation, including CI's `--ignore-scripts`, does not modify Git hooks.

`pnpm quality:gate` (or `mise run quality`) runs `hk check --all`. Its configuration,
Zig, and existing `pnpm verify` steps always check the whole working tree, even for
a documentation-only commit. Pre-commit uses those same steps with fixing, staging,
stashing, and result caching disabled. It checks working-tree contents, including
unstaged edits; stage the intended changes before committing. The gate does not
rewrite sources or the index. Build/test/package checks still create ignored outputs.

Use `mise exec -- pnpm format:write` to apply native Oxfmt fixes and
`mise exec -- pnpm lint:fix` for reviewed Oxlint fixes. `format:check` covers native
TS/TSX/JS/JSX/JSON/YAML/TOML/CSS in source, tests, the standalone example and the
configuration paths below. `lint` retains the existing semantic/type-aware Oxlint
scope (`src`, `tests`); `typecheck` and package consumer checks remain authoritative.
The standalone example retains its separate dependency lockfile and typecheck command.
Markdown/HTML, historical experiments, and existing maintenance scripts remain outside
the native format/lint baseline specified in Decision-5.

## Configuration inventory

`config:check` inventories Git-tracked and nonignored new JSON/YAML files using
NUL-delimited filenames. Unknown configuration paths fail until assigned a validation
owner in `scripts/check-config.mjs`. Editor `$schema` URLs are never downloaded.
Ajv 8.20.0 and YAML 2.9.1 are exact, development-only dependencies in the frozen lockfile.
Repository contracts validate the fields described below, rather than claiming complete
upstream schemas for every file.

| Files | Formatting | Schema / semantic owner |
| --- | --- | --- |
| `.oxfmtrc.json`, `.oxlintrc.json` | Oxfmt | Full schemas shipped with the exact installed Oxc packages, evaluated by Ajv |
| Root and example `package.json` | Oxfmt | Repository manifest shape, string dependency/script maps, exact pnpm; frozen installation, package consumer checks and supply-chain inventory |
| Root and example `tsconfig*.json` | Oxfmt | Repository shape plus TypeScript 7 `tsc --showConfig` option/config resolution; existing typecheck/build owns compilation |
| `.github/workflows/*.yml` | Oxfmt | YAML parser plus actionlint 1.7.12 workflow, expression and action-input checks; optional shellcheck/pyflakes integrations disabled for deterministic tool scope |
| `.github/release.yml` | Oxfmt | YAML parser and repository changelog/category contract |
| Root and example `pnpm-workspace.yaml` | Oxfmt | YAML parser and packages/overrides shape; frozen installation owns resolver semantics |
| `supply-chain/*.json` | Oxfmt | Versioned repository contract plus existing `supply-chain:check` dependency/license/asset/action-pin validation (including exception expiry) |
| `release-manifest.json` | Oxfmt | Version/status/package/artifact shape; existing release checks remain the release-semantic owner |
| `.orca/task-pr-lifecycle.json` | Oxfmt | Repository version/lifecycle shape plus unchanged `validate:lifecycle` |
| `backlog/config.yml` | CLI-owned; not rewritten | YAML parser and project/status shape; Backlog CLI owns task/config semantics |
| `mise.toml`, `hk.pkl` | Oxfmt for TOML | mise parses its tool/task configuration; `hk validate --deny-warnings` evaluates the pinned typed Pkl module |
| Both `pnpm-lock.yaml` files | Generated; not rewritten | YAML syntax; frozen pnpm installation owns lockfile compatibility/integrity |
| `docs/measurements/*.json` | Historical evidence; not rewritten | JSON syntax only; device/benchmark evidence is not a configuration schema |
| `.editorconfig`, `.gitignore`, `.tagpr` | Maintainer-owned text | No new formatter/schema engine; retain existing editor/Git/release interpretation |

Adding a new TOML/Pkl or non-JSON/YAML configuration format requires extending this
inventory and its format/validation commands. The gate does not infer schemas from
untrusted remote `$schema` declarations. The pre-existing `$schema` metadata in the
supply-chain and lifecycle files is not interpreted as a claim that those documents
are JSON Schema definitions.

## Zig preparation

mise pins Zig 0.15.2 for `zig:check`. With no `.zig`/`.zig.zon` files it succeeds
without invoking Zig. New tracked or nonignored files automatically receive
`zig fmt --check`; `.zig` sources also receive `zig ast-check`. Ignored `.zig-cache`
and `zig-out` directories are excluded. Filenames with spaces are passed as individual
arguments, with no shell expansion.

These are compiler-provided formatting and AST diagnostics, not full target-dependent
semantic compilation or third-party lint. They require neither `build.zig` nor a
particular Wasm/native target and do not execute a future build graph. TASK-1.12 retains
ownership of its implementation, semantic compilation, target/toolchain compatibility,
and runtime tests. If that work adopts a different compiler version, reconcile the
single mise pin in its integration review.

## CI and tool updates

The existing quality job runs the same `pnpm quality:gate` on every PR and `main`
push. Coverage remains an additional CI check; browser smoke, periodic matrix,
supply-chain audit/signatures, and release jobs retain their existing behavior.
The exact SHA-pinned mise action installs only hk/Pkl/Zig/actionlint, exposes only
their bin directories, and leaves Node 22.23.2/24.19.0 and pnpm setup to the existing
actions. It does not install Git hooks or run fixes in CI.

hk 2.13.0 and its Pkl package URL are updated together; Pkl 0.31.1,
actionlint 1.7.12, Zig 0.15.2, and Node/pnpm are pinned in `mise.toml`.
The mise registry currently recommends jactionlint over its deprecated actionlint alias;
this gate deliberately uses the pinned upstream actionlint release. Review tool updates,
licenses, the action pin/policy, and the frozen npm lockfile together. Initial installation
and Pkl package caching require network access; checks do not fetch schemas or audit
registries after installation. `supply-chain:check` still evaluates exception expiry against
the current date (or its existing `SUPPLY_CHAIN_AS_OF` override).

References: [hk configuration](https://hk.jdx.dev/configuration),
[hk installation](https://hk.jdx.dev/cli/install.html),
[actionlint](https://github.com/rhysd/actionlint),
[Zig 0.15.2](https://ziglang.org/documentation/0.15.2/).
