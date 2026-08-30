---
id: doc-8
title: Development Toolchain Contract Proposal
type: specification
created_date: '2026-08-30 21:30'
updated_date: '2026-08-30 21:38'
---
# Development Toolchain Contract Proposal

Status: approval-bound proposal for TASK-1.18. This document records evaluated alternatives and a recommended contract; it does not accept a dependency, compatibility, distribution, release, public API, or architecture choice. No production source, package metadata, CI workflow, or tool configuration should be implemented from this proposal until the user explicitly approves the recommendation or a revision.

## 1. Scope and constraints

This contract covers contributor-visible development behavior for the headless React rich-media library:

- TypeScript source checking and declaration generation.
- Semantic linting and source formatting.
- JavaScript/package building.
- Deterministic unit and contract tests.
- Browser integration tests against the verification matrix.
- Published-package and consumer-resolution validation.
- Required commands, ownership, generated files, caches, local/CI responsibilities, and maintenance policy.

It does not select media algorithms, worker/worklet placement, model/runtime assets, public export names, fallback semantics, browser minimums, React peer ranges, or an asset-hosting policy. Those remain governed by the approval gates in decision-1, decision-2, and proposed decision-3.

The contract must preserve these constraints:

- React 18.2 and React 19 remain the compatibility hypothesis; React 19's modern JSX transform is required for the React-facing source.
- Imports and inert server construction are SSR-safe. Browser-only media activation happens after hydration and explicit application action.
- The package is ESM-first with explicit entry points and optional effect code split from the base import, subject to approval of proposed decision-3.
- The cross-browser strategy in doc-6 owns the browser matrix and cadence: deterministic checks plus Chrome/Firefox pull-request smoke, Edge/Safari periodic coverage, and release/reference-device evidence.
- Optional workers, worklets, WebAssembly, models, and other runtime assets must not be downloaded or initialized by an import or package-install script.
- The repository's existing Orca/Backlog lifecycle checks remain required and are not part of the product toolchain selection.

## 2. Evidence and current baseline

### 2.1 Repository facts

As inspected on 2026-08-31 at the TASK-1.18 branch:

| Area | Current state | Contract implication |
| --- | --- | --- |
| Package manifest | Private shell with packageManager pnpm@11.21.0; only backlog:dispatchable, orchestration:coordinator, and validate:lifecycle scripts | The development contract must add quality/build commands explicitly rather than assuming an existing convention |
| Runtime declaration | mise.toml says Node LTS and pnpm latest | LTS/latest are moving targets; the accepted contract needs explicit CI versions or a documented refresh rule |
| Lockfile | pnpm lockfile version 9 with an empty root importer | Every selected tool and version will be a new, reviewable dependency addition |
| Source/configuration | No src directory, tsconfig, linter, formatter, build, test, browser, or package-validation configuration exists | This task records the contract; bootstrap implementation is approval-gated |
| Existing checks | pnpm run validate:lifecycle and pnpm run backlog:dispatchable validate repository workflow policy | These commands remain separate from source quality checks |
| Ignored outputs | dist/build/out, coverage, .cache/.turbo/.vite, *.tsbuildinfo, logs, browser/editor files | The selected tools should use these boundaries and keep generated evidence out of commits |

### 2.2 Contract evidence

- TypeScript 6.0 is the current bridge release between the 5.9 line and the native 7.0 compiler. The official release announcement says TypeScript 6.0 is API-compatible with 5.9, while the release notes document DOM updates, ESM-oriented defaults, stricter defaults, and deprecations that must be handled deliberately.
- The TypeScript compiler supports strict checking, JSX emit, declaration emit, isolated modules, and bundler/Node module-resolution modes. TypeScript's declaration documentation describes emitted .d.ts files as the consumer-facing API surface.
- React's official TypeScript guide requires TypeScript plus React type definitions, and React's 19 upgrade guide requires the modern JSX transform and corresponding React 19 type packages.
- Current typescript-eslint documentation supports TypeScript versions below 6.1.0, recommends the latest stable tool major, and documents Project Service as the same type-information service model used by editors. This makes a TypeScript 6.0.x development pin viable but requires a guard against TypeScript 7 until parser support is verified.
- ESLint 9 and later use flat configuration by default; the ESLint migration guide documents the compatibility and migration boundary. The official React Hooks plugin publishes a flat recommended configuration, and eslint-plugin-react publishes React/JSX flat configs.
- Prettier explicitly recommends using the formatter for formatting and a linter for code-quality checks, with eslint-config-prettier disabling overlapping stylistic rules. Biome provides a fast formatter and linter for TypeScript/TSX/JSX, React-domain rules, editor LSP support, and no formatting rules inside its linter.
- Vite library mode supports multiple library entries and ESM/CJS output while externalizing React. Vite 8 requires Node 20.19+ or 22.12+ and uses Rolldown/Oxc. Its output and Node floor must be tested against the approved compatibility contract.
- Vitest provides ESM/TypeScript/JSX support, Node plus DOM-mocking environments, coverage, projects, and optional browser mode. Its browser mode can use Playwright, but using it for the cross-browser matrix would duplicate the Playwright responsibility proposed here.
- Playwright Test runs TypeScript tests but does not type-check them, supports Chromium/Firefox/WebKit and branded-browser projects, and provides retries and trace artifacts. Type checking therefore remains an explicit tsc gate.
- Node's package documentation recommends explicit exports and documents conditional import/require/type conditions. publint checks package compatibility and file/format mistakes; Are The Types Wrong? checks ESM/CJS/type-resolution problems across Node and bundler resolution modes.

## 3. Proposed TypeScript contract

### 3.1 Recommendation

Use an exact lockfile pin of TypeScript 6.0.2 for repository development and CI, initially paired with React 18.2 and 19 consumer fixtures. The package's proposed minimum consumer compiler is TypeScript 5.2, inherited from the approval-bound compatibility/distribution proposal; it is not accepted until generated declarations compile in the fixture matrix.

The repository must not claim that the newest TypeScript major is supported merely because the compiler can parse the source. A candidate update is supported only after:

1. typescript-eslint and the build/declaration path support the version;
2. source type checking and declaration emit pass;
3. generated declarations compile for TypeScript 5.2, the latest supported 5.x line, and the pinned compiler;
4. React 18.2 and React 19 consumer fixtures compile with their matching type packages;
5. NodeNext and Bundler module-resolution fixtures import every public entry point;
6. SSR import fixtures prove that module evaluation accesses no browser global;
7. the package validation and browser smoke gates pass.

### 3.2 Baseline configuration

The following is a proposed baseline, not a file to install without approval:

~~~json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "skipLibCheck": true
  }
}
~~~

Ownership and variants:

- tsconfig.base.json owns shared strictness and browser type libraries.
- tsconfig.typecheck.json extends the base, includes source/configuration files, and sets noEmit true.
- tsconfig.build.json extends the base, includes public source, writes declarations and source maps to dist, and sets emitDeclarationOnly true for the declaration pass.
- tsconfig.test.json extends the base with test globals and test-only include paths; it must not silently change source compiler semantics.
- Node SSR/consumer fixtures use a dedicated NodeNext configuration so package exports are checked as Node consumers, while browser application fixtures use Bundler resolution.
- Use import type and explicit public annotations where needed so emitted declarations do not expose private worker/model types. Do not use a declaration-only shortcut that bypasses the source type check.
- isolatedDeclarations is a possible follow-up hardening option. It is not enabled in this initial proposal because TypeScript documents it as a newer constraint with additional annotation and compatibility costs; it should be evaluated after representative API declarations exist.
- declaration maps and source maps are useful to contributors but are not automatically part of the published-file contract. Publication of maps remains a separate release decision.

### 3.3 React and emitted-type compatibility evidence

The proposal intentionally tests both React lines rather than relying on one development install:

| Fixture | Compiler | React/types | Resolution | Evidence |
| --- | --- | --- | --- | --- |
| react-18 | TypeScript 5.2, latest supported 5.x, and 6.0.2 | React 18.2 plus matching @types/react and @types/react-dom | Bundler | Hooks, JSX, controller snapshots, and declarations compile |
| react-19 | TypeScript 5.2, latest supported 5.x, and 6.0.2 | React 19 plus matching React type packages | Bundler | Modern JSX transform, useSyncExternalStore adapter, and declarations compile |
| ssr-node | TypeScript 5.2 and 6.0.2 | React 18.2 and React 19 variants | NodeNext | Root/core imports and inert construction have no DOM runtime access |
| package-consumer | TypeScript 5.2 and 6.0.2 | React 18.2 and 19 variants | NodeNext and Bundler | Every export-map condition resolves the intended JavaScript and declaration file |

The evidence threshold is a clean compile with skipLibCheck disabled in consumer fixtures where practical, no declaration references to source paths, and no use of JSX types that are absent from the selected React line. React 19's removal of the global JSX namespace means public declarations should refer to React-provided types rather than assuming a global JSX namespace. If a public declaration requires a newer compiler or React type line, the minimum is raised explicitly and the compatibility proposal is revisited.

### 3.4 Supported-version and upgrade policy

- Development/CI uses one exact TypeScript patch version from the lockfile. Contributors use the repository package manager rather than a globally installed compiler.
- The supported consumer floor is proposed as TypeScript 5.2, with no upper bound in package metadata unless generated declaration evidence shows a reason. typesVersions is added only if a real compatibility split is required.
- TypeScript patch releases are reviewed monthly. Minor releases are evaluated within 30 days of stable release, after typescript-eslint and build-tool support is available. A new major is evaluated in a scheduled quarterly maintenance window, not merged automatically.
- A TypeScript update must first pass the matrix in section 3.3 and the full lint/build/unit/browser/package gate. Unsupported versions are reported as unverified, not silently accepted.
- If TypeScript 7's compiler API is unavailable to a selected linter or declaration tool, keep the TypeScript 6 pin and record the compatibility boundary; do not add a second compiler unless the user approves the added maintenance.
- React major and matching type-package updates are tested in paired fixtures. React 19 remains a peer-compatibility fixture even when the source uses no React 19-only API.

### 3.5 TypeScript alternatives

| Option | Benefits | Costs, compatibility, and maintenance implications | Proposal status |
| --- | --- | --- | --- |
| TypeScript 6.0.2 exact pin | Current bridge release; API-compatible with 5.9; current typescript-eslint support range includes it; latest DOM and ESM work | TypeScript 6 deprecations require cleanup; 7.0 transition may expose compiler-API gaps; consumer declaration floor still needs fixtures | Leading recommendation; approval required |
| TypeScript 5.9.x exact pin | Lower transition risk; mature declaration and tool ecosystem; avoids 6.0 deprecations | Delays current DOM/ESM behavior; shorter runway before support pressure; does not remove the need for React 19 fixture testing | Viable conservative alternative |
| TypeScript 7 native compiler | Potential build speed and future alignment | Current compiler API is not available for tools that need TypeScript's API; typescript-eslint requires a TypeScript 6 side-by-side arrangement; native preview/support risk is not justified for the first contract | Not recommended initially |
| Floating typescript latest | Little manual version maintenance | Non-reproducible CI/editor behavior; silent declaration and lib.d.ts changes; can outrun linter/build support | Rejected |

## 4. Linting and formatting contract

### 4.1 Recommendation

Use ESLint flat config for semantic checks and Prettier 3 for formatting, with separate commands and no formatting rules in ESLint. The semantic baseline should include:

- ESLint recommended rules.
- typescript-eslint recommended type-checked rules using Project Service against the same tsconfig files as the editor and tsc.
- React JSX rules from eslint-plugin-react, including the jsx-runtime preset.
- Official eslint-plugin-react-hooks recommended rules.
- JSX accessibility rules from eslint-plugin-jsx-a11y where JSX exists.
- A small explicit project rule set for import safety, async/resource cleanup hazards, no accidental browser-global access in SSR code, and public declaration annotations when those rules are justified by source.
- eslint-config-prettier at the end of the config to disable overlapping formatting rules.

The formatter owns whitespace, quotes, line wrapping, trailing commas, and equivalent presentation choices. ESLint owns correctness, React rules, TypeScript semantic rules, unsafe patterns, and project policy. Neither tool should run the other as a rule plugin in CI.

### 4.2 Candidate comparison

| Candidate | TypeScript/React coverage and rule quality | Editor/performance | Maintenance and migration | Proposal status |
| --- | --- | --- | --- | --- |
| ESLint 10 + latest typescript-eslint + React plugins + Prettier 3 | Broad ESLint ecosystem; typed TypeScript rules; React JSX, Hooks, and accessibility plugins; precise semantic/format separation | Mature editor integrations; typed linting is approximately a type-check build and can be expensive, mitigated by Project Service and local changed-file runs | More packages and config; flat config is current but plugin compatibility must be verified; Prettier migration is generally mechanical | Leading recommendation |
| ESLint 9 + matching plugins + Prettier 3 | Same semantic model with flat config; broad ecosystem and a well-documented migration boundary | Similar typed-lint cost; mature editor support | Slightly lower upgrade pressure than v10, but it will require another major migration if v10 is the supported baseline | Viable fallback if v10 plugin compatibility fails |
| Biome 2.x for lint and format + tsc | One fast Rust-based binary, built-in TS/TSX/React domains, LSP/editor support, and no formatting-vs-lint rule conflicts | Usually much faster for syntax/style checks; project-domain scanner can add measurable cost; no full TypeScript type-aware rule equivalent | Fewer dependencies and simple migration for common Prettier style; rule parity/config migration, React ecosystem depth, and custom typed rules remain gaps | Viable alternative; not selected pending a rule-coverage spike |
| ESLint plus eslint-plugin-prettier | One visible lint command | Formatting runs through ESLint and can obscure ownership/slow runs | Prettier docs discourage this layering because it mixes formatting and code-quality diagnostics | Rejected |

### 4.3 Lint/format commands and boundaries

- pnpm format:write runs Prettier write mode on owned source/config/docs globs.
- pnpm format:check runs Prettier check mode and is the only formatting CI gate.
- pnpm lint runs ESLint with flat config, Project Service, and no fix.
- pnpm lint:fix is local-only convenience; CI never mutates files.
- pnpm typecheck is an independent tsc run. A passing ESLint run never substitutes for type checking.
- Prettier and ESLint ignore dist, coverage, test-results, playwright-report, caches, generated fixtures, and Backlog records unless a specific documentation check is later approved.
- Lint and format configuration is repository-owned; editor extensions may invoke the same local binaries but must not carry divergent settings.
- Type-aware linting is required for source and public API code but may be syntax-only for generated/configuration files when Project Service would create an avoidable out-of-project program.

### 4.4 Approval-sensitive rule policy

Rules that can change semantics, require broad autofixes, or encode product architecture remain opt-in until separately reviewed. In particular, do not enable React Compiler experimental rules, unsafe Biome fixes, blanket no-any policies, or custom media-lifecycle rules solely because a tool offers them. Rule additions require a source example, false-positive assessment, editor/CI runtime check, and a task note.

## 5. Build, unit-test, browser-test, and package-validation responsibilities

### 5.1 Responsibility map

| Responsibility | Proposed owner | Inputs/outputs | Explicit non-overlap |
| --- | --- | --- | --- |
| Type check | TypeScript 6.0.2 | Source/config/test type graphs; no emitted files in check mode | Does not bundle, run tests, or replace lint |
| Declaration emit | TypeScript build config | Public declarations/maps in dist; source type check must pass first | Does not decide JavaScript bundling or package exports |
| JavaScript build | Vite 8 library mode (Rolldown) | ESM-first and explicit CJS library entries; React externalized; optional effects remain split | Does not type-check or generate declarations as the source of truth |
| Unit/contract test | Vitest 4 Node environment, with DOM mocking only where needed | Deterministic controller, lifecycle, failure, SSR, and type/contract fixtures; V8 coverage where supported | Does not claim browser-engine compatibility or run release browser matrix |
| Browser integration | Playwright Test | Secure-loopback fixture, virtual media, output handoff, permission/policy/failure scenarios, traces/retries | Does not type-check tests; native Safari/device evidence remains the doc-6 periodic/manual lane |
| Package validation | publint + attw + pack and consumer fixtures | Export map, ESM/CJS/type resolution, tarball allowlist, install/import/SSR checks | Does not rebuild source or infer that an untested file is publishable |
| Lifecycle policy | Existing validate:lifecycle and backlog:dispatchable commands | Repository workflow policy | Not a substitute for product quality gates |

### 5.2 Build alternatives

| Option | Benefits | Costs and risks | Proposal status |
| --- | --- | --- | --- |
| Vite 8 library mode plus tsc declarations | Uses current Rolldown/Oxc pipeline; explicit multi-entry ESM/CJS output; good browser fixture/dev-server ergonomics; Node floor aligns proposed 20.19+/22.12+ | Vite is an application-oriented tool with library conventions; declarations remain a separate pass; major upgrades can change output defaults | Leading recommendation |
| Rollup direct plus tsc declarations | Precise library output and long-standing plugin ecosystem; no app assumptions | More manual config for JSX, assets, externals, watch, and test fixtures; plugin maintenance becomes repository responsibility | Viable alternative |
| tsdown | Library-focused defaults, ESM/CJS and declaration support, fast Rolldown/Oxc internals | Current documented CLI requires Node 25.7+/26 in practice, conflicting with the proposed Node 20/22 consumer/CI floor; newer tool surface increases adoption risk | Rejected for initial baseline |
| tsc-only output | Few dependencies, declarations and JavaScript from one compiler, easy source maps | Does not bundle, minify, split optional effects, or independently prove tree-shaking; dual-format output and exports become manual | Rejected for this package shape |

The recommendation deliberately keeps Vite's build output and TypeScript's declaration output separate so a transform shortcut cannot hide a type or export error. React is external in every distributable build. Browser-only code must remain behind explicit entry points and lazy actions; Vite configuration must not evaluate media globals during a build.

### 5.3 Unit-test alternatives

| Option | Benefits | Costs and risks | Proposal status |
| --- | --- | --- | --- |
| Vitest 4 | Native ESM/TS/JSX; Vite-compatible transforms; projects; mocks; Node/jsdom/happy-dom; coverage; strong watch DX | Vite coupling and major-version pairing; browser mode would overlap with Playwright if enabled broadly | Leading recommendation |
| Jest 30 | Mature React ecosystem, snapshots, mocks, and broad adoption | ESM/TS transform configuration is a separate pipeline; browser testing still needs another tool; duplicated config with Vite | Viable alternative |
| Node built-in test runner | Minimal dependency and good low-level Node tests | No first-class JSX transform, React test ergonomics, or equivalent mocking/component workflow without extra packages | Viable for experiments, not the library baseline |

### 5.4 Browser-test alternatives

| Option | Benefits | Costs and risks | Proposal status |
| --- | --- | --- | --- |
| Playwright Test | Chromium/Firefox/WebKit projects, branded Chrome/Edge channels, parallelism, retries, trace viewer, TypeScript test transform, virtual-media launch flags | Does not type-check; Playwright WebKit is not proof of native Safari; browser binaries add cache/CI size | Leading recommendation |
| Vitest Browser Mode with Playwright provider | Reuses Vitest assertions/projects and can run browser-native tests | Early/extra provider configuration; duplicating Playwright's matrix, fixtures, retries, and artifacts would blur responsibility | Viable alternative for selected component tests |
| WebdriverIO | Broad protocol/device/provider integrations and native browser/service options | More configuration/provider maintenance; less direct reuse with Vite/Vitest; external service/device setup can become mandatory | Viable alternative if native device coverage becomes primary |
| Cypress | Strong interactive UI workflow and ecosystem | Different browser/test architecture and richer app assumptions; less suitable for low-level media tracks/workers than a focused Playwright harness | Not preferred |

### 5.5 Package-validation contract

The package check runs only after a clean build:

1. Build ESM/CJS outputs and declarations into dist.
2. Run pnpm pack --dry-run and inspect the positive published-file allowlist.
3. Run publint against the package directory or packed tarball.
4. Run attw against the packed tarball for Node10/Node16/Bundler resolution diagnostics where supported by the tool.
5. Install the packed tarball into disposable ESM, CommonJS, TypeScript-Bundler, TypeScript-NodeNext, and SSR fixtures.
6. Import every declared entry point, verify type resolution, and assert no browser global is touched during SSR import.
7. Verify optional effect entry points do not enter the base import and no unversioned worker/worklet/model/wasm file is included.
8. Fail on a missing export target, declaration/source leak, incorrect default/namespace export, unpublished required license/notice, unexpected file, or import-time side effect.

The validation contract complements, rather than replaces, the later release task's provenance, integrity, license, asset, and changelog checks.

## 6. Commands, configuration ownership, and generated files

### 6.1 Required command surface

The following names are proposed so contributors and CI have one stable vocabulary:

| Command | Purpose | Local default | CI use |
| --- | --- | --- | --- |
| pnpm install | Resolve dependencies | Allowed | Frozen variant required |
| pnpm install:frozen | pnpm install --frozen-lockfile | Required clean setup | Every job |
| pnpm format:write | Apply Prettier | Explicit local action | Never |
| pnpm format:check | Verify formatting | Pre-commit/push | Pull-request gate |
| pnpm lint | ESLint semantic checks | Changed/full source | Pull-request gate |
| pnpm lint:fix | Apply safe reviewed lint fixes | Explicit local action | Never |
| pnpm typecheck | tsc noEmit | Changed/full source | Pull-request gate |
| pnpm build | Vite library output plus declaration emit | Before package check | Pull-request gate |
| pnpm test:unit | Vitest deterministic tests | Watch or run | Pull-request gate |
| pnpm test:unit:coverage | Unit coverage and report | Opt-in | Scheduled/release evidence |
| pnpm test:browser:smoke | Playwright Chrome/Firefox virtual-media smoke | Opt-in | Pull-request gate |
| pnpm test:browser:matrix | Playwright configured desktop matrix | Opt-in | Nightly/merge queue |
| pnpm test:browser:release | Full configured matrix and release fixtures | Opt-in | Release candidate |
| pnpm package:check | Build, pack, publint, attw, and consumer fixtures | Before publishing | Pull-request and release gate |
| pnpm verify | format:check, lint, typecheck, test:unit, build, package:check | Before handoff | Pull-request aggregate |
| pnpm run validate:lifecycle | Existing workflow-policy guard | Before handoff | Every task PR |
| pnpm run backlog:dispatchable | Existing task-selection check | Coordinator/diagnostic | Not a product gate |

CI must call the same package scripts contributors use. A matrix job may add a documented --project or browser channel selector, but it must not duplicate command logic in workflow YAML.

### 6.2 Configuration ownership

| File/config | Owner and contract |
| --- | --- |
| package.json | Script names, package exports, peer/dependency declarations, files allowlist, engines, and packageManager; changes require package/release review |
| pnpm-lock.yaml | Exact dependency graph; committed and changed only by pnpm with review |
| mise.toml | Explicit supported development Node/pnpm range after approval; no floating latest claim in CI |
| tsconfig.base.json, tsconfig.typecheck.json, tsconfig.build.json, tsconfig.test.json | Type checking/declaration/test compiler boundaries |
| eslint.config.mjs | Semantic lint files, plugins, rules, ignores, and Project Service settings |
| prettier.config.mjs and .prettierignore | Formatting policy and owned file boundary |
| vite.config.ts | Library entry points, formats, externals, target, source maps, and output directory |
| vitest.config.ts | Unit projects, environment, coverage, setup, and deterministic test file ownership |
| playwright.config.ts | Browser projects, secure-loopback server, virtual media, retries, trace/screenshot policy, and artifact directory |
| .attw.json (if needed) | Package type-resolution assertions only; publint uses its own CLI/config |
| src/**, tests/unit/**, tests/browser/**, fixtures/** | Source and deterministic test ownership; fixture hashes/manifests are reviewed assets |
| CI workflow files | Invoke scripts, cache keys, Node/browser setup, artifacts, and matrix cadence; no hidden quality logic |

### 6.3 Generated and cached files

Generated or transient files must remain ignored unless a later task explicitly approves a checked-in fixture:

- dist/, build/, out/ for distributable JavaScript, declarations, maps, and generated manifests.
- coverage/ for unit coverage.
- test-results/ and playwright-report/ for browser traces, screenshots, videos, and HTML reports.
- .vite/, .cache/, .turbo/, and tool-specific daemon caches.
- *.tsbuildinfo and other incremental compiler state.
- node_modules/, .pnpm-store/, browser binaries, and package tarballs.
- Disposable package-consumer fixture installs outside the repository or under an ignored temporary directory.
- Raw traces, profiles, and performance evidence belong in task/release artifacts or an explicitly approved evidence store, not source control by default.

Cache keys must include the lockfile hash, Node major/minor, relevant tool major, browser build/channel, and OS where the cache contains binaries or transformed output. A cache hit cannot bypass a clean install, package validation, or a required browser smoke test. CI may cache pnpm store and Playwright browsers; contributors may use local caches, but cache contents are never a source of truth.

## 7. Local, pull-request, periodic, and release responsibilities

### Local development

The default fast loop is format check, lint on changed files, typecheck, and Vitest watch/run. Contributors run build and package check before a task handoff or package metadata change. Browser smoke is explicit because browser binaries and secure-loopback media permissions are heavier. Existing lifecycle checks run before completion.

### Pull request

The pull-request gate is:

1. frozen pnpm install;
2. format:check;
3. lint;
4. typecheck;
5. deterministic unit/contract tests;
6. build;
7. package:check and SSR/consumer fixtures;
8. validate:lifecycle;
9. Playwright Chrome and Firefox secure-loopback smoke with virtual media and cleanup checks.

PR jobs must publish failure artifacts for Playwright traces and package-check diagnostics. A test retry can classify flakiness but cannot convert a deterministic failure, package-resolution failure, or lifecycle leak into a pass.

### Nightly and merge queue

Run Edge and Safari-adjacent coverage on native operating-system runners where available, plus the configured Chrome/Firefox matrix when dependencies or browser builds change. Playwright WebKit results are labeled WebKit, not native Safari evidence. Native Safari and real-device checks remain the doc-6 manual/release lane unless an approved service is added.

### Release candidate

Run all approved browser rows, consumer fixtures for React 18.2/19 and TypeScript support rows, package tarball checks, SSR import checks, endurance/resource checks, and the doc-6 physical-device/manual checklist. Performance and quality budgets remain those proposed in doc-6 until the user approves them. No toolchain pass can waive a browser, package, privacy, CSP/offline, or lifecycle evidence requirement.

## 8. Maintenance and upgrade policy

- Keep Node development/CI on explicit active LTS lines that satisfy the selected Vite version. The leading Vite 8 proposal requires Node 20.19+ or 22.12+; the exact supported rows are approval-bound and must be reflected in mise.toml, engines, and CI.
- Review tool patch updates monthly. Group only updates with compatible lockfile/build/test evidence; do not use floating latest in CI.
- Review TypeScript minor updates within 30 days, ESLint/typescript-eslint/React plugin updates monthly, Prettier patch/minor updates monthly, Vite/Vitest major pairs quarterly, and Playwright/browser binary updates monthly or on a browser refresh.
- Do not automatically merge a major that changes emitted JavaScript, declaration shape, package exports, browser target, test semantics, or config format. Record migration cost and rerun the full matrix.
- Keep ESLint, typescript-eslint, React plugins, and Prettier versions in a tested compatibility tuple. Current typescript-eslint guidance says older majors are not maintained; staying on an old parser to avoid migration is not a maintenance policy.
- Keep Vite and Vitest on a compatible major pair. If a Vite upgrade changes the build pipeline, update the build and unit fixtures together and inspect bundle/export output.
- Keep Playwright package and browser binaries aligned. A browser-channel update changes evidence and must be visible in the matrix report.
- Dependency updates must preserve pnpm lockfile reproducibility and must not add install scripts that download browsers, models, WASM, or other executable assets without a separate supply-chain/release approval.
- Every maintenance change records the old/new versions, compatibility evidence, migration notes, timing, and any known unsupported rows in the task or release record.

## 9. Approval gate and unresolved choices

The user must explicitly approve or revise all of the following before implementation:

1. TypeScript 6.0.2 versus TypeScript 5.9.x, the proposed TS 5.2 consumer floor, and the React 18.2/19 fixture policy.
2. The strict compiler options, Bundler/NodeNext split, declaration-map policy, and whether isolatedDeclarations is enabled after a source spike.
3. ESLint 10 versus ESLint 9, the React/Hook/accessibility plugin set, typed-linting scope, and the Prettier 3 separation.
4. Biome as an alternative or a future pilot rather than part of the initial gate.
5. Vite 8 versus Rollup direct, the Node 20.19+/22.12+ development floor, ESM/CJS output, and separate tsc declaration emit.
6. Vitest 4 versus Jest/Node test runner, and whether any Vitest Browser Mode tests are justified in addition to Playwright.
7. Playwright Test as browser owner, the Chrome/Firefox PR smoke, Edge/Safari periodic policy, native Safari/manual boundary, and any future device service.
8. publint, attw, pack, SSR, and consumer-fixture checks as package-validation gates.
9. Exact script names, config ownership, generated/cache boundaries, and local/CI cadence.

Approval of this proposal authorizes a later implementation task or an explicitly approved continuation to add dependencies/configuration. It does not accept public package exports, browser minimums, React peer ranges, distribution paths, or media architecture. If the approved answer materially differs from proposed decision-4, update the proposed Decision through a new Decision or an explicit superseding Decision; never rewrite decision-1 or decision-2.

## 10. Acceptance-evidence map

| TASK-1.18 criterion | Evidence in this proposal |
| --- | --- |
| #1 TypeScript version/config/policy/cadence with React and emitted-type compatibility evidence | Sections 2.2, 3.1-3.5 and React/TS fixture table |
| #2 Linter/formatter comparison across coverage, quality, editor, performance, maintenance, migration, separation | Sections 2.2 and 4.1-4.4 |
| #3 Build/unit/browser/package responsibilities without overlap | Section 5 responsibility map and alternatives |
| #4 Commands, config ownership, generated/cached files, local/CI | Sections 6 and 7 |
| #5 Alternatives presented and choices approval-gated | Sections 3.5, 4.2, 5 alternatives, 8-9, plus proposed decision-4 |

## References

- [TypeScript 6.0 announcement](https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/)
- [TypeScript 6.0 release notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-6-0.html)
- [TypeScript compiler options](https://www.typescriptlang.org/docs/handbook/compiler-options.html)
- [TypeScript declaration option](https://www.typescriptlang.org/tsconfig/declaration.html)
- [React TypeScript guide](https://react.dev/learn/typescript)
- [React 19 upgrade guide](https://react.dev/blog/2024/04/25/react-19-upgrade-guide)
- [ESLint flat-config rollout](https://eslint.org/blog/2023/10/flat-config-rollout-plans/)
- [ESLint v9 migration](https://eslint.org/docs/latest/use/migrate-to-9.0.0)
- [typescript-eslint dependency versions](https://typescript-eslint.io/users/dependency-versions/)
- [typescript-eslint Project Service](https://typescript-eslint.io/blog/project-service/)
- [Prettier integration with linters](https://prettier.io/docs/next/integrating-with-linters.html)
- [Biome linter](https://biomejs.dev/linter/)
- [Biome rules](https://biomejs.dev/linter/rules/)
- [Vite library mode](https://vite.dev/guide/build.html)
- [Vite 8 announcement](https://main.vite.dev/blog/announcing-vite8)
- [Vitest features](https://vitest.dev/guide/features)
- [Vitest browser mode](https://vitest.dev/guide/browser/)
- [Playwright TypeScript support](https://playwright.dev/docs/test-typescript)
- [Playwright projects](https://playwright.dev/docs/test-projects)
- [Playwright trace viewer](https://playwright.dev/docs/trace-viewer-intro)
- [Node package exports](https://nodejs.org/api/packages.html)
- [publint getting started](https://publint.dev/docs/)
- [Are The Types Wrong?](https://github.com/arethetypeswrong/arethetypeswrong.github.io)

Related repository records: decision-1, decision-2, proposed decision-3, doc-1, doc-2, doc-3, doc-6, doc-7, TASK-1.6, and TASK-1.8.
