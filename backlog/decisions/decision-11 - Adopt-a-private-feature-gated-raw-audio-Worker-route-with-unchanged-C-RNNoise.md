---
id: decision-11
title: Adopt a private feature-gated raw-audio Worker route with unchanged C RNNoise
date: '2026-11-21 00:22'
status: accepted
---

## Context

The owner explicitly approved TASK-1.12 item 1 in Dispatch ctx_dfe716058329 (orchestration task task_cdde20b03330): implement and qualify a private feature-gated raw-audio Worker direction with unchanged production C RNNoise. This is architecture authorization, not release, compatibility expansion, SIMD adoption, task completion or merge approval. Existing Decisions 8/9/10 and docs/measurements/audio/route-prototypes.md were reviewed first. Long native embedding diagnostics measured raw C added p95 at 40 ms exactly, raw SIMD at 42 ms, and SIMD Worklet at 81.3125 ms; these do not qualify standalone browsers/devices. Human review is pending and expanded numeric quality passes 119/120 cells.

## Decision Drivers

- Move inference off the rendering callback where raw audio capabilities permit, preserving the unchanged C artifact, ABI and semantic API.
- Preserve capture/session ownership, independent application clones, SSR, original-track fallback and the Worklet route for ineligible input.
- Bound queueing, detect failure/overload and qualify real graph latency/continuity without changing thresholds or concealing unsupported states.

## Considered Options

1. Retain exclusive Worklet inference: keeps deployment simplest, but current long-run latency and Firefox rendering failures remain unresolved.
2. Adopt a SAB Worklet/Worker ring: requires cross-origin isolation and failed measured underrun/overflow trials; not adopted.
3. Permit a private default-off raw-audio Worker route using transferable streams (selected): promising measured C direction, requires capability/rate gating and further lifecycle/quality/browser qualification.
4. Replace C with SIMD or a new engine: not authorized or necessary for this direction; preserve C as the distributed oracle.

## Decision

Permit a private build-gated raw-audio Worker adapter with the unchanged project-built RNNoise C WASM artifact, hash and ABI. Default builds retain the current Worklet; qualification builds may enable the private gate. There is no public engine/route option. Require actual Window audio processor/generator, Worker AudioData and transferable-stream usability; missing/ineligible capabilities use the existing Worklet. Initially only known 48 kHz mono tracks qualify; other/unknown rates or channels retain Worklet resampling/downmix. Do not introduce raw resampling or change the public compatibility contract.

Keep prepare/hash verification outside processing, 480-sample mono framing, two-frame dry alignment, existing semantic mixes and frame-boundary updates. Bound input chunks and pending output writes, require usable written output before activation, report stalls/continuity failures observably and restore original media through the existing session contract. Do not automatically switch an already selected failing route to another engine/route. Make startup abort, stale setup, source/output end and disposal deterministic; stop only owned tracks and preserve application clones by releasing rather than closing/aborting the generator writer. Bound cooperative shutdown and force-terminate stuck workers.

Raw transferable streams do not require SAB or cross-origin isolation. This decision does not authorize a SAB route: any such route must require both isolation and SharedArrayBuffer and needs separately evidenced approval. Constructor presence alone does not promise Firefox, Edge or WebKit audio support. Retain the current Worklet budget of 2.667 ms where inference renders there and the graph-inclusive 40 ms added p95, overload, quality, human review, ten-minute denoised continuity, browser/device, memory/import/artifact/size gates unchanged.

## Consequences

A versioned bundled private Worker asset and worker-src CSP allowance are required only for enabled qualification builds. The repository owns Worker lifetime, stream transfer, bounded storage and evidence. Browser-controlled endpoint scheduling/queues remain measurement limits. Qualification failures stay visible; TASK-1.12 AC3 remains open until fully proven. No dependency, public API, alternate model, SIMD adoption, C deletion, support promise or merge is authorized. Further product/architecture changes require explicit owner approval.

## Related Tasks

- [TASK-1.12](<../tasks/task-1.12 - Deliver-a-composable-audio-processing-vertical-slice.md>): implement and qualify this gated direction in existing Draft PR #32; preserve old worktrees.
- Decisions 1/2/9: product-quality, public/session ownership and private adapter contracts remain in force.
- docs/measurements/audio/route-prototypes.md: prior evidence, failed alternatives and remaining gates.

## Supersedes

- [Decision-10](<decision-10 - Adopt-a-project-built-RNNoise-WASM-engine-with-Zig.md>): supersede only its exclusive Worklet inference and no-additional-Worker clauses for the private gated eligible raw-audio route. Preserve all C/source/model/Zig/ABI/memory/provenance/API/lifecycle/fallback/quality requirements and the existing Worklet for ineligible tracks.
- [Decision-8](<decision-8 - Adopt-AudioWorklet-and-RNNoise-for-the-first-audio-processing-slice.md>): supersede the corresponding Worklet-only/no-extra-Worker restrictions retained by Decision-10 to the same narrow extent. Preserve historical accepted Decisions unchanged.
