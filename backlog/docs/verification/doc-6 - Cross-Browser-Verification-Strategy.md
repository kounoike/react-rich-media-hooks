---
id: doc-6
title: Cross-Browser Verification Strategy
type: guide
created_date: '2026-08-19 02:29'
updated_date: '2026-08-19 02:32'
---
# Cross-Browser Verification Strategy

## Status and authority

This document is the provisional verification proposal for TASK-1.6, prepared on 2026-08-19. It translates the accepted initial product and quality contract (decision-1 and doc-1), the browser capability map (TASK-1.2), the lifecycle experiment (TASK-1.3), and the video and audio feasibility reports (TASK-1.4 and TASK-1.5) into a repeatable evidence policy.

The performance budgets, browser support scope, CI cadence, and exception policy below are recommendations for explicit user approval. They do not accept a compatibility, distribution, public API, processing-runtime, worker, acceleration, or architecture decision. Dependent implementation and CI work must not begin until the user approves the applicable proposal. A missing browser or device runner produces an explicit `unknown` result, not an implied pass.

## 1. Verification contract

The strategy must establish four kinds of evidence without conflating them:

- **Correctness:** state, output, error, ownership, and cleanup invariants hold for the documented inputs and transitions.
- **Lifecycle safety:** pending work, tracks, streams, frames, audio contexts, workers, assets, and output handoffs are cancelled or released exactly as required.
- **Compatibility:** the behavior is usable in a named browser build, operating system or device, execution context, security policy, and media configuration.
- **Performance and quality:** latency, continuity, throughput, resource use, startup, media quality, and recovery meet a provisional budget on a named browser/device tier.

Every evidence record includes:

| Field | Required value |
| --- | --- |
| Source | Commit SHA, package version, experiment/report version, and test name |
| Browser | Engine, channel, exact version/build, and launch flags |
| Host | OS/build, device model or VM class, CPU/GPU/RAM, power mode, display or audio output where relevant |
| Context | Top-level or iframe, origin, HTTPS or loopback, Permissions Policy, cross-origin isolation, Window or Worker, visibility state |
| React/runtime | React version, development or production mode, Node and package-manager versions |
| Input | Fixture/corpus ID and hash, resolution/frame rate, sample rate/channel layout, constraints, codec/configuration |
| Measurement | Metric definitions, warm-up, run count, duration, raw events, and analysis version |
| Outcome | `pass`, `fail`, `unknown`, or `blocked`, with fallback and exception IDs where applicable |
| Artifacts | Raw JSON, traces/screenshots/logs, summary, and links to the Backlog task or report |

Interface or constructor presence is only a preflight signal. A path is compatible only after its configuration, output, lifecycle, and fallback behavior pass in the relevant context.

## 2. Test layers and boundaries

| Layer | What it proves | Required coverage | Cadence and gate | What it cannot prove |
| --- | --- | --- | --- | --- |
| Deterministic unit and contract checks | Library-owned state transitions and pure processing contracts are repeatable | Error classification; permission/device states; ownership and idempotent cleanup; cancellation and stale completion; crop bounds; subject-selection and smoothing policy; retry; audio/video format conversion; output contract; SSR-safe import; controlled processor and asset failures | Every pull request and protected branch | Browser implementation behavior, media quality, device permissions, real scheduler or hardware performance |
| Browser integration checks | A real engine can execute the supported path and recover through browser lifecycle transitions | Secure top-level fixture; Permissions Policy iframe fixture; Window and Worker capability/configuration probes; fake or virtual camera/microphone; permission pending/denied; device loss and `devicechange`; mute/ended; hidden/frozen transition; audio suspend/resume; processing overload; output preview/MediaRecorder/WebRTC handoff; cleanup | Chrome and Firefox smoke on every pull request; Edge and Safari periodic smoke; all supported rows at release | Physical device quality, thermal behavior, user-facing accessibility, and hardware acceleration claims |
| Real-device and manual validation | Physical permissions, interruptions, output perception, device diversity, and hardware-dependent behavior are usable | Camera/microphone selection and unplug; OS/browser revocation; headset/speaker route; backgrounding and interruption; acceleration and fallback; ten-minute endurance; thermal or memory pressure; keyboard/screen reader and visual quality review | Release candidate and scheduled reference-device runs; mobile is feasibility/manual only until separately approved | Exhaustive device or browser coverage; a single device cannot represent a browser family |

Deterministic checks own the exhaustive failure matrix. Browser checks must use real browser APIs even when they use virtual media. Manual checks are required for claims that depend on a physical sensor, speaker/headset, OS interruption, GPU/thermal behavior, human perception, or accessibility technology.

## 3. Deterministic fixtures and fault scenarios

### 3.1 Video fixtures

The baseline fixture is a generated 1280x720, 30 fps sequence with a frame index and monotonic source timestamp. Each frame is reproducible from a recorded seed and contains:

- flat and gradient backgrounds for crop-coordinate and color stability;
- a moving foreground shape crossing crop boundaries;
- high-contrast edges and hair-like fine detail for segmentation boundary checks;
- deterministic occlusion, face-entry/exit, profile, low-light, and multiple-subject scenes;
- an original-frame reference and, where needed, an oracle mask or expected crop window.

The fixture manifest records seed, dimensions, frame rate, color space, frame count, expected hashes, and the generated artifact version. Visual quality reports must include boundary, motion, occlusion, lighting, no-subject, and original-frame fallback cases. The fixture is a measurement input, not a production media asset.

### 3.2 Audio fixtures

The browser smoke fixture uses deterministic PCM generated from a recorded seed: silence, single tones, impulses, speech-shaped envelopes, stationary noise, non-stationary bursts, and mixed signal/noise at documented SNR values. Each profile is tested at 44.1 kHz and 48 kHz, mono and stereo, with explicit conversion to the processor format and 10 ms frame boundaries where applicable.

The quality corpus uses licensed or consented speech/noise material described by a manifest and source hash; external audio is not copied into the repository unless licensing permits it. The offline oracle reports SNR or attenuation, the selected intelligibility measure, clipping, correlation or speech error, spectral artifacts, and a blinded listening result where a human-quality claim is made. A deterministic synthetic run cannot substitute for a speech-quality or perceived-quality claim.

### 3.3 Capture and output fixtures

The virtual device fixture exposes a camera and microphone with fixed capabilities, selected settings, stable timestamps, and controllable events. The manifest covers preferred constraints that are not honored, device enumeration before and after permission, shared versus cloned tracks, and borrowed versus library-owned tracks. Output consumers include a local preview and, where supported, MediaRecorder and RTCPeerConnection handoff smoke.

### 3.4 Required permission, device, and failure scenarios

| Scenario | Expected observation | Minimum layer |
| --- | --- | --- |
| Permission prompt remains pending | Explicit pending state; unmount or cancellation leaves no late attachment | Unit plus browser |
| Permission denied or revoked | Typed denied state, cleanup, and retry without reload | Unit plus browser/manual |
| No device or over-constrained device | Typed unavailable/constraint failure and no partial leak | Unit plus browser |
| Secure-context or Permissions Policy denial | Unsupported or denied result identifies the policy boundary; no silent fallback claim | Browser |
| Device unplug, source failure, mute, or ended track | Device list is reconciled; active output becomes diagnosable and retry/replacement is possible | Unit plus browser/manual |
| Rapid remount, Strict Mode probe, overlapping acquire, stale completion | Only the current generation can attach; stale streams/frames are stopped or closed | Unit plus browser |
| Replacement fails after a working stream | Existing working resource remains when policy permits; failed replacement is cleaned | Unit plus browser |
| Hidden, frozen, backgrounded, restored, or terminated page | Processing and output follow the documented lifecycle state; no always-on claim is inferred | Browser/manual |
| Audio suspend, interruption, sample-rate/channel mismatch | State and conversion are observable; no sustained underruns; safe resume or original-audio bypass | Unit plus browser/manual |
| Asset, model, worklet, codec, GPU, or processor failure | Loading/unsupported/degraded/failed state; cancellation prevents late work; original media fallback where supported | Unit plus browser |
| Queue overload, frame drop, late audio quantum, or output backpressure | Bounded queue policy, counters, degradation or bypass, and cleanup are observable | Unit plus browser |
| Output handoff rejection | Original or failed output is not mistaken for a successful handoff; all owned resources are released | Unit plus browser |
| Five start/stop cycles after warm-up | No growing library-owned resources or retained heap beyond the provisional budget | Unit plus browser/device |

## 4. Browser and execution-context matrix

### 4.1 Support hypothesis

The initial compatibility hypothesis remains React 18.2 and React 19 with SSR-safe import and client-only media operations in modern evergreen desktop Chrome, Edge, Firefox, and Safari. Exact minimum browser versions are intentionally not chosen here; TASK-1.8 must turn measured evidence into the approved compatibility contract. Mobile browsers are feasibility inputs and are not an initial support guarantee.

The matrix distinguishes:

- latest stable desktop builds used for continuous detection;
- the eventually approved minimum supported build for each engine;
- Window and Worker contexts for any path that uses them;
- top-level and Permissions Policy iframe fixtures;
- secure loopback/HTTPS and cross-origin-isolated variants where relevant;
- virtual media for deterministic lifecycle checks and physical devices for device/perception claims.

### 4.2 Coverage and cadence proposal

| Row | Example environment | Automated policy | Manual/release policy | Support interpretation |
| --- | --- | --- | --- | --- |
| Chrome desktop | Stable Chrome on the CI Linux image; exact build recorded | Deterministic checks plus secure-loopback Window/Worker and virtual-media smoke on every pull request | Current and approved minimum build on reference desktop at release; physical device run | Required Tier 1 row |
| Firefox desktop | Stable Firefox on the CI Linux image; exact build recorded | Same pull-request smoke and failure matrix where the path is exposed | Current and approved minimum build on reference desktop at release; physical device run | Required Tier 1 row |
| Edge desktop | Stable Edge on a Windows runner; exact build recorded | Nightly or merge-queue smoke, promoted to pull-request coverage when a reliable runner is available | Current and approved minimum build at release, including Windows device behavior | Required Tier 1 row; Chromium similarity is not evidence |
| Safari desktop | Stable Safari on a macOS runner; exact build recorded | Nightly or merge-queue smoke, promoted to pull-request coverage when a reliable runner is available | Current and approved minimum build at release, including macOS interruption/output behavior | Required Tier 1 row; WebKit release notes are not a test result |
| Android Chrome | Exact physical device and Chrome build | Not a pull-request gate initially | Scheduled feasibility run and release-scope review for permissions, backgrounding, thermals, and memory | Tier 2 feasibility; no guarantee initially |
| iOS Safari | Exact physical device and Safari/WebKit build | Not a pull-request gate initially | Scheduled feasibility run and release-scope review for interruption, backgrounding, thermals, and memory | Tier 2 feasibility; no guarantee initially |

Cadence is part of the proposal: pull requests run deterministic checks plus Chrome and Firefox automated smoke; nightly or merge-queue runs cover Edge and Safari; a weekly or browser-refresh run covers every desktop row and the reference hardware; release candidates run every supported desktop row and the required physical-device/manual checklist. If a runner is unavailable, the row is `unknown` and its support claim remains unverified. The exact version pin, refresh window, and whether Edge/Safari move to every pull request require user approval and the later compatibility/CI tasks.

A matrix row is not complete until the result records the exact browser, OS/device, flags, context, fixture, and fallback. A browser may pass capture while remaining unknown for a video or audio processing path.

## 5. Metrics and provisional performance budgets

All budgets in this section are provisional recommendations. They inherit the falsifiable hypotheses in doc-1 and add explicit capture continuity and measurement definitions needed to compare browsers. Permission-prompt time, human device-selection time, and cold asset network transfer are reported separately from processing budgets.

| Path | Provisional recommended budget | Required evidence |
| --- | --- | --- |
| Capture-only video | At 720p/30 after warm-up, at least 30 delivered frames per second and no more than 1% unexpected source-frame loss over the measured run; first usable frame within 500 ms after permission resolution | Source and delivered timestamps, frame/drop counters, acquisition milestones, browser/device baseline, and cleanup |
| Capture-only audio | First usable audio block within 250 ms after permission resolution; no sustained underruns and no more than 0.1% late/missing blocks in the measured run | Track settings, context rate, block timestamps, quantum/underrun counters, interruption state, and cleanup |
| Fixed video crop | At 720p/30, no more than 50 ms p95 source-to-preview latency and sustained 30 fps where the source supplies 30 fps | Marker timestamps at capture, queue, transform, and preview/output; p50/p95 and drop rate |
| Combined video effect | Single-subject auto-framing plus one background effect at 720p sustains at least 24 fps and adds no more than 150 ms p95 source-to-preview latency; initial/reacquisition within 1 second | Per-stage timing, delivered/dropped frames, quality corpus slices, fallback state, and reference-hardware trace |
| Voice noise reduction | Adds no more than 40 ms p95 beyond the browser-reported audio baseline and has no sustained underruns | Capture/context/output timing, rate/channel conversion, late-block and glitch counters, objective quality, and listening evidence |
| Warm effect startup | Within 1 second after required assets are locally available; cold network transfer is a separate metric | Loading milestones, asset size/hash, cache state, browser/device, and failure/bypass result |
| Resource lifecycle | Inactive journeys own no live track, AudioContext, animation loop, worker, GPU task, or sustained processing; after five warm start/stop cycles retained heap returns within 10% or 5 MiB, whichever is larger, of the inactive post-warm-up baseline | Resource inventory before/after, heap/RSS where available, track/context/frame/worker close counts, and repeated-run artifact |
| Bundle and optional assets | Capture-only consumer adds no more than 10 KiB gzip of library JavaScript; effect integration JavaScript adds no more than 50 KiB gzip excluding separately accounted model/runtime binaries; video model assets total no more than 15 MiB and audio model assets no more than 5 MiB | Built consumer fixtures, gzip method, entry points, tree-shaking result, asset hashes, and cold/warm load results |

CPU ceilings are deliberately not assigned before capture-only and browser baselines are measured on agreed low, middle, and high reference desktop tiers. A supported configuration must sustain its contracted frame/audio rate without thermal or scheduling collapse during the reference run. A user-approved revision may choose a different startup, continuity, or resource threshold, but it must preserve the baseline comparison and per-browser/device evidence requirements.

### Measurement definitions

- **Startup:** record permission-requested, permission-resolved, stream-created, first frame/block, processor-ready, first output, and warm-ready milestones. Exclude user prompt duration from processing startup; report cold asset transfer independently.
- **Latency:** use monotonic timestamps and a visible or audible marker. Report source-to-preview/output p50, p95, maximum, and sample count; do not use only browser-reported base latency.
- **Continuity:** count input, delivered, dropped, duplicated, late, and missing video frames; audio quanta, underruns, late blocks, gaps, and timestamp drift. Report source rate and observed rate separately.
- **Resource use:** report CPU utilization or trace, JS heap and RSS where available, GPU/adapter status, queue depth, asset/runtime memory, and retained resources. Headless or software-rendered observations are labeled as such.
- **Quality:** compare output with the deterministic original/oracle and labeled corpus. Report segmentation/crop metrics, SNR or attenuation, intelligibility, clipping, temporal artifacts, and blinded listening or visual review where relevant.
- **Recovery:** inject failure after warm-up and during loading, verify the state transition and fallback, retry or replace, then repeat cleanup. A recovery pass does not erase the original failure from the report.

## 6. Baseline-first regression protocol

Each benchmark run follows this order so that a later optimization is attributable rather than speculative:

1. Pin the commit, package lockfile, browser builds, OS/device, power mode, flags, context headers/policy, fixture hashes, and analysis version. Close unrelated tabs and record unavoidable background load.
2. Run capability and configuration preflight. Distinguish constructor exposure, successful codec/adapter configuration, usable capture settings, and output handoff.
3. Measure the smallest representative capture-only baseline using the same source fixture, output consumer, duration, and browser/device. Capture baseline includes no optional effect and records source timestamps, settings, continuity, startup, CPU/memory, and cleanup.
4. Repeat a no-op/pass-through path to separate browser and transport cost from library bookkeeping. Warm up before measurement; use at least five warm start/stop cycles for retention and at least three independent measured runs for each benchmark profile. Preserve raw per-run data rather than reporting only a mean.
5. Add one stage at a time: capture, frame/audio transfer, format conversion, processing, and output handoff. For video, measure fixed crop before composed effects; for audio, measure pass-through before filter/noise reduction and explicit rate/channel conversion.
6. Run the same profile on each browser/device row. Compare p50/p95, continuity, CPU/memory, startup, quality, and cleanup against that row’s capture-only baseline; never compare browser absolute values without the row baseline.
7. Exercise bounded overload, cancellation, hidden/interrupted state, device loss, and asset/processor failure. Record queue depth and stage timings so a miss can be attributed to capture, transfer, processing, or output handoff.
8. Repeat any miss with a clean environment and unchanged inputs. Classify it as deterministic correctness failure, reproducible budget miss, environment failure, browser-specific failure, or insufficient evidence. Unknown and blocked rows remain visible.
9. Publish raw JSON plus traces and a summary containing the exact environment. A summary must identify the baseline, delta, confidence/run count, fallback, and any exception rather than silently replacing a failed result.

The smallest representative implementation is a measurement boundary, not permission to choose its implementation. Optimization work begins only after a reproducible miss is attributed to a stage and the user approves the targeted follow-up.

## 7. Continuous-integration gates and exceptions

### Pull-request gates

The recommended pull-request gate is:

- lockfile installation and repository quality checks once TASK-1.19 defines them: formatting check, lint, type check, unit/contract tests, build, package-integrity and consumer-fixture checks;
- SSR-safe import and React 18.2/19 integration fixtures, including development Strict Mode, rapid updates, cancellation, retry, and teardown;
- deterministic media fakes covering every permission/device/asset/processor failure in section 3;
- Chrome and Firefox secure-loopback browser smoke with virtual media, capability/configuration probes, lifecycle transitions, output handoff, and cleanup;
- fixture/oracle regression checks for deterministic crop, frame continuity, audio conversion, and failure recovery;
- no mandatory noisy CPU/thermal/perceived-quality threshold on shared pull-request runners.

A pull request fails on deterministic test failure, a known supported-browser smoke failure, a leak/cleanup invariant failure, a changed fixture/hash without review, a package/SSR regression, or a missing required artifact. A browser API that is intentionally absent passes only when the documented fallback is exercised and the result is recorded.

### Periodic and release gates

Nightly or merge-queue checks run Edge and Safari smoke on their native operating systems, plus the supported Chrome/Firefox rows when browser builds or dependencies change. Weekly or browser-refresh checks run the complete desktop matrix and reference-hardware performance profiles. Release candidates require:

- all approved desktop browser rows at the current and approved minimum builds;
- real camera/microphone permission, switching, revocation, interruption, background, and cleanup checks;
- ten-minute capture, video, and audio endurance plus five-cycle retained-resource checks;
- representative visual/audio corpus quality and human review where the quality contract requires it;
- output observation through the supported consumer handoffs;
- accessibility, privacy/no-telemetry, secure-context, Permissions Policy, CSP/offline asset, and package-integrity evidence.

Mobile rows remain manual feasibility evidence and do not block an initial release unless the user later promotes mobile support into the compatibility contract.

### Documented exceptions

| Exception | Allowed handling | Required record |
| --- | --- | --- |
| Runner, browser, device, or provider unavailable | Mark the row `unknown`; retry in the next scheduled window; do not claim support or silently skip a release row | Exact unavailable environment, date, owner, next run, and affected support claim |
| Timing noise on shared CI | Report the measurement only; enforce performance budgets on dedicated reference hardware | Baseline, runner class, variance, and dedicated-run link |
| Known browser feature absent | Exercise the approved fallback; an unsupported optional path may be non-blocking only when fallback correctness passes | Capability probe, browser build, fallback result, and support-scope impact |
| Transient test failure | One bounded retry may distinguish infrastructure noise; a retry cannot convert a deterministic failure into pass | Both raw results, classification, and issue link if quarantined |
| Browser-specific known bug | Keep a version-scoped exception only with a reproducible issue/source, fallback, owner, and expiry | Bug/version range, evidence, workaround, expiry, and approval |
| Hardware acceleration or GPU unavailable | Run the CPU or rendered-output fallback if that fallback is in scope; do not infer accelerated performance | Adapter status, fallback path, measured degradation, and scope |
| Mobile or accessibility lab unavailable | Keep the row pending/manual and block any claim that depends on it | Missing evidence and release decision; no silent promotion |
| Optional cold asset network unavailable | Use locally available assets for warm-path budget and report cold transfer as blocked/unknown | Cache state, asset hash, network condition, and separate cold-path result |

Quarantined tests require an owner, issue, expiry, and replacement evidence. An exception changes the evidence status or support claim; it does not edit the budget to fit a failure.

## 8. Escalation and approval rule

Only a measured, reproducible budget miss or correctness failure creates targeted optimization or remediation follow-up work.

Before filing that work:

1. Confirm the fixture, browser/device row, baseline, run count, and analysis version.
2. Reproduce the miss after one clean rerun and identify the failing stage: capture, transfer/queue, processing, or output handoff.
3. Record the metric delta, raw traces/counters, affected support rows, and whether the documented fallback meets its own contract.
4. Propose the narrowest follow-up with an acceptance criterion tied to that evidence. A broad speculative optimization task is not sufficient.
5. If the remedy changes public API, compatibility scope, distribution, runtime, worker, acceleration, processing order, or product quality, present alternatives and tradeoffs for explicit user approval and create a new Backlog Decision only after approval. Do not rewrite decision-1.

Speculative optimization, technology selection, and architecture commitments remain out of scope while the baseline is still unmeasured or while a result is merely a constructor-exposure hypothesis. A correct but unsupported row is reported as unsupported/unknown and handled through the compatibility decision process rather than hidden by a fallback.

## 9. Alternatives and provisional approval choices

The following policies are intentionally presented as alternatives:

| Policy | Coverage | Tradeoff |
| --- | --- | --- |
| **Balanced recommendation** | Deterministic plus Chrome/Firefox smoke on every pull request; Edge/Safari nightly or merge-queue; all four desktop engines and reference devices at release; mobile manual feasibility | Good feedback speed and meaningful engine coverage, but requires native runners before release |
| Broad per-pull-request coverage | All four desktop engines on every pull request plus selected physical-device checks | Shorter detection time and stronger compatibility confidence; higher runner cost, queue time, flake handling, and maintenance |
| Lean automation with release emphasis | Deterministic plus Chrome/Firefox on pull requests; all four desktop engines in scheduled/manual release checks; no native runner requirement for every merge | Lower CI cost and simpler maintenance; browser regressions may remain undetected longer |

The balanced recommendation is not accepted policy. The user must explicitly approve, revise, or reject:

- the supported desktop browser scope and whether mobile remains feasibility-only;
- the provisional capture, video, audio, resource, bundle, and asset budgets;
- pull-request, periodic, weekly, and release/manual cadence;
- the documented exception and quarantine rules;
- the reference hardware/device tiers and exact minimum browser versions.

Until that approval is recorded, TASK-1.20 may consume this proposal as input but must not implement dependent CI or compatibility gates, and no production optimization or architecture work may rely on it.

## Evidence sources and related work

- Accepted product and quality contract: decision-1 and doc-1.
- Browser capabilities and support risks: TASK-1.2.
- Capture lifecycle experiment: TASK-1.3 and doc-4.
- Browser video feasibility: TASK-1.4 and the video feasibility report in doc-5.
- Browser audio feasibility: TASK-1.5 and the audio feasibility report in doc-5.
- Output and transport interoperability: TASK-1.17 and doc-3.
- Follow-up CI work: TASK-1.19 and TASK-1.20.
- Compatibility/distribution contract: TASK-1.8.
- Primary specifications and vendor evidence are linked in TASK-1.2 and the feasibility reports; this strategy does not promote interface presence into a browser support claim.
