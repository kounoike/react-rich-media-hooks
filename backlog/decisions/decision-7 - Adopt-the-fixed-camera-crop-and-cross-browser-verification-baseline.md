---
id: decision-7
title: Adopt the fixed camera crop and cross-browser verification baseline
date: '2026-09-25 10:06'
status: accepted
---
## Context

On 2026-09-25 the user approved a fixed, user-selected camera crop at the 1280x720/30 fps input profile as TASK-1.11's representative video transformation. The user also approved adopting the provisional verification policy in TASK-1.6's Cross-Browser Verification Strategy as the baseline. Before that approval, decision-1/doc-1 already included crop, background blur, still-image replacement, and auto-framing in the first-release product scope but did not choose the representative slice; decision-2 established the semantic processor lifecycle and output ownership contract. This Decision records the user's selection for TASK-1.11 and makes the TASK-1.6 verification proposal authoritative without changing either earlier Decision.

The TASK-1.4 feasibility report supplies plumbing evidence, not a production backend choice. Its synthetic Chrome 151 canvas-crop run delivered 25.2 fps with 25 of 50 frames dropped and 26.4 ms p95 latency; its worker transfer and raw-track paths had browser-specific limits. Edge, Safari, physical devices, and real camera profiles were not measured there. Those results make a fresh baseline and explicit fallback evidence necessary.

## Decision Drivers

- Deliver one bounded first-party video transformation through the accepted session and processor lifecycle.
- Let the consumer add, update, bypass, and remove the crop without reacquiring the camera or disturbing unrelated audio.
- Compare capture-only, pass-through, and crop behavior against the approved per-browser budgets before optimizing.
- Keep misses, unsupported environments, and missing browser/device evidence visible; do not turn unknown rows into support claims.
- Preserve the accepted semantic API and ownership contract while leaving the crop backend replaceable.
- Keep background blur, background replacement, and auto-framing out of this task's slice so model, asset, and tracking work does not obscure the crop baseline.

## Considered Options

1. **Fixed user-selected camera crop (adopted).** It is the first video journey after capture in doc-1, exercises the accepted output/lifecycle boundary, and has a direct TASK-1.6 budget. The TASK-1.4 synthetic crop result is below the 30 fps budget, so the slice must establish its own baseline and provide the accepted original-video bypass when unsupported or unhealthy.
2. **Background blur or still-image replacement.** Both are approved first-release outcomes, but each requires segmentation/compositing quality evidence and model/runtime or asset lifecycle work; replacement also introduces consumer asset-loading behavior. They are broader than the representative slice needed here.
3. **Single-subject auto-framing or a composed background effect.** This is also in the approved product scope, but adds detection, tracking, stabilization, and combined-effect quality/performance requirements. It is not the smallest transformation for TASK-1.11.
4. **Verification cadence alternatives in doc-6.** Broader per-pull-request coverage across all desktop engines would detect regressions sooner at higher runner cost; release-focused coverage would lower routine cost but delay detection. Adopt the balanced proposal: Chrome/Firefox pull-request smoke, Edge/Safari nightly or merge-queue smoke, all four desktop engines at release, and mobile feasibility/manual evidence only.



## Decision

Adopt the fixed, user-selected camera crop as the TASK-1.11 representative scenario. The source profile is 1280x720 at 30 fps. The crop is a static valid rectangle supplied by the application; crop selection UI remains application-owned. The task must demonstrate add, update, bypass, and removal through the accepted video-effect boundary while preserving the active capture session and unrelated audio. Background blur, background replacement, auto-framing, and effect composition are not part of TASK-1.11; this does not remove them from decision-1's first-release product scope.

Adopt the TASK-1.6 Cross-Browser Verification Strategy (verification/doc-6) as the approved verification baseline. The directly applicable video budgets are:

- Capture-only 720p/30 video delivers at least 30 fps after warm-up, loses no more than 1% of source frames unexpectedly, and produces the first usable frame within 500 ms after permission resolution.
- Fixed crop at 720p/30 sustains 30 fps when the source supplies 30 fps and adds no more than 50 ms p95 source-to-preview latency.
- Warm effect startup completes within 1 second after any required assets are locally available; cold asset transfer is measured separately.
- Inactive journeys leave no library-owned live processing resource. After five warm start/stop cycles retained heap returns within 10% or 5 MiB, whichever is larger, of the inactive post-warm-up baseline.

Use doc-6's evidence rules: record exact browser/device and runtime versions, fixture and commit, capture-only baseline, no-op/pass-through and crop stages, source/output timestamps, p50/p95/maximum and sample count, input/delivered/dropped frames, startup, resource signals, recovery, cleanup, and raw per-run results. Warm up, run at least three independent benchmark runs per profile, and preserve at least five warm start/stop cycles for retention. Use the same profile on each browser/device row. CPU ceilings remain unset until capture-only measurements exist on agreed reference desktop tiers.

The desktop support hypothesis is Chrome, Edge, Firefox, and Safari with the doc-6 balanced cadence. Mobile remains feasibility/manual only and is not an initial support guarantee. If a required browser, device, runner, or metric is unavailable, record that row as `unknown` or `blocked` with the exact gap; do not infer a pass or silently skip a release row. An unsupported or over-budget crop must expose the documented bypass/degraded state and original-video fallback, with the failed measurement retained in the report.



## Consequences

TASK-1.11 can proceed with a static crop and a measured original-video fallback without selecting a release-wide processing backend. Its performance acceptance is limited to the adopted crop and capture-only budgets; the combined auto-framing/background-effect budget applies only when that separate scenario is in scope. Chrome and Firefox can be measured in pull-request automation; Edge and Safari remain unknown until their native runners are available, and mobile measurements do not establish support.

The feasibility evidence predicts that a rendered canvas implementation may miss the fixed-crop frame-rate budget in some environments. Any implementation must record its own result, preserve original video on bypass, and create only targeted follow-up optimization work for reproducible misses. No CPU limit, accelerator, worker strategy, model/runtime, general plugin API, or change to accepted ownership semantics is selected here.

## Related Tasks

- TASK-1.6 — Define the cross-browser verification strategy.
- TASK-1.11 — Deliver a composable video-processing vertical slice.
- verification/doc-6 — Cross-Browser Verification Strategy.
