---
id: TASK-1.20
title: Establish continuous integration validation
status: To Do
assignee: []
created_date: '2026-08-13 21:15'
updated_date: '2026-08-13 21:16'
labels: []
dependencies:
  - TASK-1.6
  - TASK-1.19
  - TASK-1.22
parent_task_id: TASK-1
priority: high
type: chore
ordinal: 20000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Automate the approved verification gates for pull requests and protected branches with secure, observable, and maintainable CI workflows.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Pull-request and protected-branch workflows run every required formatting, lint, type, test, build, package-integrity, and selected browser check
- [ ] #2 The Node, operating-system, and browser matrix matches the approved support strategy, with explicit periodic or manual coverage for combinations not run on every change
- [ ] #3 Caching, concurrency cancellation, timeouts, retries, and artifact retention are configured without hiding deterministic failures or creating unbounded resource use
- [ ] #4 Workflow permissions and secret access follow least privilege, and third-party actions follow the approved supply-chain policy
- [ ] #5 Failures expose sufficient logs or artifacts for diagnosis, and contributor documentation explains how to reproduce each gate locally
<!-- AC:END -->
