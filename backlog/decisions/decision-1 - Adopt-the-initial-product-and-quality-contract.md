---
id: decision-1
title: Adopt the initial product and quality contract
date: '2026-08-14 23:55'
status: accepted
---
## Context

The repository needed an explicit, user-approved product and quality contract before dependent browser feasibility and implementation work. The contract had to define target React/browser consumers, release-blocking media journeys, application and library responsibilities, non-goals, measurable quality hypotheses, and evidence required for later feasibility decisions. Backlog CLI 1.50.1 created this accepted Decision as an empty body skeleton; this user-approved restorative fill records the already accepted rationale without changing its metadata or meaning. The canonical specification remains doc-1.


## Decision Drivers

- Validate the library proposition across capture, video, and audio media journeys before selecting implementation details.
- Keep the first release headless, SSR-safe at import time, client-only for media operations, and composable with standards-based media objects.
- Make the library responsible for first-party effects, lifecycle, capability detection, failure recovery, and deterministic cleanup while applications own UI and supplied assets.
- Keep compatibility and quality claims falsifiable through an explicit browser matrix, performance hypotheses, privacy boundary, accessibility states, and recovery evidence.
- Protect schedule and supportability by excluding networking, product UI, legacy/mobile guarantees, identity recognition, and unrelated media-platform scope.

## Considered Options

1. **Focused composable release covering all approved P0 journeys.** Accepted because it validates capture, crop, first-party background effects, single-primary-subject auto-framing, and voice noise reduction while keeping non-goals explicit.
2. **Capture-only MVP.** Rejected because it would not validate the differentiating video/audio and first-party effect proposition.
3. **Broad media platform or mobile-first release.** Rejected because it multiplies compatibility, performance, UX, and support risk before the core contract is validated.
4. **Defer numeric quality hypotheses.** Rejected because feasibility work needs falsifiable provisional targets; targets remain hypotheses until measured.

## Decision

Adopt the user-approved Initial Product and Quality Contract in doc-1 for TASK-1.1.

The initial consumers are React teams building local camera and microphone experiences, with React 18.2/19 and modern evergreen desktop Chrome/Edge, Firefox, and Safari as the initial compatibility hypothesis. Package import must be safe for hydrated SSR applications; media acquisition and processing occur only in the browser after hydration and explicit user action. Mobile browsers inform feasibility but are not an initial support guarantee.

Every following journey is P0 and release blocking: capture and lifecycle foundation; application-selected arbitrary camera crop; library-implemented background blur; library-implemented still-image replacement; local single-primary-subject face detection, stabilized tracking, and auto-framing with fixed-crop fallback; and library-implemented voice noise reduction. The library owns first-party algorithms/runtime integration, capability detection, loading, cancellation, failure isolation, stabilization, and cleanup. Applications own product UI and provide semantic configuration and assets such as a replacement image.

The first release is headless and TypeScript-oriented, uses standards-based media inputs/outputs where feasible, supports typed state and failure recovery, and lazy-loads optional effect assets. It excludes prebuilt UI, WebRTC/network transport, recording/editing/transcoding/storage, video backgrounds, recognition and group framing, generic arbitrary ML guarantees, React Native, server-side media processing, legacy browsers, exact browser parity, and first-release mobile/offline guarantees. The contract does not select the final public API, model, runtime, worker strategy, acceleration backend, or transform order; those require feasibility evidence and explicit approval when material.

Quality gates are provisional and falsifiable: lifecycle state must be observable by the next React commit; fixed crop and combined-effect latency, frame/audio rates, warm initialization, CPU/memory stability, retained heap, bundle and model-asset budgets, no-default-telemetry privacy, accessible state/error surfaces, and deterministic failure recovery must be measured on an agreed reference matrix before becoming release claims.


## Consequences

Dependent feasibility tasks have a concrete target and evidence checklist, while implementation teams retain freedom to choose APIs and processing backends until measured evidence and user approval support those choices. The scope deliberately accepts a later initial release and the cost of first-party effect/runtime validation in exchange for validating the complete local-media proposition. Optional assets and explicit non-goals limit capture-only cost and support risk, but browser capability gaps, model quality, performance, and mobile promotion remain open validation work.

## Related Tasks

- TASK-1.1 — Define and approve this initial product and quality contract.
- TASK-1.2 — Map browser media capabilities and support risks against the contract.
- TASK-1.3 through TASK-1.23 — Dependent feasibility, API, package, quality, release, and maintenance work must use this contract as the product boundary.
