---
id: decision-9
title: Adopt private denoiser adapters and defer additional engines
date: '2026-11-20 12:54'
status: accepted
---

## Context

Restored on 2026-11-20 through Backlog CLI from the retained task-1-12-audio-processing workspace after coordinator message msg_3a1d2a0d5250 reaffirmed the existing user approval. The original Decision metadata is preserved in that workspace; the new CLI-generated metadata records this restoration. No new architectural approval is inferred.

The user explicitly approved a private interchangeable-denoiser boundary on 2026-11-10 and requested follow-up tasks for additional-engine evaluation and implementation. TASK-1.12 already has session-owned audio processing, cancellation, original-media fallback and cleanup, but the current AudioWorklet host hardcodes RNNoise's module and 48 kHz/480-sample assumptions. Its selected Shiguredo artifact fails in the Worklet's JavaScript initialization before WASM execution. Other concrete candidates include DeepFilterNet3 and GTCRN with different runtime and format requirements.

Decision-2 permits replaceable internal backends and defers generic public plugins. Decision-8 selects the current RNNoise implementation package. This Decision adopts an internal boundary and delivery scope; it does not select a replacement package, denoiser, Rust/Zig toolchain, distribution contract or broader browser support.

## Decision Drivers

- Preserve one capture acquisition, standard outputs, independent audio/video state, cancellation, original-media fallback and deterministic ownership/cleanup.
- Allow concrete denoiser candidates to be evaluated without duplicating the session lifecycle or fixing every engine to RNNoise's native framing.
- Keep the current vertical slice focused on one production backend and avoid publishing an untested plugin compatibility contract.
- Keep implementation language and WASM details private and load only the selected backend's runtime assets.

## Considered Options

1. Keep all lifecycle and RNNoise assumptions together. This has the smallest immediate diff but couples future evaluation and initialization repairs to the common session/runtime code.
2. Adopt a small private backend/adapter boundary and defer additional engines (selected). Reuse the shared lifecycle while each adapter owns its module, native format/framing, conversion and controls. Refine the boundary with a concrete second evaluation later.
3. Publish an application-facing first-party engine selector immediately. This adds a public choice and support matrix before two implementations have evidence; defer until separately reviewed.
4. Publish an arbitrary third-party plugin SDK or stable common WASM ABI. This adds compatibility, ownership, capability, error and loading contracts beyond the first slice; retain Decision-2's deferral.

## Decision

Adopt a private denoiser-adapter boundary in TASK-1.12. Keep capture ownership, output publication, cancellation/supersession, bypass/failure state and common teardown in the session/runtime. Isolate engine selection and the AudioWorklet module/graph requirements behind a private backend definition. Each engine adapter owns native sample rate, framing, conversion/buffering, WASM state and calibrated implementation-specific controls; the common host must not impose RNNoise's 480-sample frame contract on every backend.

Keep the existing first-party noiseReduction and setAudioEffects consumer surface. Deliver one production backend in TASK-1.12; evaluate additional candidates in TASK-1.26 and implement one explicitly approved additional engine in TASK-1.27. The latter tasks are siblings under TASK-1, so the current task remains a dispatchable leaf. Public engine selection, third-party plugins, automatic fallback to another engine, seamless/crossfaded switching and a stable shared WASM ABI are outside this approval.

Preserve Decision-1 quality/evidence gates and Decision-2 lifecycle/SSR/original-media fallback semantics. Rust and Zig can remain engine-specific implementation choices once approved. The approval of this internal boundary does not choose either language or authorize replacement of Decision-8's artifact; a changed runtime/toolchain selection must be explicitly approved and recorded in a new accepted Decision with Supersedes before dependent implementation.

## Consequences

The common runtime becomes testable independently of RNNoise's native format and package. Initial implementation adds a small private backend definition, lazy selection of the existing engine, and lifecycle regression evidence. It does not establish successful first-engine initialization or satisfy the remaining speech-quality, latency and continuity criteria by itself.

Each additional engine adds its own provenance, format/bandwidth, model/asset size, startup, real-time, browser, packaging/CSP/offline and lifecycle validation burden. Semantic levels do not promise equal attenuation or equal quality across algorithms. Output tracks can change visibly during replacement; no inaudible transition is promised. TASK-1.26 retains the current DeepFilterNet3, GTCRN, SpeexDSP and WebRTC research plus evidence limits, and TASK-1.27 depends on the evaluated and user-approved choice.

## Related Tasks

- TASK-1.12: implement the private boundary while delivering and validating one audio-processing backend.
- TASK-1.26: evaluate additional denoisers with reproducible evidence and present an engine/toolchain recommendation for user review.
- TASK-1.27: implement the additional engine selected and explicitly approved after that evaluation.
- TASK-1.15: retain earlier browser noise-reduction prior art.
- Decisions 1, 2 and 8: retain product-quality, session/API/lifecycle and current audio package choices. This Decision supplements them; none is superseded.
