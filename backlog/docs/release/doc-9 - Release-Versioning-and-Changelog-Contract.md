---
id: doc-9
title: 'Release, Versioning, and Changelog Contract'
type: specification
created_date: '2026-08-30 23:06'
updated_date: '2026-08-30 23:11'
tags:
  - release
  - versioning
  - changelog
  - adopted
---
# Release, Versioning, and Changelog Contract

## Status and authority

This is the adopted release, versioning, and changelog contract for TASK-1.21, recorded by accepted decision-6. It governs the implementation boundary for TASK-1.23: release automation may implement this contract after its prerequisites are approved, but may not weaken its source-of-truth, ordering, review, identity, publication, or recovery rules.

The adopted contract inherits accepted decision-1 (product and quality contract) and decision-2 (public API and resource lifecycle). It also respects the separate compatibility/distribution contract recorded in doc-7 and proposed decision-3. Exact package entry points, browser minima, asset packaging, module conditions, and supply-chain policy remain governed by those records.

This document is the adopted replacement for the branch-local TASK-1.21 document doc-8, Release, Versioning, and Changelog Contract Proposal. Because origin/main already uses doc-8 for the development-toolchain contract, the replacement has fresh CLI ID doc-9; mainline doc-8 remains unchanged.

## Current evidence and scope boundary

The repository currently contains no production source tree, public package build, version file, `CHANGELOG.md`, release workflow, GitHub release-notes configuration, or publish configuration. `package.json` is private and declares `pnpm@11.21.0` plus Backlog/Orca lifecycle scripts. The first implementation of this contract therefore belongs to TASK-1.23 after package, toolchain, CI, and supply-chain prerequisites are approved; this task defines behavior and ownership only.

The accepted product/API boundaries require a headless React library, SSR-safe imports, browser-only activation, first-party effects, deterministic ownership and cleanup, and stable semantic lifecycle behavior. A release must not promote an experimental processor/backend/model, an unsupported browser row, or an unapproved package/asset surface merely because code exists.

## Adopted release contract

Use a reviewed release pull request as the only place where a release version and generated `CHANGELOG.md` are proposed, then create an immutable tag and draft GitHub Release from the merged release commit, build and inspect artifacts from that tag, publish packages/assets, verify the registry, and only then publish the GitHub Release. Keep one release authority for version and tag decisions.

The adopted automation authority is **tagpr as the version/release authority, with GitHub's generated release-notes configuration feeding the release PR and changelog**. Release Drafter is not a second version authority and is not required for the first release. If a continuously updated notes preview is later valuable, Release Drafter may be used as a complementary, draft-only presentation layer whose resolved version, tag, package versions, and publication state are ignored; it must not create a competing tag or release. This is the adopted release-authority recommendation recorded in decision-6.

The adopted contract is deliberately compatible with one package today and coordinated package/asset manifests later. TASK-1.23 must preserve the observable ordering, review gates, immutable checkpoints, and recovery rules below while selecting implementation details.

## 1. Source of truth and release ordering

### 1.1 One authoritative value at each stage

The workflow has these sources of truth, in order:

1. **Unreleased change intent:** merged pull requests on the protected release branch, each with exactly one release classification and a structured release-note input. A PR may be marked `release:none` only with an explicit maintainer rationale. Commit messages can assist discovery, but they are not sufficient by themselves for a user-facing note or a breaking-change decision.
2. **Proposed release:** the generated release PR. Its version field(s), `CHANGELOG.md` entry, release manifest, compatibility/asset metadata, and any generated checksums are the reviewable release record. Ordinary feature PRs must not edit the current version or released changelog section.
3. **Released source:** the merge commit of the approved release PR. The immutable tag (recommended `vX.Y.Z` for the current single package) must point exactly to this commit. The tag and the version field(s) must agree byte-for-byte on the normalized SemVer value.
4. **GitHub Release:** initially a draft attached to that exact tag. Its final body is the corresponding `CHANGELOG.md` section plus generated compare links, package/asset links, and any required security or migration notices. The GitHub Release is not a separate source of version truth.
5. **Published artifact:** the package tarball and any companion worker/worklet/WASM/model/asset artifact are built from the tag commit. The registry version, tarball manifest, package metadata, asset manifest, hashes, and licenses must match the release record. A registry listing cannot cause a version bump or change the tag.

For a future multi-package repository, every package has its own package manifest/version and (if independently released) tag, but one release manifest records the release set, dependency compatibility, asset alignment, checksums, and changelog entries. Subpaths within one package do not have independent versions. A companion asset package is not published or promoted as `latest` until its compatibility manifest is validated against the code package release.

### 1.2 Required ordering

The normal stable-release path is:

1. A contributor opens a normal PR with tests and a release classification. The PR body includes the user-facing summary, impact, migration/deprecation/security notes, and asset/runtime impact when applicable.
2. Required checks run. A maintainer reviews code, public API/compatibility impact, release classification, and release-note quality. Merging into the protected release branch records the change as eligible for the next release.
3. The release authority finds merged eligible PRs since the last released tag, validates that there is no competing release operation, computes the next version, and creates or updates one release PR. It updates only release-owned generated files in that PR: package version field(s), `CHANGELOG.md`, release manifest/checksums, and explicitly configured release metadata.
4. The release PR runs the full release gate: install from the lockfile, format/lint/type/test/build, supported browser checks, package allowlist inspection, `npm/pnpm pack --dry-run`, version/entry-point/asset consistency, and a non-publishing release preview. The release manager reviews the complete diff and generated notes.
5. A maintainer with release permission approves the release PR. Major, stable public API, compatibility-floor, asset/runtime, security, or emergency changes require a second maintainer or designated project owner. The automation identity cannot approve its own release PR. The protected branch requires the agreed checks and prevents direct version edits.
6. Merge the release PR. The release workflow must verify that the tag target is exactly the release-PR merge commit and must not silently tag a later or different commit. Create the immutable `vX.Y.Z` tag only after the release gate passes. Do not force-move a tag.
7. Create a **draft** GitHub Release for the tag, using the release PR's changelog section and release manifest. Draft creation is a checkpoint, not public completion. Attach or link approved artifacts and checksums where applicable.
8. From the tag, build once in a clean environment and compare the artifact's package version, exports, published-file allowlist, asset manifest, hashes, and license metadata with the release record. Publish all approved packages/assets through the protected publication job. The recommended npm authentication is trusted publishing with short-lived OIDC credentials and provenance; no long-lived write token is the default.
9. Verify each registry version and tarball digest, publication provenance, package/asset compatibility, and links. If all required publication checks pass, publish the GitHub Release draft. Its final body must match the reviewed changelog section except for generated links/checksums and must link the exact tag and published versions.
10. Record the release ID, tag, merge SHA, package/asset versions, artifact digests, provenance result, checks, and any warnings. Keep the next release PR anchored to the newly published tag.

The exact tag creation and draft-release mechanics may be implemented in one workflow because tagpr's documentation notes that a tag created with the default `GITHUB_TOKEN` does not trigger a separate workflow. If a separate workflow is required, use an explicitly approved GitHub App/installation token or an equivalent handoff and preserve the same tag-to-artifact identity check.

### 1.3 No release and no-op behavior

The authority must not open or merge a release PR when no eligible change exists. Documentation-only, test-only, Backlog-only, or internal changes may use `release:none`; they remain visible in PR history but do not silently create a patch release. A manually requested no-op or metadata-only release requires release-manager approval and an explicit changelog rationale.

## 2. Release-note inputs and generated-file ownership

### 2.1 PR input contract

Every merged PR that affects the published package or runtime assets supplies:

- exactly one release classification: `release:none`, `release:patch`, `release:minor`, `release:major`, or a prerelease channel request;
- a concise user-facing summary written in present tense;
- affected entry point, effect, browser/support, package, asset, or security scope;
- migration or deprecation instructions when behavior or API changes;
- asset/runtime size, loading, hosting, CSP/CORS, license, or integrity impact when applicable; and
- a statement that the change does or does not alter stable observable lifecycle, ownership, output, SSR, compatibility, or publication behavior.

The release classification is reviewed with the PR. A `release:major` label or a `BREAKING CHANGE` note cannot be downgraded by automation. A maintainer may correct an incorrectly classified merged PR only by recording the correction in the next release PR and its notes. Release-note text must not expose secrets, personal data, or unsupported performance/compatibility claims.

### 2.2 Changelog format and generation

`CHANGELOG.md` follows Keep a Changelog conventions with a top `Unreleased` section during development and release sections in descending order. The minimum categories are `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, and `Security`; an `Experimental` subsection is allowed beneath the relevant category when clearly labeled. Each release section includes the version, ISO date, concise notes, migration/deprecation guidance, and links to the tag/compare view.

The release authority generates the release PR's entry from merged PR metadata and the reviewed note inputs. Human edits are allowed in the generated release PR to correct clarity, ordering, or migration guidance, but the release manager owns the final content. The generated files are not manually edited on the default branch outside the release PR. A release tool configuration (`.tagpr`, `.github/release.yml`, or approved equivalent) is source-controlled and reviewed like code; it is not regenerated differently on each run.

The final GitHub Release body is derived from the reviewed changelog section, not independently rewritten by Release Drafter or a release web form. A generated contributor list or compare link may be appended. If an emergency correction is required after publication, append a clearly dated correction to the GitHub Release and changelog with the original tag/SHA retained; never rewrite history or change the published version's meaning silently.

### 2.3 Ownership matrix

| Artifact or state | Generator/owner | Review and mutation rule |
| --- | --- | --- |
| PR release label/body note | Contributor, reviewed by maintainer | Must be present before merge; corrections are recorded in the release PR |
| Package version field(s) | Release authority in release PR | No ordinary PR edits; release manager reviews the diff |
| `CHANGELOG.md` release section | Release authority, with human editorial review | Only the release PR may add the section; final GitHub body derives from it |
| Release manifest, asset compatibility, hashes, licenses | Release tooling from approved inputs; maintainers own source metadata | CI rejects missing, stale, or mismatched entries |
| Tag | Release workflow/release manager | Immutable; never force-moved; existing tag is an idempotency checkpoint |
| GitHub Release | Release workflow from tag/changelog | Draft before publication; publish only after registry verification |
| Package tarball and registry metadata | Build/publication workflow from tag | No local ad hoc build; verify digest/provenance after publish |
| Release-tool configuration | Maintainers | Changes require normal PR review and release-contract compatibility review |

## 3. SemVer, stability, and package/entry-point rules

### 3.1 Stable package rules

Use Semantic Versioning 2.0.0 for each published package. Proposed bump rules are:

- **Patch:** a backwards-compatible bug fix, documentation correction, test/build/package correction, or generated metadata correction that does not change stable observable behavior, supported environments, asset compatibility, or security/privacy guarantees.
- **Minor:** a backwards-compatible stable export, subpath, effect capability, option, diagnostic, browser row, or asset capability. Deprecation notices are at least minor changes when they do not remove behavior.
- **Major:** after `1.0.0`, any incompatible change to stable exports/types, state discriminants, ownership or cleanup, output replacement, SSR-safe import behavior, React/peer floors, browser support promise, module/conditional exports, package file boundary, asset manifest compatibility, security/privacy guarantee, or required runtime/hosting policy.

Before `1.0.0`, SemVer itself permits breaking changes in a minor release, but this project still marks them `BREAKING CHANGE`, requires the major-level approval gate, and provides migration notes. The project begins at an explicitly selected `0.y.z` version only after package bootstrap approval; it must not infer an initial version from a tool default.

Quality/model/runtime changes that alter output quality, performance, asset size, browser support, privacy/security behavior, or fallback semantics are release-significant even when TypeScript signatures are unchanged. They receive a user-visible note and evidence link, and a support-boundary change uses the major-level review gate.

### 3.2 Prereleases

Use `X.Y.Z-alpha.N`, `X.Y.Z-beta.N`, and `X.Y.Z-rc.N` for an unreleased stable surface or materially changed processor/asset contract. Prerelease versions publish under an explicit non-`latest` registry tag such as `next`, `beta`, or `rc`; the final release must be a distinct, reviewed release record. Never reuse a prerelease number, move a prerelease tag to a different package version without a new release record, or let prerelease assets satisfy stable compatibility claims.

Prerelease release PRs use the same version/changelog/tag/asset checks, identify the intended channel and expiry/promotion condition, and require release-manager approval. A stable promotion carries forward only the reviewed changes and must rerun full stable gates. Experimental releases may be published for testing only when the package/distribution contract has an explicit opt-in path.

### 3.3 Experimental capabilities and deprecations

Experimental processors, models, worker placement, acceleration paths, raw frame bridges, and asset helpers remain in clearly labeled experimental entry points/configuration. Their implementation, asset, browser, quality, and performance behavior may change in a minor release while experimental, but each change needs a changelog entry and migration/upgrade note. Promotion to stable requires evidence, explicit public-contract review, and a release classification based on the resulting stable surface.

Deprecation notes state the reason, affected package/entry point/option, replacement, migration example, and earliest planned removal release. The proposed default is at least one subsequent minor release and one complete release-note cycle before removal; stable root exports should be removed only in a major release. A security or legal emergency may shorten this window with project-owner approval, a prominent migration/security note, and an incident record.

### 3.4 Multiple packages, entry points, and runtime assets

- All entry points within one npm package share one version. Adding or removing an entry point follows the stable SemVer rules above; an experimental entry point never silently becomes a stable root export.
- If future work creates separate core/React/effect packages, each package may have an independent version only if the approved distribution contract says so. A release manifest must list every package, its source commit, dependency ranges, and whether it is released in this set.
- Worker, worklet, WASM, model, and other optional runtime assets carry immutable version/hash/license metadata. The code package declares compatible asset ranges or an exact manifest version; runtime loading rejects a major mismatch and reports the release/asset IDs.
- For a coordinated release, package code, companion assets, generated workers/worklets, and manifests are built from the same release commit and published as one release set. If publication cannot be atomic, assets remain unpublished or non-default until the full set passes validation; a partially published set is not announced as stable.
- No subpath, asset URL, CDN object, or registry `latest` pointer is treated as an independent source of truth. Content-addressed hashes and the release manifest provide integrity; changing an asset under an existing version is a distribution failure requiring incident handling.

## 4. Tool alternatives and tradeoffs

These options were evaluated before adoption. Decision-6 selects tagpr as the routine authority; TASK-1.23 must preserve this boundary while completing implementation details with the toolchain, CI, and supply-chain tasks.

| Approach | Strengths | Costs, compatibility, and maintenance implications | Assessment |
| --- | --- | --- | --- |
| Manual release script and reviewed version PR | Few dependencies; maximum editorial and emergency control; easy to understand in a new single-package repository | Repeated version/tag/changelog/package checks are easy to omit; idempotency and multi-package alignment become bespoke maintenance; approvals depend on runbook discipline | Viable emergency fallback, not preferred routine path |
| Changesets | Per-PR release intent and prose; separates reviewed version/changelog generation from publication; package-aware and supports fixed/linked packages and prereleases | Adds `.changeset` file discipline, release-plan review, and another generated state; publication/tag behavior must be coordinated with draft GitHub Releases and asset manifests | Strong option if package count grows or independent package intent dominates |
| tagpr plus GitHub generated release notes | Maintains one release PR; updates configured version files and `CHANGELOG.md`; label-based SemVer selection; tags the merged head and can create a GitHub Release; supports custom preparation commands and tag-only mode | Requires GitHub Actions write permissions and explicit version-file configuration; generated notes follow GitHub configuration; tag-created events using `GITHUB_TOKEN` do not trigger a second workflow, so build/publish must be gated in the same workflow or use an approved token; long-lived release PR needs maintainer attention | Adopted routine path for the current single-package, review-first contract |
| tagpr plus Release Drafter | tagpr can own version/tag/release identity while Release Drafter can keep a human-readable draft notes preview and label categories | Two configs may disagree on labels, versions, categories, or release body; extra write permissions and duplicate draft state; no value if tagpr's GitHub generated notes are sufficient | Complementary only as draft-only notes presentation; never two authorities; defer initially |
| Release Drafter alone | Good merged-PR categorization, draft release, prerelease support, and configurable label/path templates | Does not own package version files, package publication, asset manifests, or registry verification; alone cannot establish the required version-to-tag-to-artifact source of truth | Not sufficient alone; may pair with a manual or other version authority |
| release-please | Reviewed Release PR; Conventional Commit-based bumps and notes; tags and GitHub Releases; manifest mode coordinates multiple packages and records versions | Requires strict commit/merge conventions and manifest maintenance; action has broad GitHub write needs; publication remains a separate job; release PR/manifest recovery has its own state | Viable alternative, especially for a future multi-package Conventional Commit workflow |
| semantic-release | Mature CI pipeline with analyze/prepare/generate-notes/publish plugin stages; little manual version bookkeeping | Commit-driven automation can publish without a durable pre-publish version PR unless supplemented; plugin/action and registry permissions are more coupled; hard to incorporate per-package asset/quality evidence and required human approval | Not preferred while the project requires a reviewed release PR and explicit publication gate |

### 4.1 tagpr and Release Drafter relationship

They are not interchangeable at the contract level. tagpr's release PR and configured version files can be the authoritative version/change record, while Release Drafter can optionally render a preview from the same merged PR set. In that complementary mode, tagpr owns the version, tag, release commit, GitHub Release identity, and publication trigger; Release Drafter owns only a non-authoritative draft presentation. Release Drafter must not resolve a different version, create a second tag, publish a package, or overwrite `CHANGELOG.md`.

The recommended first implementation uses tagpr plus GitHub's generated release notes and omits Release Drafter. This minimizes duplicate configuration and write surfaces while retaining a documented path to add Release Drafter later if the user values a continuously updated preview enough to accept the maintenance and permission cost.

## 5. Approvals, permissions, and security controls

The following are normative requirements for the eventual workflow:

- Normal PRs require the agreed test/build/package gates and at least one maintainer approval. Public API, compatibility, stable/experimental promotion, asset/runtime, dependency, security, and release-tool changes additionally require the owner/reviewer specified by the corresponding contract.
- A release PR requires a release-manager review of version rationale, every generated file, release notes, migration/deprecation/security text, package/asset manifest, and dry-run evidence. Major-level or emergency releases require two authorized maintainers or one designated project owner plus an incident record.
- The publication job is isolated behind a protected environment with explicit approval. Its token permissions are least privilege: read-only repository access for build/verification, tag/release write only for the release step, and `id-token: write` only for the npm publication step when trusted publishing is approved.
- Prefer npm trusted publishing/OIDC, which uses short-lived workflow-bound credentials and automatic provenance for supported public packages. If unavailable, an emergency granular token must be narrowly scoped, 2FA-protected, injected only at the publish step, never committed or printed, and revoked/rotated after use. The exception and reason are recorded.
- GitHub Action versions and release tooling are pinned according to TASK-1.22's approved supply-chain policy. Release configuration, lockfile, generated-file allowlist, and artifact inspection scripts are reviewed in ordinary PRs.
- Fork PRs and untrusted code must not receive publication credentials. Release jobs build from the protected tag or trusted release commit and do not run arbitrary contributor-controlled scripts with write tokens unless the approved isolation policy allows it.

## 6. Failure recovery, retry, and idempotency

Tags, release records, package registry versions, tarball digests, and release manifests are immutable checkpoints. Every release run accepts a release identity (`package set`, normalized version, tag, merge SHA) and first inspects existing state before creating or publishing anything.

| Failure point | Required recovery |
| --- | --- |
| Release PR generation or checks fail | Keep or update the release PR; fix source metadata or configuration; rerun checks. Do not edit `main` version/changelog files by hand and do not create a tag. |
| Release PR merged but tag absent | Verify the merge SHA and release checks, then rerun the tag step once. If the SHA/version is ambiguous, stop for release-manager inspection. |
| Tag exists and points to the expected merge SHA, but draft Release or publication is absent | Treat the tag as the identity checkpoint; rerun only the missing stage from that tag. Never make a second tag for the same version. |
| Package version already exists in the registry | Compare tarball digest, manifest, and expected provenance. Matching state is success and later steps may continue; a mismatch is a hard stop and requires an incident/superseding release. Never overwrite or republish an immutable version. |
| One package/asset publishes and another fails | Keep the tag and exact release identity; leave the GitHub Release draft; retry only failed unpublished items after checking registry state. Do not announce the release as complete. If alignment cannot be restored, mark the partial release clearly and publish a superseding compatible release after review. |
| Package publication succeeds but GitHub Release remains draft | Verify registry state, then publish/update only the draft Release from the same tag/changelog. Do not republish packages. |
| GitHub Release publishes but registry publication is incomplete | Do not delete or rewrite the tag/release history. Immediately mark the Release body with the known limitation, publish missing artifacts from the exact tag if safe, or issue a reviewed superseding patch and document the incident. |
| Wrong tag target or wrong generated version before external publication | Halt. With explicit owner approval, quarantine/delete only the unused prepublication tag and draft record if supported; never force-move a tag. If any consumer-visible state exists, preserve it and issue a superseding version. |
| Build/test/network transient failure | Retry a bounded number of times for network-only failures, with logs. Deterministic failures are not hidden by retries. Before each publish retry, inspect registry/tag/Release state. |
| Concurrent release runs | Use a single concurrency group with no cancel-in-progress for publication. A run seeing an existing release identity must reconcile it and exit safely rather than create duplicate tags/releases. |

Rerunning the workflow is expected to be safe. Create operations use `get-or-create` semantics keyed by tag/version/SHA; publish operations use registry inspection and digest comparison; release publication uses the existing draft Release ID. The workflow must emit the identity and checkpoint state in logs and an artifact suitable for incident review without exposing credentials.

## 7. Emergency manual procedure

The emergency path is a controlled exception, not a second normal workflow:

1. Freeze or coordinate merges and identify the last good tag, the intended release version, the exact release commit, and any existing tag/Release/registry state. Open an incident record with an owner and reason.
2. From a clean checkout of the exact intended commit, install from the lockfile and run the same required checks, package dry-run, published-file allowlist check, version/manifest/hash/license comparison, and relevant browser/release evidence. Do not run an ad hoc version command that can drift from the release record.
3. If no tag exists, obtain the required owner approvals and create the normalized tag on the exact reviewed commit. If a tag exists, verify it; never force-move it. Create or retain a draft GitHub Release with the reviewed changelog text.
4. Use the protected workflow-dispatch publication job with environment approval and trusted publishing/OIDC whenever possible. If the provider is unavailable, use the documented granular emergency credential only for the exact package, with 2FA and an audit trail; revoke/rotate it immediately after the operation.
5. Inspect registry versions and tarball digests before and after publication. Publish the draft GitHub Release only after all required packages/assets are verified. If a version is already published or inconsistent, stop and issue a superseding release rather than overwriting it.
6. Record the final tag, merge SHA, Release ID, package/asset versions, digests, provenance, commands/checks, approvals, incident link, and follow-up remediation in the repository's release record. Add a changelog correction only as an explicit dated note.

## 8. Implementation parameters

TASK-1.23 must make the following implementation parameters explicit in its reviewed configuration without weakening this accepted contract:

- tagpr remains the sole routine release authority; Release Drafter is omitted initially and may be added only as a draft-only complementary preview;
- the initial package version is selected during package bootstrap and is never inferred from a tool default;
- the required PR classification and body-note schema captures the fields in section 2.1;
- normal, major, security, and emergency approver roles follow the gates in section 5;
- `CHANGELOG.md` retains the categories and top `Unreleased` section in section 2.2; generated contributor lists are optional additions;
- the single-package `vX.Y.Z` tag and future coordinated package/asset manifest policy remain aligned with section 3.4;
- npm trusted publishing/OIDC with provenance is preferred, with the protected environment and audited emergency fallback documented;
- a draft GitHub Release is created before publication and is published only after registry verification;
- alpha, beta, and rc channels, promotion rules, the deprecation window, and pre-1.0 breaking-change review follow section 3; and
- the release evidence gate runs the approved quality and browser checks, with the full matrix required for support-boundary, effect, asset, and release-significant changes.

These parameters are implementation details within the adopted contract; automation must not weaken the accepted public, distribution, or release behavior.

## 9. Evidence and acceptance map

### Repository evidence

- [decision-6 — Adopt the release, versioning, and changelog contract](../../decisions/decision-6 - Adopt-the-release-versioning-and-changelog-contract.md)

- [decision-1 — Adopt the initial product and quality contract](../../decisions/decision-1 - Adopt-the-initial-product-and-quality-contract.md)
- [decision-2 — Accept the public API and resource-lifecycle contract](../../decisions/decision-2 - Accept-the-public-API-and-resource-lifecycle-contract.md)
- [decision-3 — Propose the compatibility and distribution contract](../../decisions/decision-3 - Propose-the-compatibility-and-distribution-contract.md)
- [doc-7 — Compatibility and Distribution Contract](../distribution/doc-7 - Compatibility-and-Distribution-Contract-Proposal.md)
- TASK-1.18 — toolchain contract (future prerequisite)
- TASK-1.20 — CI validation (future prerequisite)
- TASK-1.22 — dependency and supply-chain maintenance (future prerequisite)
- TASK-1.23 — automation implementation (dependent task)

### Primary tool and policy sources

- [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html)
- [Keep a Changelog](https://keepachangelog.com/en/2.0.0/)
- [tagpr — release flow, version files, changelog, tags, and release outputs](https://github.com/Songmu/tagpr)
- [Release Drafter — draft release notes, categories, version templates, and prereleases](https://github.com/release-drafter/release-drafter)
- [Changesets — versioning and publishing](https://changesets.dev/guide/versioning-and-publishing)
- [Changesets — configuration and changelog generators](https://changesets.dev/guide/config)
- [release-please — release PR, changelog, tags, and GitHub Releases](https://github.com/googleapis/release-please)
- [release-please — manifest-driven multi-package releases](https://github.com/googleapis/release-please/blob/main/docs/manifest-releaser.md)
- [npm trusted publishing and provenance](https://docs.npmjs.com/trusted-publishers/)

### Acceptance-evidence map

| Task criterion | Evidence in this contract |
| --- | --- |
| #1 Source of truth and ordering | Sections 1.1–1.3 define PR inputs, release PR, version/tag identity, draft/final GitHub Release, package publication, and multi-package/asset ordering. |
| #2 tagpr and Release Drafter plus alternatives | Section 4 evaluates tagpr, Release Drafter, their complementary boundary, and manual, Changesets, release-please, and semantic-release alternatives. |
| #3 SemVer and stability | Section 3 defines patch/minor/major, pre-1.0 breaking changes, prereleases, experimental surfaces, deprecation windows, entry points, packages, and runtime assets. |
| #4 Approvals, ownership, notes, recovery, idempotency, emergency | Sections 2, 5, 6, and 7 define note inputs, generated ownership, approvals/permissions, immutable checkpoints, retries, partial failures, duplicate runs, and manual recovery. |
| #5 Alternatives and explicit approval | The adopted status, decision-6, Section 4, and Section 8 preserve the evaluated alternatives and record the explicit approval and implementation boundary. |
