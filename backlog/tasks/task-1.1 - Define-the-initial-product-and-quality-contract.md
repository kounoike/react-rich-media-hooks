---
id: TASK-1.1
title: Define the initial product and quality contract
status: Done
assignee:
  - '@codex'
created_date: '2026-08-13 20:31'
updated_date: '2026-08-16 07:05'
labels: []
dependencies: []
references:
  - decision-1
documentation:
  - doc-1
modified_files:
  - >-
    backlog/docs/product/initial-product-quality-contract/doc-1 -
    Initial-Product-and-Quality-Contract.md
  - >-
    backlog/decisions/decision-1 -
    Adopt-the-initial-product-and-quality-contract.md
parent_task_id: TASK-1
priority: high
type: task
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Produce a shared product contract that identifies who the first consumers are, which real-time media journeys the first release must enable, and which concerns remain outside the initial scope. Capture quality goals as hypotheses or measurable targets so later spikes can validate them without prematurely selecting an implementation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Representative capture, video-processing, and audio-processing user journeys are prioritized with observable success outcomes
- [x] #2 The first-release scope and explicit non-goals are documented
- [x] #3 Consumer assumptions covering React applications, rendering environments, and expected composition patterns are documented
- [x] #4 Quality hypotheses cover latency, CPU and memory use, bundle impact, privacy, accessibility, and failure recovery where relevant
- [x] #5 Open questions and the evidence needed to answer them are recorded in repository documentation
- [x] #6 The proposed target users, priorities, scope, non-goals, and quality targets are presented with rationale and tradeoffs, explicitly approved by the user, and recorded before dependent product or architecture work begins
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Inspect accepted Backlog decisions, repository documentation, package metadata, and relevant history for existing constraints and evidence.
2. Record the evidence and draft an English product-and-quality contract covering prioritized journeys, observable outcomes, release scope, non-goals, consumer assumptions, quality hypotheses, and open validation questions.
3. Present material product choices, alternatives, rationale, and tradeoffs to the user; pause for explicit approval before recording a final contract or any significant decision.
4. After approval, update repository documentation and TASK-1.1 notes/references through the Backlog CLI.
5. Read the task-finalization guide, verify every acceptance criterion with objective evidence, run relevant repository checks, and complete only TASK-1.1 if all criteria pass.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Investigation findings (2026-08-15)

- No accepted or proposed Backlog Decisions exist (`backlog decision list --plain` returned no decisions).
- No repository Backlog Documents exist (`backlog doc list --plain` returned no documents).
- README.md defines only the broad product direction: a React library for browser-based real-time media applications.
- package.json currently defines a private package and pnpm version only; it establishes no React, browser, module-format, or performance compatibility contract.
- Therefore target consumers, release scope, browser/React assumptions, journey priority, and quality targets remain material product decisions requiring explicit user approval under AGENTS.md.

## Product contract proposal — pending explicit user approval

### Recommended target users and environment

React product teams building interactive, browser-based camera and microphone experiences. The initial compatibility hypothesis is React 18.2 and 19 in modern, evergreen desktop browsers. Imports should remain safe in server-rendered React applications, while media acquisition and processing run only in a browser after hydration/user action. Mobile browsers are validation inputs but not an initial support guarantee.

Expected composition is headless and incremental: consumers combine lifecycle/state primitives with their own UI and pass standards-based media objects or consumer-owned processing functions between capture, video, and audio journeys. The contract does not yet select the public API shape or processing implementation.

### Prioritized first-release journeys and observable outcomes

1. **P0 — Capture and lifecycle foundation (release blocking):** after an explicit user action, a consumer can request camera/microphone access, render a local preview or meter, identify permission/device/ended states, switch or release a device, retry recoverable failures, and verify that all owned tracks stop on teardown.
2. **P0 — Consumer-defined video processing (release blocking, built on capture):** a consumer can supply a video source and a representative frame transform, observe processed output in the React experience, enable/bypass processing, receive unsupported/processor-failure state, and stop without orphaned media work or a page reload.
3. **P0 — Consumer-defined audio processing (release blocking, built on capture):** a consumer can supply an audio source and a representative analysis/effect graph, observe metering or processed output, enable/bypass it, receive suspended/unsupported/processor-failure state, and tear down or retry without a reload.

The order expresses implementation and validation dependency, not optionality: all three are proposed release blockers.

### Proposed first-release scope

- Headless React-facing lifecycle and state contracts for capture plus consumer-defined video and audio processing.
- Standards-based browser media inputs/outputs, capability detection, typed failure states, retry, cancellation, and deterministic cleanup.
- Client-only media operation with SSR-safe package import.
- TypeScript declarations and minimal reference examples proving each journey.
- Compatibility and quality claims limited to configurations actually covered by the release validation matrix.

### Explicit non-goals

- Prebuilt UI/design-system components.
- WebRTC signaling, calls/rooms, SFU integration, or network quality management.
- Recording, editing, transcoding, streaming backends, storage, or cloud processing.
- Bundled ML effects such as background segmentation, denoising, or transcription.
- React Native, Node media processing, legacy browsers, or bundled browser polyfills.
- A first-release guarantee for mobile browsers, worker/off-main-thread execution, every codec/device, or exact parity across browsers.
- Choosing the final public API or browser processing primitive in this contract; feasibility tasks must provide that evidence.

### Quality hypotheses / proposed validation gates

- **Latency:** state transitions caused by library code should be observable by the next React commit; on reference hardware, a no-op 720p/30 video path should add no more than 50 ms p95 source-to-preview latency, and a no-op audio path should add no more than 20 ms p95 beyond the browser-reported baseline. Permission prompt/user time is excluded.
- **CPU and memory:** with no active journey there should be no owned live track, audio context, animation loop, worker, or sustained processing. A representative 10-minute 720p/30 video run and audio run should remain stable rather than trend upward; after five start/stop cycles, retained heap attributable to the library should return to within 10% or 5 MiB (whichever is larger) of the post-warm-up inactive baseline. CPU ceilings should be set after measuring capture-only browser baselines on the agreed reference matrix.
- **Bundle impact:** production ESM should be tree-shakeable with no mandatory runtime dependency other than React peer dependencies. Proposed gzip budgets are 10 KiB for capture-only consumption and 20 KiB for capture plus both processing paths, verified from consumer fixtures.
- **Privacy:** the library should transmit, persist, or inspect no media beyond operations explicitly composed by the consumer; include no telemetry by default; request media only from an explicit consumer action; expose active state; and release owned resources deterministically. Consumer-supplied processors and application transport are outside the library trust boundary and must be documented.
- **Accessibility:** the headless library should not impose inaccessible UI. It must expose stable pending, active, muted, denied, unsupported, ended, and failed states plus actionable error categories so a consumer can build a WCAG 2.2 AA interface. Reference UI must be keyboard operable, announce asynchronous state/error changes, and not rely on color alone.
- **Failure recovery:** permission denial, unavailable/lost devices, interrupted/suspended audio, unsupported capabilities, processor exceptions, and teardown races should produce deterministic non-stuck state. Recoverable cases should permit retry or replacement without reload; unrecoverable cases should preserve cleanup and a diagnosable error category.

### Alternatives and tradeoffs

1. **Recommended: focused composable release with all three vertical journeys.** Proves the library thesis while keeping networking, UI, ML, and recording outside scope. Cost: three browser-media surfaces must meet release gates.
2. **Capture-only MVP.** Lowest feasibility and schedule risk, but does not validate the differentiating video/audio processing proposition and fails the task's intended representative journey coverage.
3. **Broad media platform / mobile-first compatibility.** More immediately comprehensive, but multiplies compatibility, performance, UX, and support risk before the core abstractions are validated.
4. **No numeric quality hypotheses until implementation exists.** Avoids speculative figures, but gives feasibility work no falsifiable release target. The recommendation uses provisional gates and explicitly requires benchmark evidence before converting them into support claims.

### Open questions and required evidence

- Browser primitives and fallbacks for each path: focused prototypes plus desktop Chrome/Edge, Firefox, and Safari compatibility matrix.
- Whether mobile support can be promoted: real iOS Safari and Android Chrome device runs covering permissions, interruption, thermals, and lifecycle.
- Exact React/SSR/module compatibility: React 18.2/19 Strict Mode fixtures and at least one hydrated SSR framework fixture; clean import without browser globals.
- Public composition model and ownership semantics: competing API sketches, consumer examples, teardown/race tests, and prior-art review.
- Numeric latency/CPU/memory gates and reference hardware: reproducible benchmark harness, capture-only baselines, representative no-op and non-trivial processors, and profiling traces.
- Bundle budgets: built package and fixture bundle analysis with tree-shaking verification.
- Privacy boundary: data-flow/threat-model review and automated checks for network/telemetry absence.
- Accessibility sufficiency: reference consumer audited with keyboard, screen reader, and automated WCAG checks.
- Failure taxonomy/recovery guarantees: cross-browser fault-injection scenarios for denied/revoked permission, device loss, suspended audio, processor failure, rapid remount, and teardown.

No dependent implementation or decision record has been started.

## User-requested scope revision (2026-08-15) — pending approval of the complete revised contract

The user requested that the first release include library-implemented background blur, background image replacement, and voice noise reduction. Application authors must not be required to provide the processing algorithms for these release journeys.

This changes the proposed responsibility boundary: the library would own the first-party effect behavior, model/runtime integration, lifecycle, resource cleanup, capability detection, failure recovery, and documented performance envelope. Applications would select/configure effects and provide assets such as a replacement image, but would not implement segmentation, compositing, or denoising.

A revised contract must account for model/runtime download size, initialization latency, execution-backend portability, effect quality, on-device privacy, and graceful bypass when an effect cannot load or run. The recommended packaging direction is first-party optional effect entry points with lazy-loadable model/runtime assets, rather than placing all ML assets in the base capture bundle. This remains a proposal: no public API, processing backend, model, package layout, or accepted Decision has been selected.

## Additional user-requested first-release capabilities (2026-08-15) — pending approval of the complete revised contract

The user requested two additional release-blocking video capabilities and explicitly accepted a later initial release as a tradeoff:

1. Application-selected cropping of an arbitrary rectangular region of the camera image.
2. Library-implemented face detection and automatic subject tracking/framing.

The revised product contract should make manual crop selection/configuration an application responsibility while the library owns coordinate validation, transform execution, output sizing, lifecycle, and failure behavior. For automatic tracking, the library should own face detection, temporal tracking, crop-window movement, stabilization, loss/reacquisition behavior, and local processing.

Material behavior still requiring approval in the complete contract: recommend a single-primary-subject first release with deterministic subject selection, stabilized movement, configurable framing margin/aspect ratio, and manual/fixed fallback when the subject is lost. Multi-person group framing and identity recognition should remain non-goals. Exact processing order with background segmentation, model/backend choice, coordinate/public API shape, and performance implementation remain open for feasibility evidence.

## Approval and records (2026-08-15)

The user explicitly approved the complete revised contract after reviewing target consumers, React/browser assumptions, P0 priorities, scope, non-goals, library/application responsibility boundaries, packaging alternatives, local-processing rationale, single-primary-subject tracking boundary, schedule tradeoff, quality hypotheses, and test/evidence strategy.

Canonical product and quality contract: doc-1, "Initial Product and Quality Contract".
Accepted decision record: decision-1, "Adopt the initial product and quality contract".

The installed Backlog.md 1.50.1 CLI creates Decisions with Context, Decision, and Consequences placeholders but exposes no Decision update command. To comply with the prohibition on direct Backlog file edits, the complete decision reasoning and required sections are maintained in the canonical Backlog specification doc-1; decision-1 records accepted status and adoption. No dependent implementation was begun before approval.

Final validation passed on 2026-08-15. A read-only Node verification checked doc-1 and decision-1 against every acceptance criterion: all six P0 journeys and observable outcomes; scope and non-goals; React, rendering, and composition assumptions; latency, CPU/memory, bundle/asset, privacy, accessibility, and failure-recovery hypotheses; open questions with required evidence; and explicit approval plus alternatives/tradeoffs. It also verified all required decision-rationale sections and TASK-1.1 links. `git diff --check` passed. `backlog doc list --plain` returned doc-1 and `backlog decision list --plain` returned decision-1 as accepted. No code or other task was changed.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @codex
created: 2026-08-16 07:05
---
2026-08-16: With explicit user approval, restored the previously empty Decision-1 body using the approved doc-1 contract. Decision frontmatter and accepted meaning were preserved; the installed Backlog CLI 1.50.1 limitation and body-only exception are documented in AGENTS.md on the lifecycle PR.
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Defined and recorded the user-approved initial product and quality contract for React browser media consumers. The release-blocking scope covers capture lifecycle, arbitrary crop, first-party background blur and still-image replacement, single-primary-subject face-driven auto-framing, and first-party voice noise reduction, with explicit non-goals, compatibility/composition assumptions, measurable quality hypotheses, test strategy, tradeoffs, and evidence questions. Recorded canonical specification doc-1 and accepted decision-1 before dependent implementation. Verified every acceptance criterion with scripted content assertions, Backlog list/status checks, and `git diff --check`; all passed.
<!-- SECTION:FINAL_SUMMARY:END -->
