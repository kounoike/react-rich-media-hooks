---
id: decision-10
title: Adopt a project-built RNNoise WASM engine with Zig
date: '2026-11-20 12:54'
status: accepted
---

## Context

Restored on 2026-11-20 through Backlog CLI from the retained task-1-12-audio-processing workspace after coordinator message msg_3a1d2a0d5250 reaffirmed the existing user approval. The original Decision metadata is preserved in that workspace; the new CLI-generated metadata records this restoration. No new architectural approval is inferred.

The selected Shiguredo RNNoise WASM artifact cannot initialize in AudioWorklet: its source requires Window/WorkerGlobalScope and its emitted bundle accesses self.location. Minimal WASM runs inside the same Chromium/Firefox Worklets, so this is a distribution/glue incompatibility. The user proposed a project-owned WASM build with Rust or Zig; the comparison recommended Zig when retaining the upstream C RNNoise engine. Following approval of the private boundary and the subsequent explicit instruction to proceed with the first engine, adopt that project-owned build. Additional engine selection remains deferred to TASK-1.26/1.27.

## Decision Drivers

- Run the existing local RNNoise 0.2 algorithm on the rendering thread without an audio-frame round trip to the main thread.
- Reuse upstream C and the identified model rather than rewrite the suppression algorithm.
- Control initialization, bounded memory, exact imports, artifact integrity, source/model provenance and local asset delivery.
- Preserve Decisions 1, 2 and 9: existing semantic API, private adapters, one capture, standard output replacement, original-media fallback, deterministic cancellation and ownership, SSR and measured browser support.

## Considered Options

1. Continue with the incompatible Shiguredo artifact or spoof browser globals. This retains a package but leaves unsupported initialization assumptions and is rejected.
2. Move inference to the main thread behind a bounded MessagePort bridge. This adds per-frame scheduling and continuity risk under UI contention and is not selected.
3. Use another published Worklet-ready RNNoise build. This can reduce build ownership, but the user chose a project-owned artifact and provenance/build control.
4. Compile upstream C through a Rust wrapper. Viable with a separately solved C runtime/toolchain, but adds FFI/build machinery when the engine stays in C.
5. Compile upstream C with Zig and a thin private ABI adapter (selected). This consolidates C compilation/linking and explicit memory/exports; the repository owns reproducibility, notices and updates.

## Decision

Replace the Shiguredo runtime artifact with a project-built RNNoise 0.2 WASM module using pinned Zig 0.15.2. Pin upstream source commit 904a876dce1f9ab8860c0a5000ed151f9f6eef58 and model archive rnnoise_data-0b50c45, with cryptographic source and generated-artifact digests recorded in the repository. Reuse upstream inference and model; compile only the required inference path and expose a minimal private lifecycle/buffer/process ABI. Preallocate per-instance state and frame buffers and verify that rendering does not allocate or grow WASM memory.

The final module must instantiate directly in the browser without a WASI runtime, browser-global spoofing or Emscripten environment glue. A compiler sysroot may supply standard C/math implementations at build time; inspect the final module imports and reject unsupported imports rather than adding silent stubs. Preserve relevant upstream and runtime notices.

Prepare/fetch, verify and compile the asset outside the audio processing callback, deliver the prepared module to the AudioWorklet, and instantiate/run inference there. Keep no additional Worker, the 48 kHz mono/480-sample RNNoise frame requirement, bounded framing, the existing noiseReduction/setAudioEffects and bypass API, application-owned clones and original-media fallback. Keep the engine behind Decision-9's private adapter. Remove the now-unused Shiguredo package and retain the package's existing entrypoints and SSR behavior.

## Consequences

The repository now owns a native build command, toolchain/source/model pins, reproducibility and artifact/notice checks, asset version compatibility and updates. Normal package consumers receive the built asset and do not need Zig; contributors rebuilding the native engine use the pinned compiler. A working build and processed output do not by themselves establish speech quality, 40 ms added p95, continuity, calibrated semantic levels, warm startup or a browser/device support promise. Keep these gates measured and report fallback or limits honestly. Do not add a public plugin API, alternate engine, automatic engine fallback or seamless switching under this Decision.

## Related Tasks

- TASK-1.12: build/integrate/validate the first RNNoise WASM backend.
- TASK-1.26 and TASK-1.27: retain additional-engine evaluation and approved implementation as future work.
- Decisions 1, 2 and 9: retain product-quality, public/session lifecycle and private-adapter contracts.

## Supersedes

- Decision-8: replace its specific @shiguredo/rnnoise-wasm 2025.1.5 package/build selection with the project-built RNNoise WASM engine. Preserve its RNNoise 0.2, Worklet-side inference, no-extra-Worker, semantic API, ownership/fallback and measured quality/support requirements. Keep the historical Decision metadata and body unchanged.
