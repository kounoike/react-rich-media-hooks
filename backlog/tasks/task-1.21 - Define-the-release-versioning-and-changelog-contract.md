---
id: TASK-1.21
title: 'Define the release, versioning, and changelog contract'
status: To Do
assignee: []
created_date: '2026-08-13 21:15'
labels: []
dependencies:
  - TASK-1.8
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
- [ ] #1 The contract defines the source of truth and ordering for version changes, release pull requests, changelog entries, tags, GitHub Releases, and package publication
- [ ] #2 tagpr and Release Drafter are explicitly evaluated, including whether they are complementary or alternative parts of the workflow, alongside other viable approaches
- [ ] #3 Semantic-versioning rules cover breaking changes, prereleases, experimental capabilities, deprecations, and multiple package or entry-point implications if applicable
- [ ] #4 Required approvals, generated-file ownership, release-note inputs, failure recovery, retry or idempotency expectations, and emergency manual procedures are defined
- [ ] #5 Alternatives and tradeoffs are presented to the user, and the release contract is not treated as accepted until the user explicitly approves it and any required Backlog.md Decision is recorded
<!-- AC:END -->
