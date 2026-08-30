---
id: decision-5
title: Adopt the development toolchain contract
date: '2026-08-30 22:47'
status: accepted
---
## Context



TASK-1.18 requires a reproducible contributor toolchain for the headless React rich-media library. The user approved the revised TypeScript 7, Oxlint, and Oxfmt direction; this Decision records the accepted contract that the accompanying PR proposes to merge. Product APIs, browser minimums, peer ranges, media architecture, distribution, release automation, and runtime assets remain governed by their own Decisions.

## Decision Drivers

- Keep TypeScript checks and emitted declarations authoritative for a typed public package.
- Avoid the TypeScript 7 Compiler API dependency that would require typescript-eslint compatibility work.
- Keep semantic linting, formatting, building, testing, and package validation as separate responsibilities.
- Preserve React 18.2/19, SSR-safe imports, ESM-first entries, and the existing browser evidence policy.
- Keep versions reproducible and CI/local commands identical.

## Considered Options

- TypeScript 7.0.2 is selected over TypeScript 6.0.2 because Oxlint/tsgolint uses the native TypeScript path; TypeScript 6 remains a fallback only if a tool demonstrably requires its API.
- Oxlint with oxlint-tsgolint is selected over ESLint/typescript-eslint for native TypeScript 7 alignment. ESLint remains a fallback for a proven missing plugin rule.
- Oxfmt is selected over Prettier and Biome for native source formatting. Prettier is not a direct dependency, config, or routine formatter; Markdown/HTML are outside the initial formatter gate because Oxfmt's npm fallback uses bundled Prettier for those formats.
- Vite 8 plus TypeScript declaration emit, Vitest 4, Playwright Test, and pack/publint/Are The Types Wrong?/consumer fixtures remain the selected build, test, browser, and package-validation owners.

## Decision

- Pin TypeScript 7.0.2 in the lockfile. Use TypeScript 5.2 as the proposed consumer floor and test React 18.2/19 fixtures with Bundler and NodeNext resolution.
- Use Oxlint 1.80.0 with oxlint-tsgolint 7.0.2001 for semantic and type-aware linting, including the built-in TypeScript, React, React Hooks, and JSX-a11y plugins.
- Use Oxfmt 0.65.0 for native JavaScript, JSX, TypeScript, TSX, JSON, YAML, TOML, and CSS formatting. Keep formatting separate from linting.
- Use Vite 8 for library JavaScript output, TypeScript 7 for declarations, Vitest 4 for deterministic unit/contract tests, Playwright Test for browser integration, and publint plus Are The Types Wrong? plus packed consumer/SSR fixtures for package validation.
- Define stable pnpm scripts for install, format, lint, typecheck, build, unit, browser, package, aggregate verification, and existing lifecycle checks. CI invokes the same scripts as local development.
- Require the full TypeScript/React declaration matrix, Oxlint diagnostics, package checks, and browser smoke to pass before implementation is considered validated.

## Consequences

The repository gets a smaller native Oxc-based lint/format baseline and can use TypeScript 7 without a routine TypeScript 6 sidecar. The team must maintain the TypeScript/Oxlint/tsgolint/Oxfmt compatibility tuple, verify rule coverage, and keep Markdown/HTML outside the initial formatter gate. The Node baseline must satisfy the selected Vite/Oxlint/Oxfmt versions.

## Related Tasks

- TASK-1.18 — Select the development toolchain contract.
- TASK-1.6 — Define the cross-browser verification strategy.
- TASK-1.8 — Define the compatibility and distribution contract.

## Supersedes

- decision-4 — Propose the development toolchain contract.
