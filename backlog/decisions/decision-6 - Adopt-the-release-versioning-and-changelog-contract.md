---
id: decision-6
title: 'Adopt the release, versioning, and changelog contract'
date: '2026-08-30 23:03'
status: accepted
---
## Context

TASK-1.21 requires an adopted contract for turning merged changes into a reviewed release version, changelog, immutable tag, GitHub Release, and published package or runtime assets before TASK-1.23 implements automation. The repository has no production package build, version file, changelog, release workflow, or publication configuration yet. The canonical specification is doc-9, Release, Versioning, and Changelog Contract.

The user approved the recommendation previously recorded as the TASK-1.21 proposal. After synchronization with origin/main, that branch-local proposal used decision-4, which collides with mainline decision-4 (the proposed development-toolchain contract); mainline decision-5 is the accepted development-toolchain contract. This Decision is therefore a fresh CLI-created decision-6. It adopts the release contract without overwriting, renaming, or changing either mainline Decision.

## Decision Drivers

- Make the release PR the reviewable source for version changes, changelog entries, release manifests, and approved asset metadata, with the tag as the immutable source identity.
- Preserve a deterministic order from merged PR metadata through release PR, release-PR merge, tag, draft GitHub Release, verified publication, and final GitHub Release.
- Define stable, prerelease, experimental, deprecation, multi-package, entry-point, and runtime-asset behavior using SemVer 2.0.0 and explicit migration evidence.
- Require clear release-note inputs, generated-file ownership, maintainer approvals, least-privilege publication, immutable checkpoints, idempotent retries, and an emergency procedure.
- Use one routine version/tag authority and keep implementation work in TASK-1.23 bounded by this contract and the separately governed toolchain, compatibility, CI, and supply-chain contracts.

## Considered Options

- Manual reviewed version releases are transparent and a viable emergency fallback, but recurring checks, package alignment, and idempotent recovery become bespoke maintenance.
- Changesets provides strong per-PR intent and multi-package release plans, but adds changeset-file discipline and another generated state to coordinate with tags, assets, and GitHub Releases.
- tagpr with GitHub generated release notes supplies the preferred reviewed release PR, configured version/changelog updates, merged-head tag, and release identity; it requires carefully scoped GitHub permissions and same-workflow handling for tags created with GITHUB_TOKEN.
- Release Drafter is useful for a notes preview but does not own package versions, tags, publication, or artifact verification. It is complementary only as a non-authoritative draft layer and is omitted initially.
- release-please is a viable reviewed Release PR and manifest-based multi-package alternative; semantic-release is a mature CI pipeline but is less compatible with durable pre-publication review and explicit asset/package evidence.

## Decision

Adopt the Release, Versioning, and Changelog Contract in doc-9 for TASK-1.21:

- Merged PRs on the protected release branch are the input source. Each published-package or runtime-asset PR supplies exactly one release classification, a user-facing summary, affected API/effect/browser/package/asset/security scope, migration or deprecation guidance, and lifecycle/SSR/compatibility/publication impact.
- One release PR is the authoritative proposed release record. It owns package version fields, the Keep a Changelog entry, release manifest/checksums, and approved release metadata. Ordinary PRs do not edit the current version or released changelog section.
- The normal order is: merge eligible PRs; generate and review one release PR; run the full quality/browser/package/release gate; obtain the required maintainer approval; merge the release PR; create an immutable `vX.Y.Z` tag on that exact merge commit; create a draft GitHub Release; build and inspect from the tag; publish verified packages/assets through a protected job; verify registry versions, digests, provenance, and compatibility; then publish the GitHub Release and record the release identity.
- tagpr is the sole routine version/tag authority, with GitHub generated release notes feeding the release PR and changelog. Release Drafter is not initially configured; if later added, it may render only a draft notes preview and must not resolve the authoritative version, create tags/releases, overwrite `CHANGELOG.md`, or publish artifacts.
- Apply SemVer 2.0.0: patch for compatible fixes and metadata corrections, minor for compatible stable capabilities and deprecations, and major for incompatible stable API, lifecycle, output, SSR, peer/browser floor, export, package, asset, security, or hosting changes after 1.0.0. Before 1.0.0, breaking changes still require major-level review and migration notes. Prereleases use explicit alpha/beta/rc channels and never reuse a version; experimental surfaces remain labeled and require notes; deprecations document a replacement and planned removal window.
- All entry points in one package share a version. Future independent packages or coordinated worker/worklet/WASM/model assets must be listed in one release manifest with source commit, dependency compatibility, hashes, licenses, and publication state. A mismatched or partial asset set is not announced as stable.
- Normal releases require the agreed quality/package checks and maintainer approval. Public API, compatibility-floor, stable-promotion, asset/runtime, security, major, or emergency changes use the stronger owner/second-maintainer gate defined in doc-9. Publication is isolated behind a protected environment, uses least-privilege permissions, and prefers npm trusted publishing/OIDC with provenance; emergency credentials are narrowly scoped and audited.
- Tags, release records, registry versions, tarball digests, and manifests are immutable checkpoints. Every retry first reconciles the release identity (`package set`, version, tag, merge SHA); matching existing state is success, mismatches stop the run, and no immutable version or tag is overwritten. Partial publication remains a draft and is retried only for missing items or followed by a reviewed superseding release.
- Emergency release work uses a clean checkout of the exact reviewed commit, the same checks and identity verification, explicit incident/owner approval, and the protected publication path. No ad hoc version drift, force-moved tag, silent history rewrite, or unverified final release is allowed.

TASK-1.23 may implement this accepted behavior after its prerequisites are approved. This Decision authorizes the contract, not production dependencies, workflows, credentials, or a release itself.

## Consequences

TASK-1.23 has a clear review-first release boundary, one version/tag identity, auditable changelog ownership, and recoverable publication checkpoints. Consumers receive aligned version, tag, changelog, GitHub Release, package, and asset metadata with visible migration, experimental, security, and deprecation information.

Maintainers must review generated release PRs, preserve release-note metadata, maintain tagpr and release configuration, operate protected publication and registry-digest checks, and keep emergency records. Future multi-package or asset work must extend the release manifest without weakening the single-authority rule. Tool and workflow implementation remains out of scope for TASK-1.21.

## Related Tasks

- TASK-1.21 — Define the release, versioning, and changelog contract.
- TASK-1.8 — Define the compatibility and distribution contract; doc-7 and decision-3 remain separate approval-bound records.
- TASK-1.18 — Select the development toolchain contract; decision-5 is accepted and remains unchanged.
- TASK-1.20 — Establish continuous integration validation.
- TASK-1.22 — Establish dependency and supply-chain maintenance.
- TASK-1.23 — Automate tags, GitHub Releases, and package publishing under this Decision.

## Supersedes

This accepted Decision supersedes the branch-local TASK-1.21 release proposal recorded as `decision-4 — Propose the release, versioning, and changelog contract` (status `proposed`) and its approval-bound wording. It does not supersede or modify mainline `decision-4 — Propose the development toolchain contract` or accepted `decision-5 — Adopt the development toolchain contract`; those files and frontmatter remain unchanged.
