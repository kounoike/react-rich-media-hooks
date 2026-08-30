---
id: doc-8
title: Development Toolchain Contract
type: specification
created_date: '2026-08-30 21:30'
updated_date: '2026-08-30 22:49'
---
# Development Toolchain Contract

Status: concise accepted contract for TASK-1.18. Decision-5 records the TypeScript 7 + Oxlint/tsgolint + Oxfmt baseline; this PR proposes merging that Decision and document. No production dependency, source, package, CI, or configuration change is authorized until the compatibility spike passes.

## 1. Scope and guardrails

This contract covers contributor tooling for the headless React rich-media library: type checking, declarations, linting, formatting, build, unit tests, browser tests, package validation, commands, ownership, caches, and CI cadence.

It preserves the existing constraints: React 18.2/19 compatibility fixtures, modern JSX, SSR-safe imports, ESM-first explicit entries, optional effects behind explicit actions, no import/install-time media asset activation, and doc-6 browser evidence. Product APIs, browser minimums, peer ranges, media architecture, and distribution policy remain separate approval gates.

## 2. Accepted baseline

| Responsibility | Tool / policy | Boundary |
| --- | --- | --- |
| Type check | TypeScript 7.0.2, exact lockfile pin | tsc is authoritative for source errors; no lint or bundling |
| Declaration emit | TypeScript 7 build config | Independent declaration/source-map pass into dist |
| Semantic lint | Oxlint 1.80.0 + oxlint-tsgolint 7.0.2001 | Built-in TypeScript, React, React Hooks, JSX-a11y, and type-aware rules |
| Formatting | Oxfmt 0.65.0 | Native JS/JSX/TS/TSX/JSON/YAML/TOML/CSS only; no direct Prettier dependency |
| JavaScript build | Vite 8 library mode | ESM-first entries, approved CJS output, React externalized |
| Unit/contract tests | Vitest 4 | Deterministic Node/DOM-mocked tests and coverage |
| Browser integration | Playwright Test | Chrome/Firefox PR smoke; periodic Edge/Safari-adjacent coverage |
| Package validation | pack inspection + publint + Are The Types Wrong? + consumer/SSR fixtures | Export map, tarball, ESM/CJS, declaration, and import-time browser-safety checks |

TypeScript uses strict settings, react-jsx, isolatedModules, verbatimModuleSyntax, noUncheckedIndexedAccess, exactOptionalPropertyTypes, and noUnused checks. Browser code uses Bundler resolution; Node/SSR consumers use NodeNext. tsconfig.base, typecheck, build, and test own these boundaries.

Oxfmt's npm package has a bundled Prettier fallback for formats such as Markdown and HTML. Those files are outside the initial formatter globs, so Prettier is neither a direct dependency nor a routine formatter. Prettier plugins are not part of the baseline.

## 3. Compatibility evidence

| Fixture | Compiler / libraries | Required evidence |
| --- | --- | --- |
| react-18 | TS 5.2, latest supported 5.x, TS 7.0.2; React 18.2 types | JSX, hooks, declarations compile |
| react-19 | Same compiler rows; React 19 types | Modern JSX and declarations compile |
| ssr-node | TS 5.2 and TS 7.0.2; NodeNext | Every approved import is browser-inert |
| package-consumer | TS 5.2 and TS 7.0.2; NodeNext and Bundler | Every export condition resolves intended JS and declarations |

The toolchain fixture floor is TypeScript 5.2; this does not by itself set package metadata or peer ranges. TypeScript 7 is validated only after tsc type checking, declaration emit, Oxlint/tsgolint diagnostics, React 18.2/19 fixtures, package checks, and browser smoke pass. A TypeScript 6 sidecar is not baseline; add one only if a tool demonstrably requires its API.

## 4. Alternatives and rationale

| Area | Selected | Main alternative | Tradeoff |
| --- | --- | --- | --- |
| Compiler | TS 7.0.2 | TS 6.0.2 | TS7 is the native path; TS6 has the mature JS API but gives up native speed |
| Lint | Oxlint + tsgolint | ESLint + typescript-eslint | Oxlint avoids the TS7 API gap; ESLint has broader legacy plugin coverage |
| Format | Oxfmt | Prettier / Biome | Oxfmt is native and Prettier-compatible for source; plugins and some non-native formats differ |
| Build | Vite 8 + tsc declarations | Rollup / tsdown / tsc-only | Vite supplies library ergonomics; alternatives trade configuration, Node floor, or splitting capability |
| Unit | Vitest 4 | Jest / Node test runner | Vitest matches Vite and TS/ESM; alternatives have different transform and mocking costs |
| Browser | Playwright Test | Vitest Browser Mode / WebdriverIO / Cypress | Playwright owns the cross-browser matrix; other tools remain optional alternatives |

Oxlint JavaScript plugins are an exception path only because the API is still alpha. Built-in plugins are preferred. React Compiler rules, unsafe autofixes, blanket no-any policies, and custom lifecycle rules require separate evidence.

## 5. Commands and ownership

| Command | Owner | Use |
| --- | --- | --- |
| pnpm install:frozen | pnpm | Clean local/CI install |
| pnpm format:write / format:check | Oxfmt | Local write / CI check |
| pnpm lint / lint:fix | Oxlint | CI semantic/type-aware check / local reviewed fixes |
| pnpm typecheck | TypeScript 7 | Independent source check |
| pnpm build | Vite + tsc | JS output plus declarations |
| pnpm test:unit / test:unit:coverage | Vitest | Unit checks / scheduled coverage |
| pnpm test:browser:smoke / matrix / release | Playwright | PR, periodic, and release browser evidence |
| pnpm package:check | pack + publint + attw + fixtures | Package contract gate |
| pnpm verify | Aggregate scripts | Handoff and PR gate |
| pnpm run validate:lifecycle | Repository policy | Every task PR |

Configuration is repository-owned: package.json, tsconfig.*.json, oxlint.config.ts, .oxfmtrc.json or oxfmt.config.ts, vite.config.ts, vitest.config.ts, playwright.config.ts, and CI workflows. CI invokes these scripts rather than duplicating logic.

## 6. Generated files and caches

Ignore dist/build/out, coverage, test-results, playwright-report, .vite/.cache/.turbo, tsbuildinfo, node_modules, pnpm store, browser binaries, tarballs, and disposable consumer installs. Cache keys include lockfile, Node, tool, browser, and OS identity. Caches never replace clean install, package, SSR, or browser gates.

## 7. CI and maintenance

Local fast loop: format check, changed-file Oxlint, TypeScript typecheck, and Vitest. Pull requests run frozen install, format, lint, typecheck, unit tests, build, package checks, lifecycle validation, and Chrome/Firefox smoke. Nightly/merge-queue jobs add approved browser rows. Release candidates run the full browser, consumer, package, SSR, and manual/device evidence.

Use explicit Node 20.19+ or 22.12+ rows required by Vite/Oxlint/Oxfmt. Review patches monthly, tool minor updates within 30 days, and major tool transitions quarterly. Do not float versions or merge changes that alter emitted JS, declarations, exports, browser targets, or test semantics without the full matrix.

## 8. Implementation validation

Decision-5 accepts this toolchain baseline. Before adding production dependencies or configuration, the implementation spike must verify:

- TypeScript 7 declaration output and the TypeScript 5.2 / React 18.2 / React 19 fixture matrix.
- Oxlint built-in React, Hooks, JSX-a11y, and TypeScript rules plus oxlint-tsgolint diagnostics.
- Oxfmt output and the native-file scope, including the chosen print width.
- Vite 8, Vitest 4, Playwright, package checks, SSR imports, and the configured Node floor.

This Decision does not change public exports, peer ranges, browser minimums, media architecture, distribution, release automation, or runtime assets.

## 9. Acceptance evidence

Criterion 1: sections 2-3 define compiler, config, consumer policy, cadence, React fixtures, and emitted-type evidence. Criterion 2: section 4 compares lint/format coverage, ecosystem, performance, maintenance, migration, and separation. Criterion 3: section 2 assigns non-overlapping build/test/package owners. Criterion 4: sections 5-7 define commands, ownership, generated files, caches, and local/CI duties. Criterion 5: sections 4 and 8 record alternatives, the accepted Decision, and implementation validation gates.

## References

- TypeScript 7: https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/
- Oxlint: https://oxc.rs/docs/guide/usage/linter.html
- Oxlint type-aware linting: https://oxc.rs/docs/guide/usage/linter/type-aware.html
- Oxlint plugins: https://oxc.rs/docs/guide/usage/linter/plugins
- Oxfmt: https://oxc.rs/docs/guide/usage/formatter.html
- Oxfmt language support: https://oxc.rs/docs/guide/usage/formatter/language-support
- Oxfmt migration: https://oxc.rs/docs/guide/usage/formatter/migrate-from-prettier.html
- Vite library mode: https://vite.dev/guide/build.html
- Vitest: https://vitest.dev/guide/features
- Playwright: https://playwright.dev/docs/test-projects
- Node package exports: https://nodejs.org/api/packages.html
- publint: https://publint.dev/docs/
- Are The Types Wrong?: https://github.com/arethetypeswrong/arethetypeswrong.github.io
