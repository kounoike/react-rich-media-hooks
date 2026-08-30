---
id: decision-4
title: 'Propose the release, versioning, and changelog contract'
date: '2026-08-30 21:25'
status: proposed
---
## Context

TASK-1.21 must define how merged changes become a reviewed release version, changelog, tag, GitHub Release, and published package before TASK-1.23 selects or configures automation. The accepted product and API boundaries in decision-1 and decision-2 require SSR-safe browser behavior, stable semantic lifecycle guarantees, first-party effects, and deterministic ownership; the proposed compatibility/distribution boundary in decision-3 adds unresolved package, asset, browser, and security questions.

The repository has no production package build, version file, changelog, release workflow, or publication configuration. This Decision is intentionally proposed rather than accepted. Its companion specification is doc-8, Release, Versioning, and Changelog Contract Proposal; it records alternatives, tool evidence, ordering, SemVer, review/permission requirements, and recovery procedures without granting permission to implement an unresolved release contract.

Backlog CLI 1.50.1 creates a Decision body skeleton and exposes no Decision body update command. The body below is therefore a one-time, narrowly scoped fill permitted by AGENTS.md after creating decision-4 through the CLI; its frontmatter and proposed status are preserved exactly.

## Decision Drivers

- Make the release PR the reviewable source for version changes and generated changelog content, and make the tag an immutable identity for the source and artifacts.
- Require an explicit, auditable ordering: merged PR metadata -> release PR -> merged release commit -> tag -> draft GitHub Release -> verified package/asset publication -> published GitHub Release.
- Preserve stable versus experimental SemVer behavior, deprecation/migration visibility, and future multi-package/worker/worklet/WASM/model alignment.
- Provide required maintainer approvals, least-privilege publication, generated-file ownership, release-note inputs, deterministic failure recovery, idempotent retries, and an emergency path.
- Prefer one version/tag authority and avoid conflicting generated state while evaluating tagpr, Release Drafter, Changesets, release-please, semantic-release, and manual procedures.
- Keep all release, versioning, distribution, and automation choices approval-bound until the user explicitly reviews and accepts them.

## Considered Options

1. **Manual release script and reviewed version PR:** transparent and dependency-light, but recurring checks, package/asset alignment, and idempotent recovery become bespoke discipline.
2. **Changesets:** strong per-PR release intent and multi-package release plans, but adds changeset-file and generated-state maintenance and still needs explicit GitHub Release/publication coordination.
3. **tagpr with GitHub generated release notes (leading recommendation):** maintains a release PR, updates version/changelog files, derives notes from merged PR metadata, tags the merged head, and exposes a tag output for same-workflow verification/publication. It requires GitHub write permissions and careful handling because a `GITHUB_TOKEN`-created tag does not trigger a separate workflow.
4. **Release Drafter:** useful for merged-PR categories, draft notes, version templates, and prereleases, but it does not own package versions or publication. It is complementary only as a non-authoritative preview beside tagpr, never a competing tag/version authority; the initial recommendation omits it to avoid duplicate state.
5. **release-please:** a viable reviewed Release PR and manifest-driven multi-package alternative based on Conventional Commits, with its own manifest and recovery conventions.
6. **semantic-release:** a mature plugin-based CI pipeline, but commit-driven publication is less compatible with the required durable pre-publish review unless another review layer is added.

## Decision

The approval-bound recommendation is documented in doc-8:

- use one routine version/tag authority, with tagpr leading for the current single-package repository and GitHub generated release-note configuration feeding `CHANGELOG.md`;
- require merged PR release classification and structured user-facing notes, then generate a release PR that owns package version fields, changelog entries, release manifests, and approved asset metadata;
- merge only after release checks and maintainer approval, tag the exact release-PR merge commit, create a draft GitHub Release, build and inspect from that tag, publish verified packages/assets, and publish the GitHub Release only after registry verification;
- use SemVer 2.0.0 with explicit patch/minor/major, pre-1.0 breaking-change, prerelease, experimental, deprecation, and package/entry-point/asset alignment rules; and
- use immutable checkpoints, registry digest checks, bounded retries, no duplicate publication, superseding releases for public mistakes, protected approvals, and npm trusted publishing/OIDC where approved.

These are recommendations for explicit user review, not accepted release or automation behavior. Release Drafter may be added later only as a draft-only notes presentation layer that cannot resolve the authoritative version, create tags/releases, overwrite the changelog, or publish packages. Exact labels, initial version, approver counts, tag names, prerelease channels, package/asset split, evidence gates, and publication credentials remain open approval questions in doc-8.

## Consequences

If approved, downstream TASK-1.23 can implement a review-first release flow with a single version identity and recoverable checkpoints, while package, CI, dependency, and compatibility work can validate its own prerequisites. Consumers receive changelog/version/tag/release/package alignment and visible experimental, deprecation, security, and migration information; maintainers incur the cost of release PR review, metadata discipline, browser/asset/package verification, protected publication, and recovery runbooks.

Until explicit approval, decision-1 and decision-2 remain the only accepted product/API boundaries, decision-3 remains proposed, and no release tool, versioning scheme, changelog ownership, tag, GitHub Release, or publication workflow may be treated as settled. No existing Decision is superseded.

## Related Tasks

- TASK-1.21 — Define the release, versioning, and changelog contract.
- TASK-1.8 — Define the compatibility and distribution contract; doc-7 and proposed decision-3 remain approval-bound.
- TASK-1.18 — Select the development toolchain contract.
- TASK-1.20 — Establish continuous integration validation.
- TASK-1.22 — Establish dependency and supply-chain maintenance.
- TASK-1.23 — Automate tags, GitHub Releases, and package publishing after this contract is approved.
