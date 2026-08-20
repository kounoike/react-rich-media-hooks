---
id: decision-3
title: Propose the compatibility and distribution contract
date: '2026-08-20 15:41'
status: proposed
---
## Context

TASK-1.8 must define what consumers can rely on when installing, importing, typing, running, and upgrading the library. The accepted baseline is decision-1 / doc-1 plus decision-2 / doc-6; neither accepted Decision specifies package entry points, module conditions, peer ranges, browser minimums, published-file boundaries, asset hosting, CSP/CORS, or asset/code version alignment.


The evidence record includes TASK-1.2 browser capability probes, TASK-1.3/doc-4 lifecycle experiments, TASK-1.4/video feasibility, TASK-1.5/audio feasibility, TASK-1.6/doc-6 verification policy, TASK-1.16/doc-2 ecosystem prior art, and TASK-1.17/doc-3 output/transport interoperability. The exact local observations are encouraging but incomplete: Chrome 151 and Firefox 153 were probed on secure loopback, while Edge, Safari, mobile, real devices, model assets, and release-grade CSP/offline paths remain unverified.

This Decision is intentionally proposed rather than accepted. Its companion proposal is doc-7, Compatibility and Distribution Contract Proposal. Creating this proposed record preserves the alternatives and design reasoning without granting permission to implement or publish an unresolved compatibility/distribution boundary.

## Decision Drivers

- Preserve the accepted SSR-safe, browser-only, local-processing, and no-default-telemetry product boundary.
- Make supported environments and maintenance claims falsifiable with exact browser/build/context/evidence rows; never infer support from constructor presence or Chromium-family similarity.
- Keep the stable package/lifecycle contract separate from experimental processor backends, workers, worklets, WebAssembly, models, and GPU paths.
- Keep the base install and import free of optional effect code, model/runtime fetches, permission prompts, browser globals, and hidden network endpoints.
- Preserve ESM/tree-shaking ergonomics while evaluating CommonJS and SSR tooling interoperability explicitly.
- Make workers, worklets, WASM, models, hashes, licenses, URLs, hosting, offline behavior, CSP/CORS, and cross-origin-isolation requirements versioned and diagnosable.
- Avoid expanding accepted decision-1/decision-2 scope into Node media processing, React Native, mobile guarantees, generic plugins, cloud processing, or a transport dependency.
- Require explicit user approval before any recommendation becomes a public compatibility, distribution, dependency, release, or architecture commitment.

## Decision



The approval-bound recommendation submitted for user review is documented in doc-7:

- support React 18.2/19, TypeScript 5.2+, SSR import fixtures on Node 20/22, and current plus one previous major of desktop Chrome, Edge, Firefox, and Safari only after exact matrix evidence; keep mobile feasibility-only initially;
- expose a stable root and framework-neutral core plus explicit optional video/audio effect subpaths, with exact names still subject to approval and implementation review;
- use SSR-safe, browser-inert module evaluation, stable server snapshots, explicit post-hydration activation, conditional type exports, tree-shakeable ESM, and no import-time media/asset/network side effects;
- prefer an ESM-first package with tested CJS wrappers where the approved consumer matrix requires them; keep React as the only mandatory runtime peer for the React entry point and avoid mandatory ML/WASM/worker/worklet/cloud dependencies in the base package;
- publish only an explicit dist/declaration/license/metadata allowlist, with optional assets included only when versioned and approved; exclude experiments, Backlog records, tests, private internals, unlicensed/unhashed assets, and development files;
- align package, worker, worklet, WASM, model, runtime, and asset manifest versions with hashes, licenses, cache identities, and explicit compatibility checks; support application-hosted or companion asset packages without requiring a CDN or a mandatory cross-origin-isolation header;
- keep stable lifecycle, ownership, SSR, entry-point, and output semantics distinct from experimental processor backends, model behavior, worker placement, raw frame bridges, acceleration, and asset helpers; govern promotions and breaking changes through SemVer and explicit review.

These bullets are a recommendation, not an accepted decision. The user must explicitly choose or revise browser minima/maintenance, TypeScript and Node floors, React peers, module mode, entry-point names, published-file/source-map policy, asset packaging/hosting, CSP/CORS/isolation requirements, fallback defaults, stable/experimental boundaries, and release-time alignment. No dependent implementation may treat this proposed Decision as normative.

### Considered Options

1. **Evergreen desktop policy (leading recommendation):** current plus one previous major of each supported desktop engine, with mobile feasibility only. This keeps the matrix maintainable and adapts to browser releases, but can drop enterprise versions sooner.
2. **Fixed browser minimums:** publish exact engine versions and retain them until a major library release. This is predictable for consumers but increases maintenance and freezes browser workarounds.
3. **Capability-only policy:** support any browser that passes the documented operational capability/configuration/output/fallback checks. This follows actual behavior but gives consumers weaker planning and support guarantees.
4. **ESM-only package:** minimizes output and dual-package hazards but excludes CommonJS and older SSR/build tooling.
5. **ESM-first plus explicit CJS wrappers:** broadens interoperability while keeping ESM primary, at the cost of wrapper and parity maintenance.
6. **Single package with all optional assets:** makes offline installation simple but penalizes capture-only install/cache size and complicates tarball review.
7. **Companion asset packages:** keeps the base package small and versioned but adds release alignment, license, and public-path work.
8. **Application-hosted assets:** best for CSP, offline pre-cache, and enterprise mirrors but shifts URL, cache, and integrity configuration to consumers.
9. **CDN or hidden runtime download:** reduces initial install work but introduces network, privacy, CORS/CSP, cache, supply-chain, and offline failures; it is not recommended as a default.
10. **Mandatory cross-origin isolation for threaded WASM/SAB:** can enable an optimization but breaks or constrains embedding and authentication; an optional, feature-gated path with a no-isolation fallback is preferred for review.
11. **Stable all-in-one processor surface:** simple for consumers but would freeze unvalidated backend/model/browser behavior; labeled experimental processor and asset surfaces preserve evidence-driven evolution.

The full tradeoff tables and unresolved approval questions are in doc-7. No option in this list is accepted by this proposed Decision.

## Consequences

If the user approves a compatible version of this recommendation, downstream package, CI, dependency, release, and implementation tasks will have a concrete contract for entry points, module/type behavior, SSR, browser rows, optional assets, hosting, security policy, and version alignment. Consumers will receive a smaller and more inspectable base package, explicit loading/fallback states, and a clear distinction between stable lifecycle semantics and experimental processing capabilities.

The recommendation also imposes costs: a real browser matrix and native Edge/Safari runners are required; CommonJS wrappers and multiple entry points increase test surface; companion/application-hosted assets require manifest, integrity, license, cache, and public-path checks; CSP/CORS/Permissions Policy and offline behavior must be documented; and exact browser, React, TypeScript, Node, asset, and release choices remain approval gates. Until approval and evidence exist, package bootstrap and release automation must not publish these recommendations as settled compatibility or distribution behavior.

No accepted Decision is superseded. decision-1 and decision-2 remain the current approved product/API boundaries; this proposed record is subordinate to them and only supplies an approval-bound compatibility/distribution proposal.

## Related Tasks

- TASK-1.2 — Map browser media capabilities and support risks.
- TASK-1.6 — Define the cross-browser verification strategy.
- TASK-1.7 — Define the public API and resource-lifecycle contract.
- TASK-1.8 — Define the compatibility and distribution contract.
- TASK-1.9 — Bootstrap an installable and verifiable library package.
- TASK-1.20 — Establish continuous integration validation.
- TASK-1.21 — Define the release, versioning, and changelog contract.
- TASK-1.22 — Establish dependency and supply-chain maintenance.
- TASK-1.23 — Automate tags, GitHub Releases, and package publishing.
