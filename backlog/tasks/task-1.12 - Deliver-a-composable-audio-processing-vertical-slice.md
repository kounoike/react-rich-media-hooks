---
id: TASK-1.12
title: Deliver a composable audio-processing vertical slice
status: In Progress
assignee:
  - '@codex'
created_date: '2026-08-13 20:31'
updated_date: '2026-11-20 13:21'
labels: []
dependencies:
  - TASK-1.5
  - TASK-1.10
references:
  - >-
    backlog/decisions/decision-10 -
    Adopt-a-project-built-RNNoise-WASM-engine-with-Zig.md
documentation:
  - docs/audio-processing.md
parent_task_id: TASK-1
priority: medium
type: feature
ordinal: 24000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Prove that a user-approved representative audio transformation can compose with the capture API through the validated extension boundary while meeting the agreed compatibility, speech-quality, and low-latency contract. Use noise reduction when it is included in the approved product scope; otherwise record the approved representative scenario.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A representative consumer can add, update, bypass, and remove the approved audio transformation without reacquiring unrelated media
- [x] #2 Buffering changes, overload, processor failure, cancellation, fallback, and cleanup follow the documented lifecycle and error contract
- [ ] #3 Supported browsers meet the agreed speech-quality, latency, and continuity budgets or expose the documented fallback behavior
- [x] #4 Automated tests and consumer documentation cover the end-to-end transformed-audio journey
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Reconcile the explicitly approved Decisions 8/9/10 and scoped native/audio implementation from the retained historical workspace onto origin/main 8616866; preserve current dependency, video, and workflow updates.
2. Pin Zig 0.15.2 in mise, verify reproducible RNNoise source/model/artifact provenance and local-only private AudioWorklet backend, without new public API decisions.
3. Verify add/update/bypass/remove, buffering, processor and asset failures, cancellation, overload and deterministic session/clone cleanup with actual WASM and browser tests.
4. Collect reproducible speech/noise quality, tier, latency and sustained continuity evidence where available, and document unmeasured gates/fallback cells without asserting support.
5. Run current repository/package checks; record objective AC evidence and remaining gaps; commit/push a clean task branch and publish exactly one manual-lane Draft PR.

6. Rebase the checkpoint onto fetched origin/main 5c81f03, retain its hk/config/Zig gates and dependency lock, add only audio-manifest validation ownership, then rerun shared and relevant browser/package checks before the Draft PR.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Restart authorization 2026-11-20: coordinator message msg_3a1d2a0d5250 confirms the owner retains approvals of Decisions 8/9/10, adopts project-built RNNoise 0.2 + Zig 0.15.2 as the production backend, and authorizes manual reconciliation into task-1-12-audio-restart based on origin/main 8616866. Historical task-1-12-audio-processing at cce08d0 is retained unchanged as evidence/recovery source. No new preapproval Decision or main-thread bridge is needed. Decisions and task records must be restored through Backlog CLI; incomplete quality/latency/continuity gates remain explicit. Manual review is required; no merge is authorized.

Decision restoration capability: Backlog CLI 1.50.1, decision --help exposes only create/list and decision create --help only title/status/plain. It cannot populate Decision bodies or import historical metadata. Restore already approved Decisions 8/9/10 sequentially via CLI with accepted status, fill only allowed body sections from the retained source, preserve the exact new CLI frontmatter, and record historical approval/metadata provenance in Context. This is an authorized restoration of existing approvals, not a newly inferred choice. Current task plan/owner are recorded before production reconciliation.

Current reconciliation evidence (2026-11-20): production patch merged manually with main, keeping Vite 8.2.4, Vitest 4.1.12, security overrides, video crop changes and current workflow policy intact. Restored Decisions 8/9/10 through CLI metadata creation and permitted body-only filling; Context records restoration provenance, and snapshots preserve exact CLI frontmatter. Native WASM source rebuild through mise Zig 0.15.2 is byte-identical (43acc555d5612d3bc59ac3dac5a387059fd33c473d3282f871c8c9475a854b56). Node direct fetch to the model host timed out; Python urllib downloaded identical digest-verified archives into the ignored build cache, then the standard rebuild succeeded. mise installed the exact pinned Zig after a slow-mirror retry.
Added lifecycle fixes/tests: invalid level options now dispose the old processor before publishing original input; active AudioContext interruption/suspension fails observably to original media; tests cover processorerror, output end, duplicate faults, readiness timeout, cancellation, and stale setup after remove/stop/dispose. Unit suite has 48 passing tests after those changes. Initial aggregate verification passed before the new tests; final checks still pending.
Historical deferred tasks TASK-1.26/1.27 remain preserved in the old workspace. Backlog CLI allocates IDs across worktrees: an attempted restore produced unintended duplicate TASK-1.28 instead of TASK-1.26; it was explicitly documented and archived via CLI, then preserved alone in recovery stash e88939cdb67b1d6bf0497b3b1933444a146466a3, excluded from the task PR. No additional engine work started. Decision references to TASK-1.26/1.27 describe retained historical records.
Initial full browser smoke: 27 passed, 5 skipped, 2 failed. Audio Chromium cold activation failed while a later CSP activation succeeded; retry/failure details are being captured. An untouched Chromium video benchmark failed during lifecycle cycling after the audio module was added; investigate integration before claiming all checks pass. Firefox audio lifecycle/fallback passed.
Offline corpus smoke uses three hash-pinned CC-BY-4.0 LibriSpeech clips from one speaker plus two seeded synthetic noise profiles at 0/10 dB SNR, with pinned external numpy/scipy/soundfile/pystoi tools (no package dependency). Original light wet mix 0.45 cannot reach 6 dB even with perfect wet silence (20log10(1/0.55) = 5.19 dB); calibrating this private tier to 0.55 is within approved semantic-tier calibration. Standard/strong passed all 12 limited numeric cells each. Human listening, broader corpus and release qualification remain open.

Post-reconciliation lifecycle verification: 49 unit tests pass, plus typecheck/lint. Added cancellation of a superseding setup restoring the prior settled processor state instead of leaving a stale loading snapshot; generated-output clone independence is also exercised. Native Worklet source/inventory digests were updated after the approved light-tier calibration (0.55 wet); all 36 limited numeric corpus cells now pass 6 dB tail attenuation and no more than 0.03 STOI degradation, with zero clipped samples, but this is one-speaker synthetic-noise evidence only.
Paired 16 kHz-sampled browser loopback (2026-11-20): Chromium 151 remained active, original-track median 21.3125 ms, processed incremental p50/p95 76.6875 ms; browser baseLatency 11.625 ms. This FAILS the 40 ms target and is not physical microphone/speaker qualification. Firefox 153 exceeded 2.67 ms render budgets and correctly restored original media; reject its processed latency estimate. Reports and reproducible runners are included, and AC3 must remain open. A numeric zero latency hint is being measured only in the disposable fixture, not adopted in production.
Early browser failures from changed/removed dist chunks and an interrupted endurance navigation were contaminated by rebuilding during active Vite measurements; do not use those as product quality evidence. Final runs use one persistent server and unchanged dist. The pack command also clears .artifacts; future active measurements/report captures use .cache or /tmp so packaging cannot remove evidence. The already measured quality and baseline loopback summaries were preserved in docs/evidence before that cleanup.

Low-latency-hint comparison: fixture-only latencyHint=0 reduced Chromium baseLatency to 2.667 ms but incremental loopback p95 measured 82.6875 ms (original-track median 12 ms), still above 40 ms. Do not adopt that hint or claim the backend meets latency gates. Default production graph remains unchanged. Full numerical results are recorded in docs/evidence. The updated browser processorerror event-injection regression and the other audio browser journeys pass in both Chromium and Firefox (8/8); native rendering error/overload are independently covered by runtime/worklet tests and the measured Firefox overload.

Latest-main follow-up authorization msg_614eec9360d5: fetched origin/main at 5c81f03 (mise-managed hk quality-gate integration) before Draft PR preparation. Preserve this scoped result in a checkpoint commit, rebase onto that main, resolve tool/script formatting integration explicitly, and rerun hk shared gates, pnpm verify and relevant browser/package/lifecycle checks after the rebase. Pre-rebase measured evidence retains its 8616866 base provenance and is not relabeled as post-rebase performance evidence.

Latest-main integration: checkpoint c76dc77 was safely rebased onto origin/main 5c81f03; resulting implementation commit 3bf12cd preserves the result. Resolved the package.json scripts conflict by retaining all new main hk/config/Zig scripts and adding the audio build/check/rebuild scripts. Automatic mise merge had duplicated the Zig key; retain the exact main mise.toml, which already pins Zig 0.15.2. No dependency/lockfile changes relative to the new main are introduced by audio work.
The new configuration inventory requires explicit ownership for every JSON manifest. Added task-specific schemas for native/rnnoise/manifest.json and tests/fixtures/audio-quality-sources.json, with their owners documented; moved measurement-only JSON into the existing docs/measurements/audio evidence namespace instead of changing gate policy. These are required audio-format integrations, not a separate agent/workflow policy change.
Pre-rebase stable browser smoke passed 31 tests with 9 intentional skips (optional long/latency probes and existing Firefox-only exclusions). The 600.073 s sustained Chromium probe passed one acquisition, clone lifetime and final input/context cleanup; 28,752,000 downstream samples, zero missing-channel quanta/nonfinite samples, 209 all-zero quanta, 1,779 active and 439 degraded status polls, with explicit minute retries. Initial five setups took 147.8-203.2 ms. This validates sustained rendering/fallback and cleanup, not uninterrupted denoised speech or broader warm-start support. Opaque device/group IDs are omitted from committed evidence.
All pre-rebase evidence is explicitly dated and base-qualified; post-rebase shared gates and browser checks are now being run. Measurement reports now live in docs/measurements/audio, superseding the earlier notes path docs/evidence.

Post-rebase quality gate (origin/main 5c81f03, integration working tree on implementation commit 3bf12cd): mise exec -- pnpm quality:gate PASSED, including hk configuration/Pkl/actionlint and supply-chain validation (44 JSON/YAML files, 15 direct dependencies, 230 pinned resolutions, two audio assets), Zig fmt+AST checks, and pnpm verify with 49 unit tests, source formatting/lint/typecheck, native asset checks, ESM/CJS build, packed ESM/SSR/CJS/TypeScript consumers for React 18.2/19.1, and lifecycle policy validation. The first attempt correctly found supply-chain/assets.json newly included in main formatting; formatted only that task-owned file and the full gate then passed.
AC evidence: #1 one-acquisition add/update/bypass/remove with unchanged video in session tests and actual built-browser audio output; #2 actual-model 128/192-sample framing, quantum overload, Firefox original fallback, integrity/module failure, processorerror, context interruption, cancellation/supersession, generated clone independence and deterministic disposal tests plus sustained fallback/cleanup evidence; #4 49 automated unit tests, eight audio browser cases, optional evidence probes and complete consumer/native/measurement docs. Check #1/#2/#4 only. AC3 remains OPEN: Chromium incremental loopback p95 exceeds 40 ms, full representative listening/corpus, physical latency and qualified uninterrupted processing/browser support are still missing.
The processing/runtime/native source and produced Worklet/WASM remain identical across the main rebase; pre-rebase performance evidence is not relabeled. Current-main browser smoke and native rebuild checks will run again before publishing. This is a successful scoped manual-review delivery, not TASK-1.12 completion or release qualification.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Integrated the approved local RNNoise 0.2 AudioWorklet backend with reproducible mise/Zig 0.15.2 native assets, private adapters, session-owned add/update/bypass/remove and typed recovery; restored existing Decisions 8/9/10 without new adoption. Verified lifecycle, actual native framing, package/SSR consumers, CSP/integrity failure and explicit fallback, plus limited quality, loopback and ten-minute evidence. Rebased onto origin/main 5c81f03 and passed its hk shared gate; task remains In Progress because AC3 quality/listening, physical and incremental latency, uninterrupted continuity and browser/device qualification are not satisfied.
<!-- SECTION:FINAL_SUMMARY:END -->
