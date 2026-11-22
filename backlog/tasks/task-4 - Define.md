---
id: TASK-4
title: Define and document shared media-processing health and statistics contract
status: In Progress
assignee:
  - '@codex'
created_date: '2026-11-22 11:40'
updated_date: '2026-11-22 12:08'
labels:
  - media
  - api
  - quality
dependencies:
  - TASK-1.7
references:
  - >-
    backlog/tasks/task-1.12 -
    Deliver-a-composable-audio-processing-vertical-slice.md
  - >-
    backlog/tasks/task-1.11 -
    Deliver-a-composable-video-processing-vertical-slice.md
  - >-
    https://github.com/kounoike/react-rich-media-hooks/commit/f92bd88de5374d96991bd509b31c5f04fbbd5d24
  - decision-2
  - >-
    https://github.com/kounoike/react-rich-media-hooks/blob/f92bd88de5374d96991bd509b31c5f04fbbd5d24/backlog/decisions/decision-12%20-%20Qualify-audio-latency-targets-through-approved-scenarios-and-baseline-evidence.md
  - 'https://github.com/kounoike/react-rich-media-hooks/pull/34'
  - >-
    https://github.com/kounoike/react-rich-media-hooks/pull/34#issuecomment-7078867233
documentation:
  - docs/media-processing-observability-proposal.md
modified_files:
  - docs/media-processing-observability-proposal.md
  - backlog/tasks/task-4 - Define.md
priority: high
type: spike
ordinal: 28000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Review and document a shared application-observable status and statistics contract for audio and video processing. The contract must let consuming applications distinguish healthy processing, degraded latency or load, fallback, unsupported capability, failure and recovery, while exposing useful aggregated latency and continuity statistics without leaking raw media or device identity. This is a design and documentation prerequisite; it must not silently relax TASK-1.12 latency or quality gates or claim release support.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The existing audio and video lifecycle and status surfaces, fallback semantics and public API constraints are audited, with concrete gaps and compatibility risks recorded.
- [x] #2 A common typed status model is documented with state transitions, effect-specific reasons, recovery behavior, debouncing or hysteresis and notification delivery semantics.
- [x] #3 Latency and continuity statistics are defined precisely, including windows, percentiles, baseline relationship, late or missed audio blocks, dropped or stale video frames, overload and fallback counters, and privacy boundaries.
- [x] #4 React and SSR behavior, versioning, consumer usage, disabled or default behavior and interaction with TASK-1.12 AC3 and the video slice are documented without changing existing thresholds or support claims.
- [x] #5 The design is recorded through Backlog and repository documentation, and any material public-contract decision is explicitly proposed for owner review rather than implicitly accepted.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Audit main at 5c81f03 and pinned audio candidate f92bd88, including lifecycle, API, fallback, React/SSR, existing docs and Decisions; record compatibility gaps.
2. Write a repository owner-review proposal with shared typed health, effect-specific statistics, notifications, recovery, privacy, consumer examples and explicit alternatives; preserve existing production contracts.
3. Relate the proposal to applicable Decision-2 and pinned proposed Decision-12; adopt no new architecture or public-contract choice. A later owner-selected choice requires a new accepted Backlog Decision before implementation.
4. Validate document links, proposal types/examples, unchanged public/runtime/distribution files and repository quality gate; record acceptance evidence and unresolved owner decisions.
5. Commit and push the scoped task branch, then report evidence and manual-review requirements to the coordinator.

6. Follow-up Dispatch ctx_2b93eae5bf44: publish or reuse the single TASK-4 Draft PR from e4d34ae; obtain current-head CI and an independent review-agent check; address only scoped documentation findings; record publication and review evidence, then finalize and report.

7. Preparation authorized by msg_8341cf409cef after the published-head CI and independent review: document slices P0-P8 and owner gates G0-G5 in proposal section 10; do not create tasks, duplicate workers/PRs, accepted Decisions or production changes in this scoped PR.
8. Correct independent review R1-R3/C1-C2, run isolated type/link/scope validation and current-head CI, and ask the same reviewer to verify the final document and preparation boundary.
9. Record final PR/head/CI/review evidence and the implementation-preparation outcome in TASK-4; return Done only for the documentation/preparation scope, retaining exact adoption and implementation gates.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Dispatch ctx_7786b1f72c8d / Run run_4c34d4390ca9: coordinator explicitly authorized exact restoration of the pre-existing untracked TASK-4 record from task-1-12-audio-restart (message msg_68c5ed6185b2); cmp verified identical bytes before CLI edits. Branch remains based on origin/main 5c81f03. Audio implementation and Decision-12 remain external pinned evidence at f92bd88 and are not merged or copied. Task execution guide and task-edit help read before lifecycle edits.

Audit findings: main 5c81f03 exposes ProcessorStatus/status/effects and string lastTransition reasons, with no public statistics; main audio setter is unsupported. Unmerged audio f92bd88 has private bounded native-frame timings, Worklet overload fallback and default-off raw Worker diagnostics, which cannot establish output latency or exact missed audible blocks. Crop guard uses two >=2s slow windows at <95% for >=29fps input; callback gaps do not measure exact camera loss. Decision-2 remains applicable lifecycle authority; proposed Decision-12 separates legacy original-median and prospective paired estimators and retains 40 ms/AC3 gates.
No significant choice is adopted in TASK-4. Alternatives and material API/measurement/default choices are recorded as owner-review proposals in docs/media-processing-observability-proposal.md under the existing Decision-2 diagnostic review boundary, avoiding an unapproved accepted Decision or a conflicting branch-local Decision ID. Implementation and any accepted contract need a new Backlog Decision after explicit owner choice. Backlog 1.50.1 and decision/create help were inspected (no Decision body fields); no Decision-body edit or exception was needed.

Acceptance evidence (2026-11-22):
AC1: proposal section 1 audits main 5c81f03 and unmerged audio f92bd88 lifecycle/status/public API/fallback surfaces, native compute vs output delay, source loss uncertainty, ownership and compatibility risks against Decisions 1/2/6/7 and pinned 8-12 evidence. Source-path validation confirms all 8 pinned Git blob paths exist; no audio implementation or Decision text was imported.
AC2: sections 3-4 define typed common status projection and per-kind reasons, independent domains, cancellation/supersession, route/fallback/recovery transitions, immediate lifecycle invalidation, coalesced statistics, proposed debounce/hysteresis and latest-store delivery. Four TypeScript fences compile together under strict NodeNext; negative type checks reject cross-kind reason and unavailable numerical access. Existing ProcessorStatus union matches source exactly.
AC3: section 5 defines p50/p95/p99/max with exact nearest rank, empty/partial/omitted samples, windows/epochs/counts, baseline and signed legacy-vs-paired delta, audio quantum vs native frame late/missed definitions, distinct video dropped/stale/callback gaps, bounded typed overload/fallback episodes and cross-clock/units. Sections 5-6 preserve unavailable values and local aggregate privacy.
AC4: sections 6-8 define default-off/disabled statistics, unchanged effect behavior, stable SSR/hydration snapshots, React cadence and lifecycle visibility, consumer examples and compatibility/versioning; Decision-12 stays proposed and TASK-1.12 AC3 remains unresolved. No change to 40 ms, quality gates, video acceptance or support scope.
AC5: sections 1-2/8 retain existing authority, alternatives/tradeoffs and explicit owner-review gates; no new contract or Decision is accepted. Future implementation requires explicit choice and a new accepted Decision. This design spike can be Done while its proposed public contract remains unapproved.
Validation: pnpm quality:gate passed (configuration inventory 37 JSON/YAML files, hk/actionlint/supply-chain, Zig no-source check, format/lint, 21 unit tests across 4 files, typecheck/build, packed ESM/CJS/SSR/TypeScript consumers on React 18.2.0 and 19.1.1, lifecycle policy). python3 .artifacts/task-4-validation/validate.py passed: 4 TS fences compiled with pnpm exec tsc --ignoreConfig --noEmit --strict --target ES2022 --module NodeNext --moduleResolution NodeNext --skipLibCheck; 2 negative type assertions, 15 local links, 8 pinned Git paths and exact status union checked. git diff --check passed. Source/tests/scripts/dependency/CI/workflow/Backlog Decision/canonical Backlog doc diff against 5c81f03 is empty. No media experiment was run; remote CI and PR review are not claimed.
Completion ID: task-4-ctx_7786b1f72c8d-design. Outcome: succeeded. Acceptance criteria remaining: none for the design/documentation spike. Unresolved owner decisions: optional observer API/placement, final vocabulary/compatibility, collection budget/retention, window/cadence/hysteresis defaults and metric-specific warning policy; Decision-12 scenario/reference/protocol selection and any later numerical/support choice remain separate.
Automatic-lane evidence: manual review required (unresolved public-contract proposals and >300 changed lines); no Decision file changes, no published API changes, no compatibility changes and no distribution changes. No agent/workflow improvement was identified: Agent improvement PR: none. Coordinator owns the one task Draft PR after validating this clean pushed branch; worker is not opening a duplicate PR.

PR publication follow-up authorized by the coordinator under task_657876311db8 / Dispatch ctx_2b93eae5bf44, superseding the previous coordinator-owned publication handoff for this follow-up only. Confirmed no PR on task-4-observability-contract before creation. Existing design AC evidence is retained; the record is temporarily In Progress for the explicitly requested publication, current-head CI and review-agent verification. No implementation, public API, historical Decision, threshold or support scope change is authorized.

Published the single Draft PR #34 at https://github.com/kounoike/react-rich-media-hooks/pull/34 from fdae36e7086d2c1e06098ff79b336d1d3e438ae7; verified Draft state, exact branch/head and real newline bytes in the body. CI validation run 45020092701 is queued for that head (Node 22.23.2/24.19.0 quality and Chromium/Firefox smoke). Independent read-only review agent will review the same scoped documentation; final-head evidence will be linked before handoff. No merge or contract acceptance is authorized.

Follow-up steering received via coordinator message msg_8341cf409cef: owner approved the observer/statistics design direction and selected implementation preparation, after completing PR #34 current-head CI/review. Scope is preparation only: decompose the public observer contract, audio/video adapters, aggregation, recovery, React/SSR, validation/docs and compatibility/rollout; record outstanding owner decisions before any public API/runtime/threshold/support or Decision adoption change. Retain this single documentation PR and current worker; do not create duplicate PRs/workers. The material public names/measurement/default details remain proposals until the precise adoption boundary is recorded. Current published head fdae36e7086d2c1e06098ff79b336d1d3e438ae7 has all four CI checks successful in run 45020092701; independent read-only review ctx_8da075a66147 is still in progress.

Independent review ctx_8da075a66147 completed on fdae36e: no P0/P1; three P2 contract inconsistencies (R1 deferred effect configuration without capture; R2 inaccessible metadata when quantiles unavailable; R3 overload episode source lost after coalescing), plus C1 startup fallback double-count wording and C2 no-effect history wording. Addressed in the proposal: explicit off/bypassed+none deferred row; always-present Distribution metadata with unavailable quantile summaries and capacity-exceeded accounting; source+reason episode breakdown; clarified fallback entry condition and epoch totals after effect removal. These are documentation corrections only.
Preparation boundary recorded before any adoption/implementation: section 10 decomposes P0 contract/accepted-Decision freeze, P1 observer API, P2 aggregation, P3 state/recovery, P4 video adapter, P5 audio adapter gated by separately integrated TASK-1.12, P6 React/SSR, P7 tests/docs/privacy and P8 experimental rollout. G0-G5 list precise additional owner decisions; no new Backlog tasks/Dispatches/PRs are created. Design direction is owner-approved for preparation, but final declarations/defaults, Decision-12 protocol and numeric/support changes are not silently adopted. Existing Decisions and production/API files remain unchanged. Final current-head CI and same-agent re-review will follow the scoped commit.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Documented the shared audio/video health and statistics owner-review proposal, audited mainline and pinned unmerged audio evidence, and made measurement availability, transitions/recovery, notification policy, React/SSR/default-off behavior, privacy, compatibility and future validation explicit. All five documentation acceptance criteria are evidenced; pnpm quality:gate, isolated strict TypeScript examples/negative assertions, 15 local links, 8 pinned Git paths, unchanged-contract diff and git diff --check pass. No public API, runtime code, Decision, existing quality threshold or support promise changed; the proposed contract and Decision-12 choices require owner review before implementation.
<!-- SECTION:FINAL_SUMMARY:END -->
