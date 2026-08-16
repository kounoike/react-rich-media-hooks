---
id: doc-1
title: Initial Product and Quality Contract
type: specification
created_date: '2026-08-14 23:53'
updated_date: '2026-08-14 23:58'
tags:
  - product
  - quality
  - contract
  - approved
  - decision
---
# Initial Product and Quality Contract

## Status and authority

Approved by the user on 2026-08-15 for TASK-1.1. This contract defines product outcomes and validation hypotheses. It does not select a public API shape, ML model, processing backend, or internal pipeline; those choices require feasibility evidence and, when significant, separate user approval.

## Product intent and target consumers

The first consumers are React product teams building interactive browser experiences around a local camera and microphone. The library is responsible not only for media lifecycle orchestration but also for useful first-party real-time effects.

The initial compatibility hypothesis is:

- React 18.2 and React 19, tested in development Strict Mode.
- Modern evergreen desktop Chrome/Edge, Firefox, and Safari configurations included in a documented release matrix.
- Client-rendered applications and hydrated SSR frameworks. Importing the package must be safe without browser globals; capture and processing operate only in the browser after hydration and explicit user action.
- Mobile browsers inform feasibility testing but are not an initial support guarantee.
- React Native, Node media processing, and legacy browsers are outside the initial compatibility contract.

## Product and composition principles

- The library is headless: application teams own product UI, while the library exposes sufficient state and controls to build it accessibly.
- Media inputs and outputs use browser-standard objects where feasible so processed media can be previewed or handed to application-owned downstream systems.
- Applications select effects, configure semantic controls, and provide assets such as a replacement background image. They are not required to implement segmentation, compositing, face tracking, cropping transforms, or speech denoising.
- The library owns its first-party algorithms and model/runtime integration, capability detection, processing lifecycle, stabilization, cancellation, cleanup, failure isolation, and documented performance envelope.
- The eventual API must support predictable composition of cropping or auto-framing, a background effect, and voice noise reduction without exposing model tensors or requiring knowledge of the internal execution order.
- The library owns resources it acquires or creates and must release them deterministically. Application-owned inputs must have explicit, documented ownership rules.
- Generic arbitrary processor plugins may be explored later but are not required for the first release.

## Prioritized first-release journeys

Every journey below is P0 and release blocking. The ordering expresses dependency and validation sequence rather than optionality.

### 1. Capture and lifecycle foundation

After an explicit user action, an application can request camera and microphone access, render a local preview or audio meter, distinguish pending, active, muted, denied, unavailable, ended, unsupported, and failed states, switch or release a device, retry a recoverable failure, and verify that library-owned tracks and processing resources stop on teardown.

### 2. Manual camera crop

An application can select an arbitrary valid rectangular region of the camera image and configure output dimensions or aspect ratio. The library validates or bounds coordinates, performs the crop, exposes observable output, and handles changes and teardown without orphaned work. The crop-selection UI is application-owned.

### 3. Background blur

An application can enable and configure library-implemented background blur without supplying a segmentation algorithm or model. The user can observe a blurred background with the foreground subject retained, change or bypass the effect, and receive loading, unsupported, degraded, and failed states.

### 4. Background image replacement

An application can provide a supported still-image asset and enable library-implemented background replacement without supplying segmentation or compositing code. The user can observe the foreground composed over the selected image, replace or remove that image, and recover or bypass safely when the asset or processing fails.

### 5. Single-primary-subject auto-framing

The library detects faces locally, deterministically selects and temporally tracks one primary subject, moves a stabilized crop window using configurable framing margin, aspect ratio, and follow behavior, avoids unnecessary subject switching, and reacquires a temporarily lost face. When tracking cannot continue, it falls back smoothly to an application-selected fixed crop or unprocessed framing.

Auto-framing must compose with background blur or replacement. Multi-person group framing and identity recognition are not part of the first release.

### 6. Voice noise reduction

An application can enable, configure, and bypass library-implemented real-time voice noise reduction without supplying a denoising algorithm or model. The user can hear or measure reduced background noise while speech remains intelligible. Suspended audio, unsupported execution, model failure, and processing failure produce diagnosable state and permit safe retry or bypass.

## First-release scope

- Headless React-facing lifecycle, state, and semantic effect controls for all P0 journeys.
- First-party local implementations for foreground segmentation/compositing, face detection and tracking, crop-window stabilization, and voice noise reduction.
- Capability detection, model/runtime loading state, typed failure categories, retry, bypass, cancellation, and deterministic cleanup.
- Optional first-party effect entry points and lazy-loadable model/runtime assets so capture-only consumers do not load unused ML functionality.
- TypeScript declarations and reference experiences that demonstrate every P0 journey, supported combinations, accessible state communication, and recovery behavior.
- A published compatibility, asset-size, quality, and performance matrix limited to configurations supported by release evidence.

## Explicit non-goals

- Prebuilt product UI or a design-system component set.
- WebRTC signaling, calls or rooms, SFU integration, network quality management, or media transport.
- Recording, editing, transcoding, streaming backends, storage, or cloud media processing.
- Video backgrounds in background replacement.
- Face recognition, identity persistence, multi-person group framing, hand or pose tracking, beautification, or automatic camera switching.
- Transcription, speech recognition, speaker identification or separation, and a proprietary echo-cancellation implementation.
- A generic guarantee for arbitrary application-supplied ML models or processor plugins.
- React Native, server-side media processing, legacy browsers, bundled general-purpose polyfills, or exact browser parity.
- First-release guarantees for mobile browsers, every camera/microphone, every codec, or offline model availability.
- Selecting the final public API, ML models, inference runtimes, worker strategy, acceleration backend, or internal order of composed transforms in this contract.

## Quality hypotheses and validation gates

All numeric targets are falsifiable initial hypotheses. Feasibility work must measure them on an agreed reference matrix before they become release claims; failure requires an explicit scope, target, or implementation decision rather than silently weakening the contract.

### Latency and throughput

- Library-originated lifecycle state changes are observable no later than the next applicable React commit.
- Fixed cropping at 720p/30 adds no more than 50 ms p95 source-to-preview latency.
- Single-subject auto-framing combined with one background effect processes at least 24 frames per second at 720p and adds no more than 150 ms p95 source-to-preview latency on reference hardware.
- A continuously visible, supported face is initially acquired or reacquired within 1 second.
- Voice noise reduction adds no more than 40 ms p95 beyond the browser-reported audio baseline and introduces no sustained underruns in the reference scenario.
- After required assets are locally available, warm effect initialization completes within 1 second. Network transfer time for a cold asset fetch is measured separately.

### CPU, memory, and resource lifecycle

- Inactive journeys leave no library-owned live track, AudioContext, animation loop, worker, GPU task, or sustained processing.
- Ten-minute capture, video-effect, auto-framing, and audio-effect runs remain stable rather than showing unbounded CPU or memory growth.
- After warm-up and five start/stop cycles, retained heap attributable to the library returns to within 10% or 5 MiB, whichever is larger, of its inactive post-warm-up baseline.
- CPU ceilings are set only after capture-only and browser baselines are measured on the agreed reference hardware. A supported configuration must sustain its contracted frame/audio rate without thermal or scheduling collapse during the reference run.

### Bundle and asset impact

- Production ESM is tree-shakeable and has no mandatory runtime dependency other than declared React peers.
- A capture-only consumer adds no more than 10 KiB gzip of library JavaScript.
- All first-party effect control/integration JavaScript, excluding separately accounted model and runtime binaries, adds no more than 50 KiB gzip.
- Compressed video ML assets for background processing and face tracking total no more than 15 MiB; compressed voice-noise-reduction model assets total no more than 5 MiB.
- Runtime binaries, model assets, cold-download time, caching behavior, and licenses are reported separately. Unused optional effects do not download or initialize.

### Effect quality

- Background segmentation is evaluated on a representative labeled corpus spanning skin tones, hair, clothing, lighting, motion, occlusion, and common indoor backgrounds. The initial hypothesis is foreground intersection-over-union of at least 0.85, supplemented by human review of boundary stability and temporal flicker.
- Primary-face tracking is evaluated across face entry/exit, rapid movement, partial occlusion, profile views, glasses, masks, low light, multiple visible faces, and no-face periods. Selection must be deterministic, temporally stable, and free from identity inference.
- Voice noise reduction is evaluated with clean speech mixed with stationary and non-stationary noise. The initial hypothesis is at least 6 dB improvement for the agreed noise scenarios without more than 0.03 degradation in the selected intelligibility metric, supplemented by blinded listening review.
- Quality must be compared across relevant demographic and environmental slices; aggregate scores alone are insufficient evidence.

### Privacy and security

- Camera frames, audio, face detections, tracking data, embeddings, and effect outputs remain on device and are neither transmitted nor persisted by default.
- The library includes no telemetry by default. Model/runtime asset retrieval is disclosed and distinguishable from media transfer.
- Media access occurs only in response to explicit application/user action, active state is observable, and library-owned resources are released deterministically.
- Face tracking performs localization only; it does not establish, infer, store, or expose identity.
- Model and runtime sources, integrity approach, licenses, and supply-chain risks are documented before release.

### Accessibility

- The headless contract exposes stable pending, loading-assets, active, bypassed, degraded, muted, denied, unsupported, ended, and failed states plus actionable error categories.
- Reference UI is keyboard operable, announces asynchronous state and error changes, does not rely on color alone, and is audited against WCAG 2.2 AA.
- Tracking and effects can be disabled; reference UI communicates when framing or media output changes automatically.

### Failure recovery

- Permission denial, missing or lost devices, interrupted or suspended audio, unsupported capabilities, asset download/decoding failure, processor exceptions, insufficient performance, rapid remount, and teardown races produce deterministic non-stuck state.
- Recoverable failures permit retry, device/effect replacement, or safe bypass without a page reload.
- Background and tracking failure can fall back to fixed crop or original video; noise-reduction failure can fall back to original audio.
- Unrecoverable cases still preserve cleanup and expose a diagnosable error category.

## Test and evidence strategy

### Pull-request gates

- Unit tests for state machines, ownership, error classification, coordinate bounds, subject-selection policy, smoothing, retry, cancellation, and teardown.
- React integration tests under React 18.2, the React 18 transition release, and current React 19, including Strict Mode remounts, rapid updates, and SSR-safe import/hydration fixtures.
- Controlled media fakes for deterministic permission, device, track, audio, asset-loading, and processor-failure scenarios.
- TypeScript consumer fixtures plus ESM and tree-shaking bundle measurements.

### Browser and release gates

- Real-engine runs in the supported desktop browser matrix using secure contexts and virtual media where deterministic.
- Real-device runs for permission behavior, camera/microphone switching, interruption, acceleration paths, resource cleanup, and output observation.
- Fixed image/video/audio corpora for segmentation, replacement, tracking, denoising, and composed-effect regression.
- Reference-hardware latency, processed-frame-rate, CPU, retained-memory, asset, initialization, and ten-minute endurance measurements.
- Keyboard, screen-reader, automated accessibility, privacy data-flow, and network/telemetry audits.
- Release evidence records browser and hardware versions, inputs, metric definitions, raw results, failures, and any supported degradation.

Mocks alone cannot substantiate browser compatibility, media quality, latency, CPU, memory, or leak claims.

## Alternatives, rationale, and accepted tradeoffs

- A capture-only or consumer-provided-processing MVP would ship sooner but would not deliver the first-party media experience the user requires.
- Bundling every model into the base entry point would simplify loading but penalize capture-only consumers. Optional first-party entry points with lazy assets preserve library ownership while containing bundle cost.
- Cloud effects could reduce device constraints but introduce media transfer, recurring cost, network dependence, and privacy risk. Local processing is the accepted default.
- Multi-person group framing would broaden meeting use cases but adds subject-selection and framing complexity. The initial release guarantees one primary subject.
- Numeric hypotheses may need revision after measurement, but omitting them would give feasibility work no falsifiable target.
- The user explicitly accepts a later initial release in exchange for library-provided background blur, background replacement, voice noise reduction, arbitrary crop, and face-driven auto-framing.

## Open questions and evidence required

- **Processing primitives and fallbacks:** focused prototypes and a Chrome/Edge, Firefox, and Safari capability matrix.
- **Model/runtime selection and licensing:** comparative benchmarks for quality, asset size, latency, CPU/GPU use, memory, CSP deployment, license compatibility, and supply-chain review.
- **Acceleration and portability:** traces comparing available CPU, WASM, WebGL, WebGPU, worker, video, and audio execution paths without presupposing one backend.
- **Public composition and ownership API:** competing API sketches and reference consumers covering standalone effects, combined crop/tracking/background behavior, replacement assets, cancellation, and teardown races.
- **Internal processing order:** visual-quality and performance comparisons for tracking, crop, segmentation, and compositing orders; the public contract must remain semantic.
- **Primary-subject and loss policy:** corpus-based evaluation of deterministic selection, switching resistance, smoothing, reacquisition, and fallback behavior.
- **Effect-quality thresholds:** labeled corpus results, demographic/environment slices, temporal metrics, intelligibility measures, and blinded review.
- **Reference hardware and CPU ceilings:** reproducible capture-only baselines and full-pipeline profiling on agreed low/mid/high desktop tiers.
- **Asset delivery:** consumer fixtures covering self-hosted and packaged/public-path strategies, caching, integrity, offline behavior, and failure recovery.
- **React, SSR, and packaging compatibility:** React/Strict Mode matrix, hydrated framework fixture, server import without browser globals, and package/bundle analysis.
- **Mobile promotion:** real iOS Safari and Android Chrome runs covering permissions, lifecycle, thermals, performance, and effect quality.
- **Accessibility and privacy sufficiency:** audited reference experience, threat model, data-flow review, and automated network checks.

These questions are validation work, not implicit permission to weaken the approved scope or choose a significant public API or architecture without the required evidence and user approval.

## Related task

- TASK-1.1 — Define the initial product and quality contract

## Decision record

Accepted Decision: decision-1 — Adopt the initial product and quality contract.

### Context

The repository previously defined only a broad React real-time-media library direction. It had no agreed target consumer, compatibility boundary, release journeys, first-party effect responsibility, non-goals, or falsifiable quality contract. TASK-1.1 required those choices to be approved before dependent product or architecture work.

### Decision Drivers

- Deliver useful first-party camera and microphone outcomes rather than only low-level consumer-defined processing.
- Make capture, background effects, cropping, face-driven framing, and voice cleanup work together in React applications.
- Preserve privacy through on-device media processing and explicit resource ownership.
- Give feasibility work measurable latency, throughput, resource, bundle, quality, accessibility, and recovery targets.
- Avoid imposing unused ML assets on capture-only consumers.
- Prefer first-release capability completeness over an earlier release date, as explicitly directed by the user.
- Avoid prematurely selecting a public API, model, runtime, or processing backend without evidence.

### Considered Options

1. **Capture-only MVP:** lowest schedule risk, but does not validate or deliver the desired rich-media product.
2. **Consumer-provided processors:** flexible and smaller for the library, but shifts segmentation, tracking, compositing, and denoising responsibility to every application.
3. **First-party effects in one mandatory bundle:** simple installation, but imposes model, runtime, download, parse, and initialization costs on all consumers.
4. **First-party optional effect entry points with lazy assets:** retains library ownership while isolating unused costs and exposing explicit loading/failure states.
5. **Cloud processing:** can reduce device constraints, but conflicts with latency, privacy, offline resilience, and predictable cost.
6. **Single-primary-subject tracking versus group framing:** single-subject tracking provides a bounded, testable initial behavior; group framing substantially increases selection and composition complexity.

### Decision

Adopt the contract in this document. The first release is blocked on capture lifecycle, arbitrary rectangular crop, library-implemented background blur, library-implemented still-image background replacement, library-implemented single-primary-subject face detection and auto-framing, and library-implemented voice noise reduction.

Effects are on-device first-party capabilities delivered through optional entry points and lazy-loadable assets. Applications configure semantic effect behavior and provide assets or fallback choices; they do not implement the required algorithms. The library remains headless and must expose accessible state, deterministic ownership, recovery, bypass, and standards-based media composition.

The initial compatibility hypothesis is React 18.2 and 19 in validated evergreen desktop browser configurations, with SSR-safe import and browser-only media execution. Mobile support is not guaranteed initially.

This decision fixes product outcomes and quality hypotheses, not the final public API, model, runtime, acceleration backend, or internal pipeline. Significant downstream choices remain subject to evidence and user approval.

### Consequences

- The first release will take longer and require broader feasibility, ML quality, browser, performance, accessibility, privacy, licensing, and supply-chain validation.
- The library assumes responsibility for model/runtime lifecycle, effect quality, tracking stability, denoising behavior, graceful degradation, and resource cleanup.
- Package and asset delivery must be modular; model/runtime loading and failure become observable product states.
- Background effects, crop/auto-framing, and audio processing must be tested independently and in supported combinations.
- Exact numeric hypotheses may be revised only through recorded evidence and an explicit decision; they are not guaranteed claims until validated.
- Group framing, identity recognition, video backgrounds, transcription, generic ML plugins, networking, recording, and mobile guarantees remain outside the first release.
- Local media processing and no default telemetry reduce privacy risk but increase client performance and compatibility obligations.

### Related Tasks

- TASK-1.1 — Define the initial product and quality contract
