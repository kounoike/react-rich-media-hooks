---
id: TASK-1.23
title: 'Automate tags, GitHub Releases, and package publishing'
status: To Do
assignee: []
created_date: '2026-08-13 21:15'
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
- [ ] #1 The approved release workflow creates or validates version changes and changelog content from the agreed source of truth
- [ ] #2 Tags, GitHub Releases, release notes, package versions, and published artifacts remain aligned and link back to the relevant changes
- [ ] #3 A non-publishing dry run verifies package contents, versions, release metadata, and workflow permissions before the first real release
- [ ] #4 Package publication uses the approved least-privilege authentication and provenance controls without exposing long-lived credentials unnecessarily
- [ ] #5 Retries, partial failures, duplicate execution, rollback or superseding releases, and documented manual recovery follow the approved contract
- [ ] #6 Maintainer documentation covers routine, prerelease, and emergency release procedures
<!-- AC:END -->
