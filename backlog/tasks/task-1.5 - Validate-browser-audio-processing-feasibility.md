---
id: TASK-1.5
title: Validate browser audio-processing feasibility
status: Done
assignee:
  - '@kounoike'
created_date: '2026-08-13 20:31'
updated_date: '2026-08-16 18:49'
labels: []
dependencies:
  - TASK-1.1
  - TASK-1.2
  - TASK-1.15
  - TASK-1.17
references:
  - doc-5
modified_files:
  - backlog/docs/research/media/doc-5 - Browser-Audio-Processing-Feasibility.md
parent_task_id: TASK-1
priority: high
type: spike
ordinal: 11000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Validate whether representative low-latency audio processing, including noise-reduction and filter-shaped workloads, can meet the scoped experience and quality hypotheses. Keep the experiment disposable and compare capability categories without selecting a production processor prematurely.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Representative processing workloads, noise conditions, speech samples, and input profiles are defined from the approved product contract and noise-reduction analysis
- [x] #2 The spike measures end-to-end latency, glitches or underruns, CPU and memory signals, startup cost, and recovery from overload
- [x] #3 Noise attenuation, speech intelligibility, perceived quality, and processing artifacts are evaluated with the agreed repeatable corpus, objective measures where suitable, and documented listening-based comparisons
- [x] #4 Threading, buffering, channel layout, sample-rate changes, processor loading, cancellation, and cleanup constraints are evaluated where relevant
- [x] #5 Browser coverage, device-class limits, fallback behavior, and material privacy or security constraints are documented
- [x] #6 The feasibility conclusion, alternatives, evidence, and tradeoffs are presented to the user; any accepted significant decision is recorded with Backlog.md Decisions only after explicit approval
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Confirm the approved product contract, existing audio/noise-reduction evidence, related tasks, and current browser/runtime availability; keep the work research-only.
2. Build a disposable, source-linked feasibility record covering representative audio workloads/corpus, measurement protocol, execution categories, browser/device coverage, fallbacks, privacy/security, and cleanup constraints.
3. Run any safe local browser or repository probes available, distinguish measurements from unverified hypotheses, and document alternatives and tradeoffs without accepting a production processor, API, compatibility, or architecture decision.
4. Record the report and evidence through the Backlog CLI, link it to TASK-1.5, run required repository checks, verify each acceptance criterion, and finalize only this task.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Created and linked Backlog doc-5, Browser Audio Processing Feasibility, as the dated research record. The report defines capture, pass-through, filter-shaped, noise-reduction, frame-conversion, and overload workloads; a licensed/consented speech and noise corpus; objective and blinded listening measures; latency, underrun, CPU/memory, startup, recovery, threading, buffering, channel/rate, cancellation, cleanup, privacy, CSP, offline, and fallback requirements.

Disposable local smoke probe (2026-08-17 JST; Chrome 151.0.7922.137 headless on secure loopback, fake capture, WSL2 AMD Ryzen 9 5900X/24 logical CPUs/31 GiB) succeeded through AudioWorklet and MediaStreamAudioDestinationNode for pass-through, filter-shaped, exact-mono-request, 48 kHz-context, and bounded-stress profiles. Actual fake input selected 44.1 kHz stereo even for preferred 48 kHz and exact mono; context base latency was 11.61-11.625 ms, graph impulse offset was 0 samples, suspend paused quanta, bounded stress showed no observed gaps/errors, MediaRecorder accepted Opus output, and cleanup closed the context and ended tracks. These are one-run headless smoke signals only; no p95, real speech/noise quality, real-device CPU/WASM memory, ten-minute endurance, or release support claim is made.

Feasibility conclusion remains approval-bound: AudioWorklet plus explicit sample-rate/channel conversion is the strongest next prototype candidate; browser capture processing is the labeled baseline; raw audio Processor/Generator is a Chromium-only comparison because current audio-transform consensus and browser exposure are incomplete; WebCodecs worker/offline paths are benchmark tools. Edge, Safari, mobile, real corpus quality, strict CSP/offline asset delivery, interruption, and five-cycle retention remain open. No production processor, API, compatibility, distribution, or architecture decision was accepted and no Backlog Decision was created.

Offline objective corpus smoke added to doc-5 (2026-08-17): one hashed 7.975 s LibriSpeech dev-clean utterance was decoded/resampled to 48 kHz mono, mixed with deterministic noise at 0 and 10 dB SNR, and compared with pass-through, one-pole alpha-0.15, and 10 ms gate candidates. One-pole effective SNR changed 0 to 7.345 dB at 0 dB input and 10 to 9.610 dB at 10 dB input; clean/output correlation was 0.90616 and 0.94372 respectively, while the gate showed no improvement. This is an offline filter/gate objective smoke only; no human listening panel was run, and doc-5 records that limitation plus the blinded listening method required before release-quality claims.

Finalization verification (2026-08-17): doc-5 was viewed through the Backlog CLI and all ten required report sections plus the acceptance-evidence map were present; no literal backslash-n content was found. The document list contains doc-5 and existing docs, while decision list still contains only accepted decision-1; no new significant decision was created. `pnpm run validate:lifecycle`, `pnpm run backlog:dispatchable`, and `git diff --check` all passed. Acceptance criteria #1-#6 were checked through the Backlog CLI against the doc-5 evidence map, offline objective smoke, live Chrome smoke, browser matrix, and approval-bound conclusion.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Created and linked Backlog doc-5 with an evidence-backed browser audio feasibility report. A disposable Chrome 151 AudioWorklet smoke measured capture/startup, graph latency signals, suspend/resume, channel/sample-rate conversion, bounded stress, MediaRecorder handoff, heap signals, and deterministic cleanup; an offline hashed LibriSpeech objective smoke measured SNR, correlation, speech error, and clipping for filter/gate workloads, while the documented listening-panel limitation prevents any release-quality claim. Compared browser capture processing, AudioWorklet/WASM, Chromium raw-track transforms, WebCodecs/offline, and excluded cloud/native alternatives; all significant choices remain approval-bound. Verified with pnpm run validate:lifecycle, pnpm run backlog:dispatchable, git diff --check, Backlog doc/decision checks, and acceptance-criteria verification.
<!-- SECTION:FINAL_SUMMARY:END -->
