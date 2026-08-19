---
id: TASK-1.3
title: Validate capture behavior across the React lifecycle
status: Done
assignee:
  - '@codex'
created_date: '2026-08-13 20:31'
updated_date: '2026-08-16 16:36'
labels: []
dependencies:
  - TASK-1.1
  - TASK-1.2
  - TASK-1.13
  - TASK-1.16
references:
  - doc-4
modified_files:
  - experiments/capture-lifecycle/README.md
  - experiments/capture-lifecycle/index.html
  - experiments/capture-lifecycle/run.mjs
  - >-
    backlog/docs/experiments/capture-lifecycle/doc-4 -
    Capture-Lifecycle-Experiment-Findings.md
parent_task_id: TASK-1
priority: high
type: spike
ordinal: 9000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Use a disposable, clearly isolated experiment to learn how browser media capture behaves under React lifecycle transitions and common failure conditions. The result should define constraints for a future consumer-facing lifecycle contract, not become production library code.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The experiment reproduces mount, unmount, remount, rerender, and development Strict Mode behavior
- [x] #2 Overlapping or rapidly changing acquisition requests, cancellation, and stale asynchronous completions cannot transfer obsolete media into the active consumer state
- [x] #3 Single and multiple consumer scenarios clarify whether tracks are shared or isolated and who owns stopping or replacing each resource
- [x] #4 Permission denial, missing devices, device removal or switching, partial acquisition, and retry scenarios are observed
- [x] #5 Track ownership and cleanup behavior is verified with leak-relevant evidence across success, failure, replacement, and unmount paths
- [x] #6 Findings distinguish browser behavior, React behavior, and library responsibilities
- [x] #7 The disposable artifact, reproduction steps, observations, and API implications are documented
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Reconfirm the accepted product contract, browser/device evidence, and API prior-art constraints without changing public API or architecture decisions.
2. Build a disposable, isolated capture-lifecycle experiment with deterministic fake MediaDevices/MediaStreamTrack behavior and a React Strict Mode fixture covering lifecycle, races, cancellation, sharing, replacement, failure, retry, and cleanup scenarios.
3. Run the experiment and repository checks, then document reproduction steps, evidence, browser-vs-React-vs-library findings, and approval-gated API implications in a Backlog document and task notes.
4. Verify every acceptance criterion objectively, finalize only TASK-1.3 through the Backlog CLI, commit all scoped changes, and push the task branch.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Research record — 2026-08-17

- Added the isolated experiments/capture-lifecycle artifact: a dependency-free deterministic harness and a real React 18.3.1 development Strict Mode browser witness. No production package code, dependencies, exports, or public API were changed.
- The harness covers five scenarios and 41 assertions: Strict Mode setup/cleanup/setup, mount/remount/rerender, overlapping requests, caller cancellation, stale completions, isolated and explicitly shared consumers, cloned and borrowed tracks, permission denial, missing devices, device removal, failed replacement, partial acquisition, retry, and unmount cleanup.
- Evidence supports generation-based stale-result disposal, explicit owned versus borrowed/shared resources, idempotent direct track stopping, and acquire-then-swap as a research candidate that preserves a working track across replacement failure. These are constraints and alternatives only; no public API or architecture decision is accepted.
- Created and linked Backlog doc-4, Capture Lifecycle Experiment Findings, with reproduction steps, scenario matrix, browser/React/library responsibility split, limitations, primary references, and approval-gated API tradeoffs.
- Validation: node --check experiments/capture-lifecycle/run.mjs passed; node experiments/capture-lifecycle/run.mjs passed with CAPTURE_LIFECYCLE_EXPERIMENT_PASS, 5 scenarios, and 41 assertions; Chrome 151 headless smoke-loaded index.html and exposed the initial Strict Mode setup/cleanup/setup plus two pending requests.

Final validation: pnpm run validate:lifecycle passed with Task-to-PR lifecycle policy and runbook: OK; pnpm run backlog:dispatchable passed and returned the expected remaining leaf tasks; git diff --check passed. All seven acceptance criteria are checked through the Backlog CLI; no Definition of Done items are defined.

Correction after adding the borrowed-resource scenario: the final harness report is 17 fake getUserMedia requests, 5 stale completions discarded, 2 successful replacements, 4 typed failures, 1 partial-acquisition cleanup, 1 externally ended track, and 19 track stops; the earlier counts above describe the pre-correction run.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Created the disposable experiments/capture-lifecycle harness and React 18.3.1 Strict Mode witness, then recorded doc-4 with lifecycle, race, ownership, failure/retry, cleanup, browser/React/library responsibility, and approval-gated API findings. Objective verification passed: 41 deterministic assertions, Chrome 151 fixture smoke test, pnpm run validate:lifecycle, pnpm run backlog:dispatchable, and git diff --check; all seven acceptance criteria are checked. No production API, dependency, export, or Backlog Decision was changed.
<!-- SECTION:FINAL_SUMMARY:END -->
