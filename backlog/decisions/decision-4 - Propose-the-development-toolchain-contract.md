---
id: decision-4
title: Propose the development toolchain contract
date: '2026-08-30 21:38'
status: proposed
---
## Context

TASK-1.18 must define a maintainable contributor toolchain for the headless React rich-media library while preserving the accepted product, lifecycle, and SSR constraints. Dependencies TASK-1.6 and TASK-1.8 establish a Chrome/Firefox pull-request smoke policy, periodic Edge/Safari evidence, React 18.2/19 compatibility hypothesis, SSR-safe imports, explicit package entry points, optional effect boundaries, and approval gates; they do not select development tools.

The repository is currently a private shell with pnpm 11.21.0, Node LTS/pnpm latest in mise.toml, an empty pnpm importer, and only lifecycle/backlog scripts. This Decision is proposed rather than accepted so the user can review dependency, compatibility, distribution, release, and architecture implications before any package manifest, lockfile, source, configuration, or CI implementation changes.

The detailed evidence, command contract, compatibility fixture plan, and acceptance map are in doc-8, Development Toolchain Contract Proposal.

## Decision Drivers

- Keep TypeScript source checks and emitted declaration checks authoritative for a typed public package, with React 18.2/19 and TypeScript consumer fixtures.
- Preserve SSR-safe, browser-inert imports and the ESM-first, explicit-entry-point distribution direction without coupling optional media assets to the base package.
- Provide broad TypeScript and React semantic coverage, including Hooks and accessibility rules, while separating formatting from correctness diagnostics.
- Assign one clear owner to each build, unit-test, browser-test, and package-validation responsibility so checks do not duplicate work or produce contradictory evidence.
- Keep contributor commands reproducible under pnpm and explicit Node LTS lines; do not use floating tool versions or hidden install-time downloads.
- Keep browser evidence aligned with doc-6: deterministic unit checks, Chrome/Firefox pull-request smoke, periodic Edge/Safari coverage, and release/manual device evidence.
- Make upgrade cadence, generated/cache ownership, migration costs, and unsupported-version boundaries visible and reviewable.
- Require explicit user approval before a recommendation becomes an accepted dependency, compatibility, distribution, release, public API, or architecture contract.

## Considered Options

1. **TypeScript 6.0.2 exact pin with TypeScript 5.2+ consumer fixtures (leading proposal).** TypeScript 6 is the current bridge to the native 7 line and is within the current typescript-eslint support range. The costs are TypeScript 6 deprecations, compiler-API transition risk, and the need for declaration fixtures across React 18.2/19 and NodeNext/Bundler resolution.
2. **TypeScript 5.9.x exact pin.** This lowers transition risk and has a mature ecosystem, but delays current DOM/ESM behavior and shortens the runway before a later compiler migration. Floating latest is rejected for reproducibility and declaration drift; TypeScript 7 is not recommended while required compiler APIs and parser support remain unsettled.
3. **ESLint 10 flat config with latest typescript-eslint, React, React Hooks, and JSX-a11y plugins plus Prettier 3.** This gives broad typed TypeScript/React semantic coverage and a documented formatting boundary. It costs more dependencies and config maintenance; ESLint 9 remains a fallback if plugin compatibility requires it.
4. **Biome 2.x for lint and format plus tsc.** This reduces dependency count and is fast with built-in TypeScript/TSX/React domains and editor LSP support, but lacks the same depth of type-aware and React ecosystem rules and requires rule-parity validation. It remains a viable alternative or future pilot, not an accepted selection.
5. **Vite 8 library mode plus tsc declaration emit.** Vite's current library mode supports explicit multiple entries and ESM/CJS output, while Vite 8's Node 20.19+/22.12+ requirement aligns the proposed active-LTS development floor. Rollup direct is a viable lower-level alternative; tsdown is rejected initially because its documented current Node requirement conflicts with the proposed Node 20/22 floor; tsc-only output does not provide the required package bundling and splitting guarantees.
6. **Vitest 4 for deterministic unit/contract tests plus Playwright Test for browser integration.** Vitest supplies ESM/TS/JSX transforms, mocks, DOM-mocking environments, coverage, and projects; Playwright owns the browser matrix, virtual-media fixtures, retries, and traces. Jest, Node's test runner, Vitest Browser Mode, WebdriverIO, and Cypress remain evaluated alternatives with different transform, matrix, and maintenance tradeoffs.
7. **publint, Are The Types Wrong?, pack inspection, and disposable consumer/SSR fixtures for package validation.** This combines static package/export checks with actual NodeNext/Bundler imports and a positive tarball allowlist. No single build or test tool is treated as sufficient proof of published-file, ESM/CJS, declaration, or SSR behavior.

## Decision

The approval-bound recommendation submitted for user review is:

- pin TypeScript 6.0.2 for development and CI, propose TypeScript 5.2 as the consumer floor, use strict React/DOM-oriented configs with separate Bundler and NodeNext fixtures, emit declarations through TypeScript, and update only after the documented React/emitted-type matrix passes;
- use ESLint flat config with the latest compatible typescript-eslint and React/React Hooks/JSX-a11y plugins for semantic checks, and Prettier 3 for formatting with separate commands and no formatting rules in ESLint;
- use Vite 8 library mode for ESM-first JavaScript output with explicit CJS wrappers where approved, externalize React, and keep declaration emit as an independent TypeScript pass;
- use Vitest 4 for deterministic Node/DOM-mocked unit and contract tests, Playwright Test for Chromium/Firefox/WebKit and branded-browser integration projects, and label Playwright WebKit separately from native Safari evidence;
- use publint, Are The Types Wrong?, package packing, SSR imports, and disposable React/TypeScript consumer fixtures to validate exports, declarations, files, module conditions, and import-time browser safety;
- expose stable script names for format, lint, typecheck, build, unit, browser smoke/matrix/release, package check, aggregate verification, and existing lifecycle checks; keep config ownership and generated/cache boundaries explicit;
- run frozen installs, quality/build/package gates, and Chrome/Firefox smoke on pull requests; run Edge/Safari-adjacent/native-runner checks periodically and the complete approved matrix plus physical-device/manual checks at release; review updates monthly and major tool transitions quarterly.

These are recommendations only. No dependency, package script, compiler baseline, linter, formatter, build/test tool, Node floor, browser policy, export map, distribution policy, or CI gate is accepted by this Decision. The user must explicitly approve or revise the choices in doc-8 before implementation begins.

## Consequences

If approved, downstream implementation can add a reproducible package toolchain with one semantic lint owner, one formatter, independent type/declaration checks, a Vite build, deterministic Vitest tests, a Playwright browser lane, and package-resolution validation. The proposal keeps optional media runtime assets out of import/install paths and makes emitted types, SSR behavior, and browser evidence explicit.

The proposal also creates ongoing costs: the exact dependency tuple must be maintained; typed linting can approach type-check cost; Vite/Vitest and ESLint/plugin major upgrades require coordinated fixtures; browser binaries and native Edge/Safari runners require periodic maintenance; and package validation must inspect every approved entry point and tarball. A user revision of the recommendation may change these consequences and must be recorded through a new or superseding Decision rather than rewriting accepted history.

## Related Tasks

- TASK-1.18 — Select the development toolchain contract.
- TASK-1.6 — Define the cross-browser verification strategy; doc-6 supplies browser cadence and evidence boundaries.
- TASK-1.8 — Define the compatibility and distribution contract; proposed decision-3 supplies approval-bound package and consumer constraints.
- TASK-1.7 — Define the public API and resource-lifecycle contract; accepted decision-2 supplies SSR and lifecycle constraints.
- TASK-1.1 — Define and approve the initial product and quality contract; accepted decision-1 supplies the product boundary.
- doc-8 — Development Toolchain Contract Proposal; full alternatives, evidence links, commands, ownership, and approval questions.
