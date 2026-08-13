---
id: TASK-1.19
title: Establish local developer quality checks
status: To Do
assignee: []
created_date: '2026-08-13 21:15'
labels: []
dependencies:
  - TASK-1.18
  - TASK-1.9
parent_task_id: TASK-1
priority: high
type: chore
ordinal: 18000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Provide a fast, documented local workflow that applies the approved formatting, linting, type, test, build, and package checks consistently before changes reach CI.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Documented commands cover formatting in check and write modes, semantic linting, type checking, unit tests, package builds, and package-integrity checks
- [ ] #2 Commands produce actionable failures, use consistent configuration, and do not modify source files when running in validation mode
- [ ] #3 Editor configuration and ignore rules align with command-line behavior, generated outputs, caches, and repository conventions
- [ ] #4 Optional commit hooks do not become the sole enforcement mechanism and can be reproduced by direct package commands
- [ ] #5 A clean checkout can execute the documented workflow with the declared runtime and package-manager versions
<!-- AC:END -->
