---
id: TASK-1.7
title: Define the public API and resource-lifecycle contract
status: Done
assignee:
  - '@codex'
created_date: '2026-08-13 20:31'
updated_date: '2026-08-19 18:15'
labels: []
dependencies:
  - TASK-1.3
  - TASK-1.4
  - TASK-1.5
  - TASK-1.16
  - TASK-1.17
references:
  - doc-6
modified_files:
  - >-
    backlog/docs/api/doc-6 -
    Public-API-and-Resource-Lifecycle-Contract-Proposal.md
parent_task_id: TASK-1
priority: high
type: task
ordinal: 13000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Turn validated browser and React constraints into a coherent consumer-facing contract for capture and composable processing. Focus on observable behavior and extension boundaries; defer replaceable implementation details.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The contract defines states, transitions, cancellation, errors, retries, and ownership for media resources
- [x] #2 React-facing usage examples cover composition, rerendering, overlapping requests, multiple consumers, unmounting, and development Strict Mode
- [x] #3 Extension boundaries allow video and audio processing to evolve independently while preserving a coherent consumer model
- [x] #4 Server rendering and non-browser import behavior are explicitly defined
- [x] #5 Resolved significant architectural decisions are recorded with Backlog.md Decisions, while unresolved questions remain tracked as questions or follow-up tasks
- [x] #6 Public API alternatives and tradeoffs are presented to the user, and the contract is not treated as approved until the user explicitly accepts it
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Inspect PR #14, TASK-1.7, and doc-6 and enumerate every reference to application-supplied MediaStreamTrack/MediaStream input, borrowed input ownership, and input adoption/transfer. 2. Revise doc-6 through the Backlog CLI to remove that provisional input feature while preserving session-owned capture/output lifecycle, standard output interoperability, processor cleanup, independent video/audio boundaries, SSR behavior, and the explicit unapproved status. 3. Rewrite TASK-1.7 implementation notes, final summary, and acceptance evidence references so they describe only the narrowed scope; keep unrelated acceptance criteria and evidence intact. 4. Run lifecycle, dispatchable, document/decision, PR, and whitespace checks; finalize only TASK-1.7, commit the scoped records with a Conventional Commit, push the existing PR branch, and verify a clean remote head.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-08-20: User-approved narrowing follow-up on existing PR #14. PR #14 is open/draft at 7105ea0 with no comments, reviews, or reported checks. The proposal now limits capture and processor inputs to session-owned acquisition, preserves standard outputs/interoperability, processor cleanup, and output-clone isolation, and leaves all remaining API choices explicitly unapproved. No new Backlog Decision is required or accepted.

Validation 2026-08-20: doc-6 and task records were read through the Backlog CLI; only decision-1 is accepted. pnpm run validate:lifecycle and pnpm run backlog:dispatchable passed; node --check experiments/capture-lifecycle/run.mjs passed; the fixture run passed with 41 assertions; the narrowed doc contains no caller-owned capture-input or input-adoption/transfer contract; git diff --check passed.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @codex
created: 2026-08-19 02:48
---
Ready for review: doc-6 presents the proposed controller/hooks/provider, standard output and ownership, processor failure, and operation-settlement alternatives with tradeoffs. No public API, compatibility, distribution, or architecture choice is accepted; user approval is required before any proposal becomes normative.
---

author: @codex
created: 2026-08-19 18:06
---
Applying the user-approved scope narrowing to PR #14: remove only the external-input/borrowed/adoption surface and its stale task evidence while preserving session-owned lifecycle, standard outputs, processor cleanup, independent video/audio boundaries, SSR behavior, and the unapproved proposal status.
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Revised doc-6 to define session-owned capture and processor inputs, standard track/stream output interoperability, processor cleanup, and output-clone isolation while keeping remaining API alternatives explicitly unapproved. Removed the out-of-scope caller-supplied input ownership surface and refreshed TASK-1.7 notes/evidence without changing the six acceptance criteria. Verified doc/decision records, pnpm run validate:lifecycle, pnpm run backlog:dispatchable, node --check and run experiments/capture-lifecycle/run.mjs (41 assertions), git diff --check, and PR #14 metadata.
<!-- SECTION:FINAL_SUMMARY:END -->
