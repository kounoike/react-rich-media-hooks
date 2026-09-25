---
id: TASK-1.25
title: Validate and close fixed-crop performance gaps on reference devices
status: To Do
assignee:
  - '@codex'
created_date: '2026-09-25 10:53'
labels: []
dependencies:
  - TASK-1.11
references:
  - decision-7
documentation:
  - doc-6
parent_task_id: TASK-1
priority: medium
type: task
ordinal: 25000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Close the measured verification gaps left by TASK-1.11 for the approved fixed camera crop at 1280×720 and 30 fps. The TASK-1.11 synthetic browser baseline on a WSL2 runner met the crop latency budget but missed the 30 fps target in Chromium and Firefox; physical camera/device performance and Firefox heap evidence remain unknown. First establish repeatable per-device evidence and attribute capture-only versus crop cost, then optimize only a bottleneck confirmed on a reference device. Preserve original-media fallback and session-owned cleanup, and do not make public API, compatibility, or architecture changes without an accepted Backlog Decision.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Record at least three capture-only, pass-through, and fixed-crop runs plus five warm add/update/bypass/remove cycles on a physical 1280×720/30 reference camera, with per-browser/device versions and lifecycle cleanup evidence.
- [ ] #2 Compare capture-only and crop frame rate, unexpected dropped frames, first-frame time, source-to-preview p95 latency, and available retained-heap measurements against TASK-1.6/doc-6 budgets.
- [ ] #3 Optimize only bottlenecks supported by those measurements and record the before/after evidence; if budgets remain missed, document tested fallback and affected browser/device combinations.
- [ ] #4 Preserve the TASK-1.11 no-reacquisition, cancellation, failure, bypass, and cleanup behavior with automated coverage and consumer guidance.
- [ ] #5 Leave Edge, Safari, and mobile coverage within the approved doc-6 cadence and record any still-unknown device results.
<!-- AC:END -->
