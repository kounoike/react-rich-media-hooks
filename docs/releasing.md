# Releasing

This repository uses tagpr as its only routine version and tag authority. A
reviewed release pull request is the source of truth for `package.json`, the
generated `CHANGELOG.md` entry, and `release-manifest.json`. The release PR
merge commit is tagged as `vX.Y.Z`; that tag is the only source used to build
the package. The GitHub Release remains a draft until the exact package
tarball, registry version, digest, and npm provenance are verified.

## One-time maintainer setup

Complete these settings before the first release:

1. On npm, configure the package's trusted publisher for GitHub Actions,
   repository `kounoike/react-rich-media-hooks`, workflow filename
   `release.yml`, environment `npm-publish`, and the `npm publish` action.
   The package must be public and its repository URL must remain exactly
   `https://github.com/kounoike/react-rich-media-hooks.git`.
2. Create the protected GitHub environment named `npm-publish` and require a
   release-manager approval. Do not add an npm token secret to the repository
   or environment; the workflow uses short-lived OIDC credentials and
   automatically receives npm provenance.
3. Enable GitHub's **Allow GitHub Actions to create and approve pull requests**
   setting. Protect `main` with the required CI and release checks, and ensure
   the release automation identity cannot approve its own release PR.
4. Create the labels `release:none`, `release:patch`, `release:minor`,
   `release:major`, and `release:security`. A merged package-affecting PR must
   use exactly one of them.

The trusted-publisher relationship can also be configured with npm's current
`npm trust github` command. Verify the workflow filename and environment name
in the npm package settings after running it; they are part of the publisher
identity.

## Dry run

Run the complete local non-publishing gate before the first release and after
release configuration changes:

```sh
pnpm install:frozen
pnpm release:dry-run
```

The command runs the package build, tarball allowlist inspection, exports and
consumer checks, and static release checks. It verifies the package/version,
changelog categories, release-note labels, manifest, tagpr settings, workflow
permissions, protected environment, OIDC/provenance requirement, and absence
of long-lived npm credentials. It never calls `npm publish`, creates a tag, or
changes a GitHub Release.

The same checks are available from Actions by manually dispatching **Release**
with `dry_run=true`. A tagged release check additionally reconciles the tag's
merge SHA and existing draft GitHub Release. Registry inspection is read-only;
an existing version is accepted only when its tarball digest and provenance
match the release artifact.

## Routine stable release

1. Open a normal PR with one release label and the release metadata in the PR
   template: present-tense summary, affected scope, migration/deprecation
   guidance, asset/runtime impact, and lifecycle/SSR/compatibility impact.
   `release:none` is explicit and is excluded from release notes.
2. Merge the reviewed PR into protected `main`. On the next push, tagpr creates
   or updates one release PR. Review the proposed version, generated
   changelog, manifest, release labels, migration/security text, and dry-run
   evidence. Do not edit a released changelog section on an ordinary PR.
3. Obtain the normal maintainer approval. Major, compatibility-floor,
   public-API, asset/runtime, security, or emergency releases require the
   additional owner/maintainer approval specified by the release contract.
   Merge the release PR when its contents are approved.
4. The same workflow tags the exact release-PR merge commit and creates a draft
   GitHub Release. It checks out that immutable tag, runs the full quality,
   browser, supply-chain, and package gate, and uploads the package tarball as a
   workflow artifact.
5. After the `npm-publish` environment approval, the publication job downloads
   that exact artifact, reconciles tag/version/SHA and registry state, and
   publishes with `npm publish --provenance --access public`. Prereleases use
   `next`, `beta`, or `rc` instead of `latest`.
6. The job records SHA-256/SHA-512 digests and release identity as release
   assets, then publishes the GitHub Release only after registry provenance
   verification succeeds.

Every release run is serialized by the `release-publishing` concurrency group.
The publish job has only `contents: write`, `actions: read`, and
`id-token: write`; verification has only `contents: read`. Fork and pull
request code never receives publication credentials.

## Prereleases

Use an explicit reviewed version such as `0.2.0-alpha.1`, `0.2.0-beta.1`, or
`0.2.0-rc.1` in the tagpr release PR. Never reuse a prerelease number. The
workflow maps alpha to npm `next`, beta to `beta`, and rc to `rc`; it marks the
final GitHub Release as a prerelease and never moves it to `latest`. A stable
promotion is a new release PR with a new version and reruns the stable gates.

## Retry, partial failure, and superseding release

Rerunning the failed publication job is safe. The job first checks the tag,
draft Release, and immutable registry version. A matching published package is
treated as success and is not republished; a digest mismatch is a hard stop.
The npm inspection and publish commands retry at most three times for network
failures only. Deterministic validation failures are not hidden by retries.

- If tagpr or release checks fail, keep the release PR open, correct its source
  metadata, and let tagpr update it. Do not hand-edit `main` or create a tag.
- If the tag exists but the draft Release or package is missing, rerun the
  failed job from that exact tag. Never create a second tag for the version.
- If one package/asset publishes and another fails, keep the tag and draft,
  retry only the missing item after registry inspection, and do not announce
  completion. If alignment cannot be restored, publish a reviewed superseding
  patch release and link the incident.
- If the package is published but the Release remains draft, rerun the failed
  job; it verifies the existing digest/provenance and only completes the
  missing Release step.
- If any consumer-visible state is wrong, preserve the tag and Release history
  and issue a reviewed superseding release. Never overwrite an npm version,
  force-move a tag, or silently rewrite release history.

## Emergency procedure

An emergency release is an exception, not a second routine path. Record the
incident owner, reason, approvals, and last known-good tag. From a clean
checkout of the exact reviewed commit, run the same frozen install, quality,
browser/release evidence, package dry run, allowlist, manifest, and digest
checks. Verify existing tag, draft Release, and registry state before creating
anything. Obtain the project-owner and second-maintainer approval required for
the emergency, then use the protected `npm-publish` workflow path.

If npm trusted publishing is unavailable, use only a temporary granular
package-scoped emergency credential with 2FA, inject it for the single publish
command, do not print or commit it, and revoke/rotate it immediately. Record
the exception, credential owner, audit reference, final tag/SHA, Release ID,
registry digest, provenance result (or provider limitation), and remediation
in the incident record. An already-published mismatched version always stops
the emergency; publish a reviewed superseding version instead.

## Evidence

The workflow preserves `release-manifest.json`, `release-evidence.json`, and
`package.sha256` as GitHub Release assets. These records contain only package
identity, tag, merge SHA, digests, registry state, Release ID, and provenance
status; they never contain credentials. The adopted behavior is recorded in
`backlog/decisions/decision-6 - Adopt-the-release-versioning-and-changelog-contract.md`
and `backlog/docs/release/doc-9 - Release-Versioning-and-Changelog-Contract.md`.
