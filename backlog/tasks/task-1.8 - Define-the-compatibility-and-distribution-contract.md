---
id: TASK-1.8
title: Define the compatibility and distribution contract
status: Done
assignee:
  - '@codex'
created_date: '2026-08-13 20:31'
updated_date: '2026-08-20 15:47'
labels: []
dependencies:
  - TASK-1.2
  - TASK-1.7
references:
  - doc-7
  - decision-3
parent_task_id: TASK-1
priority: high
type: task
ordinal: 14000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Define what consumers can rely on when installing, importing, typing, and upgrading the library. Base the contract on the validated browser constraints and public API rather than choosing build tooling first.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Supported React, TypeScript, browser, and server-rendering environments are stated with a maintenance policy
- [x] #2 Required package entry points, type exposure, module interoperability, tree-shaking behavior, side-effect expectations, peer dependencies, and published-file boundaries are specified
- [x] #3 Browser-only behavior and safe import behavior in non-browser environments are specified
- [x] #4 Versioning and stability expectations distinguish experimental processing capabilities from stable contracts
- [x] #5 Distribution and version alignment for workers, worklets, WebAssembly, models, and other optional runtime assets are specified with hosting, offline, and content-security constraints where relevant
- [x] #6 Significant architectural decisions are recorded with Backlog.md Decisions, including evaluated alternatives and consequences
- [x] #7 Compatibility and distribution alternatives are presented to the user, and the contract is not treated as approved until the user explicitly accepts it
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Create a new Backlog document for the compatibility and distribution contract proposal, grounded in accepted decision-1/decision-2, doc-1/doc-6, browser feasibility, prior-art, output, and verification evidence.
2. Record the approval-bound recommendation as a proposed Backlog Decision with alternatives and consequences; preserve accepted decisions and do not accept any new public compatibility, distribution, dependency, release, or architecture choice.
3. Link the proposal and proposed Decision to TASK-1.8, and record research, CLI, scope, and validation evidence in task notes.
4. Verify every acceptance criterion objectively, run lifecycle/dispatchable/document and relevant repository checks, mark the task Done as a proposal requiring explicit user review, and prepare a clean pushed branch for coordinator Draft PR publication.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-08-21: Started TASK-1.8 as @codex after reviewing accepted decision-1 and decision-2, doc-1, the public API contract doc-6, browser capability/video/audio feasibility evidence, prior-art doc-2, output/transport doc-3, lifecycle doc-4, and verification doc-6. The repository currently has only a private pnpm package shell plus Backlog records, experiments, and lifecycle scripts; no production package entry points or distribution metadata exist yet. The proposal will define the contract without selecting build tooling or accepting unresolved compatibility/distribution/architecture choices.
2026-08-21: Backlog CLI 1.50.1 was checked with backlog --version, backlog decision --help, and backlog decision create --help. Decision create accepts title/status only and generates a body skeleton; after creating a proposed Decision, the narrowly scoped Decision-body exception may be used for the required body sections while preserving frontmatter exactly. No accepted Decision will be rewritten.

2026-08-21: Created doc-7, Compatibility and Distribution Contract Proposal, through backlog doc create/update. It states the proposed React 18.2/19, TypeScript, desktop browser, SSR, secure-context, Permissions Policy, package entry-point/type/module/tree-shaking/side-effect/peer/published-file, optional asset, hosting/offline/CSP/CORS/isolation, stability/SemVer, alternatives, approval questions, and evidence contract. It is explicitly unapproved and keeps mobile, Edge/Safari support, exact floors, module mode, asset packaging, CSP/isolation, and fallback policy approval-bound.
2026-08-21: Created decision-3 with status proposed through backlog decision create; because CLI 1.50.1 only generates a body skeleton, filled only Decision body sections via the documented narrow exception and preserved decision-3 frontmatter exactly. decision-1 and decision-2 remain accepted and untouched.

2026-08-21 validation: backlog doc view doc-7 --plain confirmed the full proposal and acceptance-evidence map; decision-3 frontmatter remains id decision-3, title unchanged, date 2026-08-20 15:41, status proposed, with non-empty Context, Decision Drivers, Considered Options, Decision, Consequences, and Related Tasks sections. backlog doctor reports pre-existing ambiguous document IDs doc-5 (audio/video feasibility) and doc-6 (API/verification); no fix was applied because the duplicate files are outside TASK-1.8 scope.
Checks passed: node --check experiments/capture-lifecycle/run.mjs; node experiments/capture-lifecycle/run.mjs (CAPTURE_LIFECYCLE_EXPERIMENT_PASS, 5 scenarios, 41 assertions); pnpm run validate:lifecycle; pnpm run backlog:dispatchable (selectedTasks empty); git diff --check; backlog decision list/doc list and backlog doc view/task view.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Completed TASK-1.8 as an explicit approval-bound proposal. Created and linked doc-7, Compatibility and Distribution Contract Proposal, covering proposed React/TypeScript/browser/SSR support and maintenance, package entry points/types/module conditions/tree-shaking/side effects/peers/published files, browser-only and SSR behavior, stable versus experimental SemVer, versioned worker/worklet/WASM/model assets, hosting/offline/CSP/CORS/isolation, alternatives, tradeoffs, unresolved approval questions, and evidence links. Created proposed decision-3 with non-empty required body sections and preserved accepted decision-1/decision-2 unchanged; verified with backlog doc/task/decision views, backlog doctor (pre-existing doc-5/doc-6 duplicate IDs reported and left untouched), CAPTURE_LIFECYCLE_EXPERIMENT_PASS (41 assertions), pnpm run validate:lifecycle, pnpm run backlog:dispatchable, and git diff --check. The proposal remains subject to explicit user approval; no new compatibility, distribution, dependency, release, public API, or architecture choice was accepted.
<!-- SECTION:FINAL_SUMMARY:END -->
