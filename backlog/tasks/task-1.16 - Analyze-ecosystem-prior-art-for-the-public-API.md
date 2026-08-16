---
id: TASK-1.16
title: Analyze ecosystem prior art for the public API
status: Done
assignee:
  - '@kounoike'
created_date: '2026-08-13 21:15'
updated_date: '2026-08-16 12:06'
labels: []
dependencies:
  - TASK-1.1
  - TASK-1.2
references:
  - doc-2
  - TASK-1.2
  - TASK-1.3
  - TASK-1.4
  - TASK-1.5
  - TASK-1.10
  - TASK-1.11
  - TASK-1.12
  - TASK-1.17
parent_task_id: TASK-1
priority: high
type: spike
ordinal: 7000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Analyze representative React and browser media libraries to identify proven and problematic public API patterns for capture, processing, state, and resource ownership. Produce evidence and alternatives that inform the project API contract without copying an implementation or accepting a design in this task.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The comparison set includes representative React-focused and lower-level browser media libraries, with selection rationale, source links, licensing, adoption, and maintenance context
- [x] #2 Public APIs are compared for acquisition, device selection, state transitions, errors, cancellation, retries, track ownership, sharing, switching, cleanup, and server-rendering behavior
- [x] #3 Composition models are compared for hooks, providers, imperative handles, framework-neutral cores, and independently extensible video and audio processors
- [x] #4 Useful patterns, failure modes, compatibility costs, and design implications are documented with concrete examples rather than popularity alone
- [x] #5 API alternatives and tradeoffs are presented to the user, and no significant product or architecture decision is treated as accepted without explicit user approval
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Inspect existing product, API, compatibility, and media-behavior decisions and related tasks.
2. Research representative React-focused and browser media libraries using primary documentation and repository/license/maintenance evidence.
3. Record a comparative prior-art report with API dimensions, composition models, failure modes, compatibility costs, and explicitly unaccepted alternatives.
4. Run repository validation, verify every acceptance criterion, and finalize this task through Backlog CLI.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Created Backlog doc-2, Public API Ecosystem Prior Art, as the full comparative research record. It analyzes react-webcam, Daily React/Daily JS, LiveKit Components/client/track-processors, MediaPipe Tasks Vision, @ricky0123/vad/vad-react, an AudioWorklet noise-suppression reference, and browser standards using linked primary repositories and documentation plus directional license/adoption/maintenance signals. The report compares acquisition, device selection, state transitions, errors, cancellation, retries, ownership, sharing, switching, cleanup, SSR, and processor insertion; it also compares component, provider, imperative-controller, framework-neutral, and raw-frame composition models. Findings favor investigating a framework-neutral controller with thin React hooks, explicit ownership, observable async processor lifecycle, and standard track outputs, but every API alternative remains explicitly unaccepted pending user approval; no Backlog Decision was created.

Validation evidence: `backlog doc view doc-2 --plain` confirmed the report sections, source links, comparison matrix, composition matrix, failure modes, compatibility costs, alternatives, and acceptance-criteria mapping. `pnpm run validate:lifecycle` passed (`Task-to-PR lifecycle policy and runbook: OK`); `pnpm run backlog:dispatchable` passed and returned the expected leaf-task JSON; `git diff --check` passed with no whitespace errors. No Definition of Done items are defined for this task.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Created and linked Backlog doc-2, Public API Ecosystem Prior Art, covering representative React/browser media libraries, API dimensions, composition models, processor boundaries, failure modes, compatibility costs, and approval-bound alternatives. Verified the document and acceptance-criteria mapping with the Backlog CLI; pnpm run validate:lifecycle, pnpm run backlog:dispatchable, and git diff --check passed. No significant API or architecture decision was accepted; all alternatives remain pending explicit user approval.
<!-- SECTION:FINAL_SUMMARY:END -->
