---
id: TASK-1.21
title: 'Define the release, versioning, and changelog contract'
status: Done
assignee:
  - '@codex'
created_date: '2026-08-13 21:15'
updated_date: '2026-08-30 23:17'
labels: []
dependencies:
  - TASK-1.8
references:
  - doc-9
  - decision-6
documentation:
  - doc-9
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
1. Synchronize the task branch with origin/main and preserve mainline decision-4/decision-5 history.
2. Create a fresh accepted release-contract Decision through the Backlog CLI, fill its required body sections under the documented body-only exception, and record the relationship to the superseded TASK-1.21 proposal without changing Decision frontmatter directly.
3. Rename/update the TASK-1.21 document through the Backlog CLI and update all task/document/Decision references to the adopted contract.
4. Verify acceptance evidence, task notes, and final summary; run Backlog/document/frontmatter/diff checks and pnpm run validate:lifecycle.
5. Commit and push only scoped TASK-1.21 records and update PR #18 as an open Draft proposing the already accepted Decision.
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

Follow-up authorized by the user on 2026-08-31: adopt the release/versioning/changelog contract, preserve origin/main decision-4 (development toolchain) and decision-5 (accepted toolchain), create a fresh accepted release Decision, rename the release document, and update PR #18 without merging. Branch synchronized onto origin/main before this follow-up.

Adoption update 2026-08-31: created accepted decision-6 through Backlog CLI after searching current Decisions; filled only its required body sections under the documented new-Decision body exception, preserving decision-6 frontmatter exactly. decision-6 adopts the tagpr-led release/versioning/changelog contract and explicitly supersedes the branch-local proposed release decision-4 without changing mainline decision-4 or accepted decision-5. Created replacement doc-9 through Backlog CLI with the substantive title Release, Versioning, and Changelog Contract, converted proposal wording to adopted-contract wording, and retargeted TASK-1.21 to doc-9/decision-6.

Final validation 2026-08-31: removed only the branch-local `decision-4 - Propose-the-release-versioning-and-changelog-contract.md` after verifying origin/main decision-4 and decision-5 metadata/content; `backlog decision list --plain` now has one decision-4 (mainline), accepted decision-5, and accepted decision-6. `backlog doc view doc-9 --plain`, targeted Decision/doc frontmatter and required-section assertions, and PR body newline/state assertions passed. `backlog doctor` reports only the pre-existing duplicate document IDs (doc-5, doc-6, and historical doc-8); no duplicate decision ID remains. `pnpm run validate:lifecycle`, `pnpm run backlog:dispatchable`, and `git diff --check` passed. PR #18 title/body now propose merging accepted decision-6/doc-9 and remains OPEN Draft.

Scoped document-collision cleanup 2026-08-31: removed only the superseded branch-local release doc-8 proposal after creating and retargeting the adopted contract to doc-9; mainline toolchain doc-8 remains unchanged. The remaining backlog doctor document-ID diagnostics are the pre-existing unrelated doc-5/doc-6 duplicates.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Adopted the release, versioning, and changelog contract through accepted decision-6 and canonical doc-9. Preserved origin/main decision-4/decision-5 and mainline toolchain doc-8; removed only the branch-local colliding release decision-4 and superseded release doc-8 artifacts. Updated TASK-1.21 references and PR #18 to propose merging the accepted records. Verified Decision/document frontmatter and required body sections, Backlog views/list/doctor diagnostics, acceptance evidence, git diff checks, pnpm run validate:lifecycle, pnpm run backlog:dispatchable, and PR body/state assertions. PR #18 remains open as Draft; no release automation was added.
<!-- SECTION:FINAL_SUMMARY:END -->
