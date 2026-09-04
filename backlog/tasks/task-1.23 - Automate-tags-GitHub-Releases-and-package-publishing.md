---
id: TASK-1.23
title: 'Automate tags, GitHub Releases, and package publishing'
status: Done
assignee:
  - '@kounoike'
created_date: '2026-08-13 21:15'
updated_date: '2026-09-02 22:38'
labels: []
dependencies:
  - TASK-1.9
  - TASK-1.20
  - TASK-1.21
  - TASK-1.22
parent_task_id: TASK-1
priority: medium
type: chore
ordinal: 21000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement the user-approved release contract so versioning, changelogs, tags, GitHub Releases, and package publication are reproducible, reviewable, and recoverable.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The approved release workflow creates or validates version changes and changelog content from the agreed source of truth
- [x] #2 Tags, GitHub Releases, release notes, package versions, and published artifacts remain aligned and link back to the relevant changes
- [x] #3 A non-publishing dry run verifies package contents, versions, release metadata, and workflow permissions before the first real release
- [x] #4 Package publication uses the approved least-privilege authentication and provenance controls without exposing long-lived credentials unnecessarily
- [x] #5 Retries, partial failures, duplicate execution, rollback or superseding releases, and documented manual recovery follow the approved contract
- [x] #6 Maintainer documentation covers routine, prerelease, and emergency release procedures
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Inspect the current package/toolchain/CI/supply-chain configuration and map the accepted decision-6/doc-9 requirements to repository files.
2. Add pinned tagpr release-PR configuration, release metadata validation, package dry-run/alignment checks, and a protected tag-to-draft-release-to-publish workflow with OIDC provenance, least-privilege permissions, concurrency, bounded retries, and checkpoint reconciliation.
3. Add maintainer documentation for routine, prerelease, emergency, partial-failure, duplicate-run, and superseding-release recovery.
4. Verify configuration and scripts with focused tests, shell/YAML/config validation, package dry-run, and repository quality checks; record objective evidence and finalize TASK-1.23 via Backlog CLI.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
User explicitly authorized a one-time automatic-merge exception for the five named setup tasks, including TASK-1.23; implementation remains scoped to the accepted release contract in decision-6/doc-9 and this authorization is not a general merge policy.

Implemented .tagpr/tagpr release authority, GitHub generated release-note categories, release PR metadata template, initial Keep a Changelog file, generated release manifest, release workflow, release identity/package checks, npm OIDC publication/reconciliation, release evidence assets, and maintainer runbook.
Validation evidence: pnpm release:dry-run passed (package build, pnpm pack --dry-run, tarball allowlist, exports/React 18+19 consumers, release config and no-publish guard); pnpm format:check passed; pnpm lint passed; pnpm test:unit passed (1 file, 3 tests); pnpm run supply-chain:check passed (13 direct dependencies, 224 integrity-pinned resolutions); pnpm run validate:lifecycle passed; node --check passed for all release scripts; git diff --check passed.
External first-release execution remains intentionally deferred until the protected npm-publish environment/trusted publisher and maintainer approvals are configured; no tag, package, or GitHub Release was mutated during verification.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @kounoike
created: 2026-09-02 22:38
---
Ready for review: all six acceptance criteria checked; live external release intentionally not executed during repository validation.
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented the accepted decision-6 release contract with tagpr-managed version/changelog PRs, immutable tag/draft GitHub Release checkpoints, package alignment and dry-run checks, protected npm OIDC provenance publication, retries/idempotency, and maintainer documentation. Verified with pnpm release:dry-run (including pnpm pack --dry-run and package/consumer checks), format, lint, unit tests, supply-chain, lifecycle, Node syntax, and git diff --check; live first-release execution remains gated on maintainer environment/trusted-publisher setup.
<!-- SECTION:FINAL_SUMMARY:END -->
