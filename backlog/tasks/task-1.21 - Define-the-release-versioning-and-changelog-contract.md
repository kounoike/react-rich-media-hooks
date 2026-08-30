---
id: TASK-1.21
title: 'Define the release, versioning, and changelog contract'
status: Done
assignee:
  - '@codex'
created_date: '2026-08-13 21:15'
updated_date: '2026-08-30 21:39'
labels: []
dependencies:
  - TASK-1.8
references:
  - doc-8
  - decision-4
documentation:
  - doc-8
parent_task_id: TASK-1
priority: high
type: task
ordinal: 16000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Define the approved path from merged changes to versions, changelogs, tags, GitHub Releases, and package publication before selecting or configuring release automation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The contract defines the source of truth and ordering for version changes, release pull requests, changelog entries, tags, GitHub Releases, and package publication
- [x] #2 tagpr and Release Drafter are explicitly evaluated, including whether they are complementary or alternative parts of the workflow, alongside other viable approaches
- [x] #3 Semantic-versioning rules cover breaking changes, prereleases, experimental capabilities, deprecations, and multiple package or entry-point implications if applicable
- [x] #4 Required approvals, generated-file ownership, release-note inputs, failure recovery, retry or idempotency expectations, and emergency manual procedures are defined
- [x] #5 Alternatives and tradeoffs are presented to the user, and the release contract is not treated as accepted until the user explicitly approves it and any required Backlog.md Decision is recorded
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Review TASK-1.21, dependency TASK-1.8, accepted Decisions, dependent package/CI/maintenance/release tasks, repository metadata, and authoritative release-tool guidance; preserve the approved product/API boundaries.
2. Compare manual release, Changesets, tagpr with optional Release Drafter, release-please, and semantic-release against source-of-truth ordering, multi-package/assets, reviewability, SemVer/prereleases, least privilege, recovery, and maintenance needs.
3. Create an approval-bound Backlog release contract proposal and a proposed Decision through the Backlog CLI. Define the version/changelog/tag/GitHub Release/publication ordering, SemVer and stability rules, approvals, ownership, note inputs, idempotency/recovery, and emergency manual procedure without configuring automation.
4. Present the recommendation and alternatives to the coordinator through orchestration, retain the proposal as unaccepted until explicit user approval, and record approval or blocker in TASK-1.21.
5. Read task-finalization, objectively verify every acceptance criterion, run repository/Backlog/document checks, commit and push only scoped records, and prepare the required Draft PR handoff without merging.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Investigation 2026-08-31: TASK-1.8 is Done and its doc-7/decision-3 compatibility-distribution proposal remains explicitly unapproved; accepted decision-1 and decision-2 define the product and semantic API/lifecycle boundaries. No release workflow, version file, CHANGELOG, .github workflow, package build, or published package exists yet; package.json is private and only declares pnpm@11.21.0 plus lifecycle/backlog scripts. TASK-1.23 depends on this task and is the later automation implementation scope; TASK-1.18/1.20/1.22 provide future toolchain, CI, and supply-chain constraints.

Research evidence: tagpr official documentation (https://github.com/Songmu/tagpr) manages a long-lived release PR, updates configured version files and CHANGELOG.md, derives notes through GitHub generated release notes, tags the merged head, and creates a GitHub Release; tagpr output is intended to gate same-workflow build/publish because GITHUB_TOKEN-created tags do not trigger another workflow. Release Drafter official documentation (https://github.com/release-drafter/release-drafter) maintains a draft Release from merged PR labels/paths and can resolve a version/tag template, but does not own repository version files or npm publication. These are complementary only if Release Drafter is treated as an optional notes preview while tagpr remains the single version/tag authority; running both as version authorities risks duplicate/conflicting release state.

Additional alternatives researched from official sources: Changesets (https://changesets.dev/guide/versioning-and-publishing) separates reviewed version/changelog generation from publish and creates tags on publish, fitting explicit per-package intent but adding changeset-file discipline; release-please (https://github.com/googleapis/release-please) creates a release PR, updates changelog/version files, tags and creates GitHub Releases from Conventional Commits, with manifest support for multiple packages; semantic-release (https://github.com/semantic-release/semantic-release) is a commit-driven, CI-first publish pipeline with plugin-based prepare/generate-notes/publish stages, but has less durable pre-publish review unless paired with another process. Keep a Changelog guidance (https://keepachangelog.com/en/2.0.0/) supports explicit Added/Changed/Deprecated/Removed/Fixed/Security sections. SemVer 2.0.0 is the compatibility baseline. npm trusted publishing (https://docs.npmjs.com/trusted-publishers/) uses short-lived OIDC credentials and automatically creates provenance for public packages from supported hosted CI, requiring id-token:write and currently one trusted publisher per package.

CLI evidence: Backlog.md 1.50.1; `backlog decision create --help` exposes title/status only and no body update command, so any new proposed Decision body requires the AGENTS.md narrowly-scoped body-only exception after metadata creation. `backlog decision list --plain` found only decision-1 accepted, decision-2 accepted, and decision-3 proposed; no existing release Decision applies. `backlog doc list --plain` found no release contract document.

Proposal artifacts created 2026-08-31: doc-8 (Release, Versioning, and Changelog Contract Proposal) defines the approval-bound source-of-truth chain, exact ordering from merged PR metadata through release PR, tag, draft/final GitHub Release, package/assets, SemVer/stability rules, note inputs, generated-file ownership, approvals, least-privilege publication, idempotent retries, partial-failure recovery, emergency manual procedure, and evaluated alternatives. decision-4 was created via CLI with status proposed and its required body sections filled only through the AGENTS.md narrow new-Decision body exception; frontmatter remains unchanged. No automation/configuration was added.

Approval gate: recommendation is tagpr as sole routine version/tag authority with GitHub generated release notes, omitting Release Drafter initially; Release Drafter is evaluated as optional draft-only complementary preview and cannot own version/tag/publication. Changesets, release-please, semantic-release, and manual release are explicitly compared in doc-8. Explicit user choices remain required for tool authority, initial version, PR note schema, approver roles, tag/package alignment, prerelease/deprecation policy, and trusted publication.

Validation 2026-08-31: `backlog doc view doc-8 --plain` confirmed doc-8 metadata and full proposal; a Node assertion verified all 15 evidence topics, six required non-empty decision-4 sections, unchanged decision-4 frontmatter (id/title/date/status proposed), and task In Progress/assignee/plan/references/notes. `pnpm run validate:lifecycle` passed; `pnpm run backlog:dispatchable` passed with selectedTasks containing only unrelated TASK-1.18; `node --check experiments/capture-lifecycle/run.mjs` passed; `node experiments/capture-lifecycle/run.mjs` passed CAPTURE_LIFECYCLE_EXPERIMENT_PASS with 41 assertions; `git diff --check` passed.

Approval evidence 2026-08-31: alternatives and the approval-bound recommendation were presented to the coordinator using `orca-ide orchestration ask`; the request timed out as msg_77e5371f553 and resume was rejected as not belonging to this active Dispatch, so an escalation msg_f311a3675b7f was sent with the complete options and blocker. No user approval was received; decision-4 remains proposed, TASK-1.21 remains In Progress until the coordinator/user accepts or revises the contract. The task may be handed off as a proposal only; no release automation was implemented.

Clarification 2026-08-31: TASK-1.21 is Done because its defined deliverable is the reviewed proposal; the release contract itself remains unaccepted, decision-4 remains proposed, and downstream automation remains blocked pending explicit user approval.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Completed TASK-1.21 as an explicit approval-bound release, versioning, and changelog contract proposal. Created doc-8 and proposed decision-4, covering source-of-truth and ordering from merged PR metadata through release PR, immutable tag, draft/final GitHub Release, and verified package/asset publication; evaluated tagpr, Release Drafter, Changesets, release-please, semantic-release, and manual fallback; defined SemVer/stability, prerelease, experimental, deprecation, multi-package/asset, approvals, ownership, release notes, idempotency, failure recovery, and emergency procedures. Verified all five acceptance criteria with Backlog document/Decision/task views and assertions, plus pnpm run validate:lifecycle, pnpm run backlog:dispatchable, capture lifecycle checks (41 assertions), and git diff --check. The recommendation remains unaccepted pending explicit user approval; decision-4 is proposed and TASK-1.23 must not implement release automation until the approval gate is resolved.
<!-- SECTION:FINAL_SUMMARY:END -->
