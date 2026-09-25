---
id: TASK-1.24
title: Create a runnable React capture example project
status: To Do
assignee: []
created_date: '2026-09-08 07:28'
labels: []
dependencies:
  - TASK-1.10
parent_task_id: TASK-1
priority: medium
type: task
ordinal: 25000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a standalone, runnable React example project that demonstrates the approved browser capture flow for library consumers. The example should remain application-owned UI rather than production library logic: create and dispose a MediaSession, render capture state and output, provide an application-owned device picker, demonstrate initial device discovery and automatic devicechange updates, and document setup, secure-context/permission requirements, and the run command. Keep the example aligned with the published package boundary and existing repository toolchain without introducing unrelated API or architecture changes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A clearly documented example project exists in the repository and can be installed and started from a clean checkout with a documented command.
- [ ] #2 The example demonstrates the React-facing API, including session creation, MediaSessionProvider or useMediaSession, useMediaOutput, client-side start, stop, retry, and disposal.
- [ ] #3 The example provides an application-owned video or audio device picker that renders from session state, performs an initial refreshDevices call, reacts to devicechange updates, and invokes switchDevice through the public API.
- [ ] #4 The example displays capture phase, device discovery, permission or device errors, and recovery actions without duplicating production media-session logic.
- [ ] #5 The example attaches the session-owned output to a preview and documents resource ownership, secure-context and permission prerequisites, and limitations.
- [ ] #6 Example-specific typecheck/build or equivalent automated validation passes, and the example does not require changes to the library public API.
<!-- AC:END -->
