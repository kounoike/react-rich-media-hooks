# Shared processing health and statistics — owner-review proposal

Status: **PROPOSED ONLY**, TASK-4. This document specifies a candidate contract,
not an available API, an accepted Decision, or permission to implement it.
Approval of this documentation does not approve its public names, defaults,
measurement policy, thresholds, or release support. No production source,
exports, dependencies, benchmarks, existing Decisions or acceptance limits change.

Preparation update (2026-11-22): the owner approved the observer/statistics design
direction and selected implementation preparation, conveyed by coordinator
message `msg_8341cf409cef` in TASK-4. Section 10 records the work breakdown and
adoption boundary. Exact public declarations, measurement/default policies and
any numerical/support revision remain proposals; this document does not adopt
an accepted Decision or authorize production implementation.

## 1. Evidence and existing authority

The mainline audit is pinned to `5c81f030d73a0d688bb41bdf92e9e7e9e16df02c`.
Audio candidate evidence is pinned to the separate, unmerged
[`f92bd88de5374d96991bd509b31c5f04fbbd5d24`](https://github.com/kounoike/react-rich-media-hooks/commit/f92bd88de5374d96991bd509b31c5f04fbbd5d24).
Audio files and Decisions 8–12 below are evidence links, not files imported into
this branch or claims about the mainline package.

| Authority / evidence | Existing behavior and boundary | Gap / compatibility risk |
| --- | --- | --- |
| [Decision-1](<../backlog/decisions/decision-1 - Adopt-the-initial-product-and-quality-contract.md>) and [product contract](<../backlog/docs/product/initial-product-quality-contract/doc-1 - Initial-Product-and-Quality-Contract.md>) | Lifecycle observable by the next applicable React commit; audio added p95 <=40 ms beyond browser-reported baseline, no sustained underruns; >=6 dB noise attenuation and <=0.03 intelligibility loss; local processing and no default telemetry | Processing time, notification delay, and user-perceived media delay are different quantities. None can silently replace a quality gate |
| [Decision-2](<../backlog/decisions/decision-2 - Accept-the-public-API-and-resource-lifecycle-contract.md>) and [API contract](<../backlog/docs/api/doc-6 - Public-API-and-Resource-Lifecycle-Contract.md>) | Framework-neutral session owns resources; independent audio/video domains; standard current outputs and visible replacement; original-media fallback by default; explicit cancellation; SSR-safe imports and inert construction | Diagnostic shape is left reviewable, not finalized. Adding a statistics store or discriminants is a public-contract review |
| [Core](../src/core/index.ts), [React adapter](../src/react/index.ts), [README](../README.md) at the mainline pin | `ProcessorStatus` is `off/loading/active/bypassed/degraded/unsupported/failed`; processor snapshots contain status and effect names. Immutable `MediaSnapshot`, synchronous `subscribe`, stable server snapshot, `lastTransition.reason?: string`; tagged operation results. Hooks use `useSyncExternalStore` | No public statistics API, per-effect typed reasons, health scope, counter epoch, or measurement availability. One last transition and one session error cannot describe concurrent domain histories. Existing reasons must not be parsed as a stable protocol |
| [Mainline audio factory](../src/effects/audio/index.ts) and core | `noiseReduction()` describes an effect; mainline `setAudioEffects()` returns unsupported | A factory export does not establish working audio processing or support |
| [TASK-1.11](<../backlog/tasks/task-1.11 - Deliver-a-composable-video-processing-vertical-slice.md>), [Decision-7](<../backlog/decisions/decision-7 - Adopt-the-fixed-camera-crop-and-cross-browser-verification-baseline.md>), [crop runtime](../src/effects/video/runtime.ts) | Fixed 1280×720/30 crop; add/update/bypass/remove; original video on unsupported/failure/overload, unrelated audio preserved. Guard: two consecutive >=2-second windows below 95% of source rate, when source rate >=29 fps | Guard is a fallback heuristic, not the 30 fps acceptance rule. `presentedFrames` gaps observe video-element presentation, not all camera losses; synchronous draw time excludes deferred GPU work |
| [Video benchmark](video-crop-benchmark.md), [throughput report](video-crop-throughput.md), [verification contract](<../backlog/docs/verification/doc-6 - Cross-Browser-Verification-Strategy.md>) | Capture-only, no-op and crop stages; source-to-preview and later callback-to-preview protocols have different endpoints. Corrected marker probe is benchmark-only, in a separate six-second window, >=20 matched samples. Exact camera losses may remain unknown | FPS differences, callback gaps, optical markers and processing time are not interchangeable metrics. Old results keep their original endpoint/protocol IDs |
| [Audio lifecycle](https://github.com/kounoike/react-rich-media-hooks/blob/f92bd88de5374d96991bd509b31c5f04fbbd5d24/docs/audio-processing.md), [runtime](https://github.com/kounoike/react-rich-media-hooks/blob/f92bd88de5374d96991bd509b31c5f04fbbd5d24/src/effects/audio/runtime.ts), [Worklet](https://github.com/kounoike/react-rich-media-hooks/blob/f92bd88de5374d96991bd509b31c5f04fbbd5d24/src/effects/audio/noise-worklet.ts) | Candidate 48 kHz mono RNNoise; original until ready; bounded startup; overload on two consecutive native frame calls exceeding the current render-quantum budget. Private `getMetrics()` keeps at most 1,000 native frame times and reports p50/p95/max | A 480-sample model frame is not a render quantum or an end-to-end sample. Native time is not whole callback time. Guard cannot observe every missed deadline. Private bounded frame count is not lifetime processed count |
| [Decision-11](https://github.com/kounoike/react-rich-media-hooks/blob/f92bd88de5374d96991bd509b31c5f04fbbd5d24/backlog/decisions/decision-11%20-%20Adopt-a-private-feature-gated-raw-audio-Worker-route-with-unchanged-C-RNNoise.md), [raw runtime](https://github.com/kounoike/react-rich-media-hooks/blob/f92bd88de5374d96991bd509b31c5f04fbbd5d24/src/effects/audio/raw-audio-runtime.ts), [pump](https://github.com/kounoike/react-rich-media-hooks/blob/f92bd88de5374d96991bd509b31c5f04fbbd5d24/src/effects/audio/raw-audio-pump.ts) | Private default-off C Worker route; eligible inputs only, Worklet otherwise; bounded writes, 100 ms progress/stall faults, sample totals and source-clock drift diagnostics | Worker write completion does not prove playback; source timestamp jitter does not prove lost PCM. Route eligibility fallback is not an effect failure or a public backend selector |
| [Decision-12](https://github.com/kounoike/react-rich-media-hooks/blob/f92bd88de5374d96991bd509b31c5f04fbbd5d24/backlog/decisions/decision-12%20-%20Qualify-audio-latency-targets-through-approved-scenarios-and-baseline-evidence.md), [latency provenance](https://github.com/kounoike/react-rich-media-hooks/blob/f92bd88de5374d96991bd509b31c5f04fbbd5d24/docs/measurements/audio/latency-target-provenance.md) | Proposed scenario/metric/protocol qualification before a numerical decision; existing 40 ms gate and audio AC3 remain open. Legacy added lag subtracts same-trial original median, not `baseLatency` | A proposed paired estimator is a different estimand. Recent embedding probes and fallback-only trials cannot qualify support, quality, or continuity |

Decisions were searched before this proposal. Decision-2 governs the retained
ownership/lifecycle semantics; Decision-12 is a **proposed** audio measurement
prerequisite, not authority to replace a metric or number. This documentation PR
changes no accepted Decision and supersedes none. The implementation-preparation
approval is recorded above; before dependent public implementation, freeze its
exact adoption boundary and record the approved choice in a new accepted
Decision through Backlog. Name any exact clauses it supersedes and preserve
accepted history.

## 2. Review alternatives and recommendations

| Owner choice | Alternatives and tradeoffs | Recommended proposal, pending approval |
| --- | --- | --- |
| Public surface | Add statistics to `MediaSnapshot`: convenient, but every telemetry tick can rerender all session consumers and expand snapshot compatibility. Separate opt-in observer: more setup, isolates measurement cost/frequency. App-only benchmark utilities: cheapest library surface, cannot expose runtime continuity consistently | Separate optional observer tied to an existing session, alongside unchanged lifecycle subscriptions; no observer owns media |
| Shared vocabulary | One scalar health/latency score hides endpoint and availability differences. Completely separate audio/video APIs duplicate lifecycle rules | Shared status, envelope, availability, counters and units; discriminated audio/video measurements and typed reasons |
| Delivery | Every frame callback is precise but increases allocation/React load. Polling only can miss fallback transitions. Latest immutable store with immediate lifecycle invalidation and bounded periodic statistics is scalable but not an audit log | Immediate state/output visibility; coalesced statistics; explicit sequence/counter evidence of intermediate events |
| Policy and defaults | Always-on collection makes dashboards easy but adds timing/privacy/cost. Default-off requires explicit activation. A universal warning threshold is easy to explain but conflates native compute and output delay | Statistics default off; opt-in coarse aggregate collection; threshold policies scoped to named metrics, no new universal numeric warning or pass rule |
| Baseline | Subtract API latency: cheap but wrong endpoints. Legacy original median: preserves historical comparisons. Paired controlled reference: stronger design, requires validated pairing/clock/uncertainty and owner-approved scenarios | Retain legacy results separately; paired proposal awaits Decision-12 process approval; runtime endpoint unavailable unless actually measurable |

Owner review must settle the observer API/placement, vocabulary and compatibility
policy, collection budget and retention, cadence/window/hysteresis defaults,
warning policies and their evaluated scope. Decision-12 additionally needs
scenario, consumer, reference matrix and measurement-protocol choices; it does
not yet select a new numerical target. These are independent of approval to
merge a documentation-only spike. No owner approval is inferred from silence.

## 3. Candidate typed model

The following TypeScript is documentation-only. Names are provisional, there
are no corresponding package imports, and it adds no backend/plugin API.
`ProcessorStatus` below mirrors the existing union without extending it.

```ts
type MediaKind = "audio" | "video";
type ProcessorStatus =
  | "off" | "loading" | "active" | "bypassed"
  | "degraded" | "unsupported" | "failed";
type Route = "none" | "original" | "processed";
type UnavailableReason =
  | "disabled" | "unsupported" | "not-instrumented" | "not-applicable"
  | "warming-up" | "insufficient-samples" | "clock-unmapped"
  | "baseline-missing" | "baseline-mismatch" | "interrupted" | "capacity-exceeded";
type Measure<T> =
  | { readonly availability: "available"; readonly value: T; readonly methodId: string }
  | { readonly availability: "unavailable"; readonly reason: UnavailableReason };
type CommonReason = {
  readonly scope: "common";
  readonly code:
    | "no-effect" | "requested" | "ready" | "explicit-bypass" | "removed"
    | "cancelled" | "superseded" | "retry-requested" | "recovered"
    | "input-ended" | "stopped" | "disposed" | "capability-missing"
    | "asset-unavailable" | "processor-fault" | "telemetry-stale";
};
type AudioReason = {
  readonly scope: "audio.noise-reduction";
  readonly code:
    | "native-frame-budget" | "callback-deadline" | "output-latency"
    | "missing-input-block" | "context-interrupted" | "startup-timeout"
    | "worker-stalled" | "source-clock-discontinuity";
};
type VideoReason = {
  readonly scope: "video.crop";
  readonly code:
    | "source-rate" | "processing-budget" | "output-latency"
    | "frame-discarded" | "stale-output" | "draw-failed";
};
interface ReasonByKind {
  readonly audio: CommonReason | AudioReason;
  readonly video: CommonReason | VideoReason;
}
interface Health<K extends MediaKind> {
  readonly kind: K;
  readonly generation: number; // processor configuration attempt, not device identity
  readonly status: ProcessorStatus;
  readonly route: Route;
  readonly assessment: "not-evaluated" | "healthy" | "degraded";
  readonly evaluatedMetricIds: readonly string[];
  readonly reason: ReasonByKind[K];
  readonly recovery: "none" | "requested" | "verifying" | "recovered";
  readonly transitionSequence: number;
}
interface Window {
  readonly startMs: number; // session-relative monotonic time
  readonly endMs: number;   // half-open [start, end)
  readonly activeMs: number;
  readonly attempted: number;
  readonly accepted: number;
  readonly excluded: number;
  readonly exclusions: Readonly<Record<string, number>>;
  readonly complete: boolean;
  readonly coverage: "complete" | "partial" | "unknown";
}
interface Quantiles {
  readonly p50Ms: number;
  readonly p95Ms: number;
  readonly p99Ms: number;
  readonly maxMs: number;
}
interface Distribution {
  readonly metricId: string; // versioned endpoints + estimator, never just "latency"
  readonly methodId: string; // provenance retained even when quantiles are unavailable
  readonly sampleUnit: "model-frame" | "render-quantum" | "video-frame" | "matched-frame" | "correlation-window";
  readonly clock: "local-monotonic" | "audio-sample" | "mapped-media" | "unmapped";
  readonly window: Window;
  readonly quantiles: Measure<Quantiles>;
  readonly timerResolutionMs: Measure<number>;
  readonly uncertaintyMs: Measure<number>;
}
interface LatencyComparison {
  readonly processed: Distribution;
  readonly baseline: Distribution;
  readonly added: Distribution;
  readonly baselineId: string | null; // ephemeral trial reference, no device ID
  readonly estimator: "legacy-original-median-v1" | "paired-window-delta-v1";
}
interface Counter {
  readonly window: number;
  readonly sinceEnabled: number;
}
interface CommonCounters<K extends MediaKind> {
  readonly overloadEpisodes: Counter;
  readonly fallbackEntries: Counter;
  readonly recoveryAttempts: Counter;
  readonly successfulRecoveries: Counter;
  readonly measurementSamplesOmitted: Counter;
  readonly episodesByReason: readonly {
    readonly source: "runtime-guard" | "observation-policy" | "lifecycle";
    readonly reason: ReasonByKind[K];
    readonly overloadEpisodes: Counter;
    readonly fallbackEntries: Counter;
  }[];
}
interface AudioStatistics {
  readonly kind: "audio";
  readonly window: Window;
  readonly modelFrameCompute: Distribution;
  readonly renderQuantumCompute: Distribution;
  readonly outputLatency: LatencyComparison;
  readonly lateBlocks: Measure<Counter>;
  readonly missedBlocks: Measure<Counter>;
  readonly renderBlocksObserved: Measure<number>;
  readonly expectedRenderBlocks: Measure<number>;
  readonly sampleRateHz: Measure<number>;
  readonly modelFrameSamples: Measure<number>;
  readonly common: CommonCounters<"audio">;
}
interface VideoStatistics {
  readonly kind: "video";
  readonly window: Window;
  readonly processing: Distribution;
  readonly outputLatency: LatencyComparison;
  readonly inputFramesObserved: Measure<number>;
  readonly outputFramesObserved: Measure<number>;
  readonly droppedFrames: Measure<Counter>;
  readonly staleFrames: Measure<Counter>;
  readonly callbackGaps: Measure<Counter>;
  readonly common: CommonCounters<"video">;
}
interface Observation {
  readonly schemaVersion: 1;
  readonly sequence: number;
  readonly epoch: number;
  readonly observedAtMs: number;
  readonly health: { readonly audio: Health<"audio">; readonly video: Health<"video"> };
  readonly statistics:
    | { readonly mode: "disabled" }
    | { readonly mode: "enabled"; readonly audio: AudioStatistics; readonly video: VideoStatistics };
}
interface CandidateObserver {
  getSnapshot(): Observation;
  getServerSnapshot(): Observation;
  subscribe(listener: () => void): () => void;
  dispose(): void; // observation only; never stops the media session
}
```

All snapshots and nested collections are immutable. An available zero means
measured zero over the declared coverage; unavailable is never encoded as zero,
`NaN`, infinity or an absent optional number. `methodId` identifies provenance
and metric semantics, not an engine selector. Implementation must reject
nonfinite/invalid measurements and count exclusions. `Health` reports observable
processing behavior, not perceived speech/visual quality or release qualification.
Audio reason codes cannot appear under video. A future multi-effect chain needs
an owner-reviewed per-effect instance projection; this proposal does not pretend
that crop and a whole segmentation chain have the same statistics boundary.
Enabled domain envelopes always expose their episode counters, including while
unsupported or on original-media fallback; individual unmeasurable fields remain
unavailable. With no configured effect, relevant quantiles are not applicable
and no new processor episodes occur in that interval; accumulated `sinceEnabled`
history survives effect removal and stop/start until the epoch ends.
Distribution metadata is always present independently of numerical availability:
method, units/clock, metric-specific counts, exclusions and coverage are retained
even when quantiles are unavailable. If instrumentation/reference is absent,
zero attempted/accepted means no observations, with unknown coverage and an
unavailable summary; it never asserts measured zero media latency or loss.

## 4. State machine, reasons and recovery

The existing lifecycle status is retained. Assessment, route and recovery are
orthogonal evidence, avoiding a breaking expansion of `ProcessorStatus`.
`active` means processed output selected, not a proven latency/quality pass.
`healthy` means only that all metrics required by the named observation policy
are available and within its limits; `evaluatedMetricIds` exposes that scope.
With collection disabled or insufficient required evidence, assessment is
`not-evaluated`, including when output is active.

| Trigger / transition | Status, route, reason | Recovery and notification |
| --- | --- | --- |
| Construct, no configured effect | `off`, `none` before capture or `original` with live input; `no-effect` | No acquisition/collector; no failure or fallback episode |
| Configure before capture or after stop, without live input | Retain `off` or `bypassed`, route `none`; `requested` / `explicit-bypass` | Store configuration for a later start; no acquisition, processor startup or fallback episode |
| Enable or replace effect against live input | `loading`, actual retained `original` or prior `processed` route; `requested` | New generation; previous output remains usable when possible; publish immediately |
| First usable processed output | `active`, `processed`, `ready` | Atomic output replacement and state update; new measurement segment, assessment initially not evaluated |
| Soft policy violation while processing continues | `active`, `processed`, assessment `degraded`; effect-specific reason | Statistical hysteresis below; no automatic bypass/retry from observation policy |
| Existing runtime overload guard fires | `degraded`, `original` if live input; e.g. audio `native-frame-budget`, video `source-rate` | Immediate fallback; one runtime-guard overload episode; fallback entry only if this begins a new fallback interval (not a second entry while already loading-original); no debounce or automatic restart |
| Unsupported capability / failed asset / processor fault | `unsupported` or `failed`, `original` if live, otherwise `none`; typed cause | Preserve existing operation error/result. Failure is distinct from whether fallback succeeded |
| Explicit bypass or remove | `bypassed` or `off`, `original` if live; `explicit-bypass` / `removed` | Dispose processor, preserve unrelated media; user bypass does not increment fault fallback |
| Cancel current setup | Restore previous settled state/route, `cancelled`; no failure | Tagged cancellation; invalidate late setup messages; provisional metrics discarded with reason |
| Supersede with newer setup | New generation remains authoritative; older result is tagged `superseded` | Old callbacks cannot publish state, statistics or counters into the new generation |
| Retry from user action | `loading`, `retry-requested`, recovery `requested`; then `active`/`verifying` on usable output | Use the existing effect setter, not an automatic capture restart; attempt counter increments once |
| Retry remains active through required good windows | `active`, `processed`, `recovered`, recovery `recovered` | Successful recovery increments once; latency metric availability still governs assessment; no support claim |
| Input ends, stop, dispose | Input end: failure with route `none`; stop/dispose: `off`, `none`, explicit reason | Flush a partial observation if enabled, cancel timers/queued setup, release owned observation resources; no callbacks after observer disposal |

Route is factual: never report `original` when that track is unavailable.
Transient fallback is an output-route change, not a claim that original output
is safe for every application's privacy needs. Default original-media fallback
remains Decision-2's policy; this proposal adds no fail-closed option. Existing
`MediaError`, operation results and capture phase remain authoritative and are
not replaced by assessment. Audio and video update independently, even when
both fail in one event-loop turn. A session's single error/transition field
must not overwrite either domain's typed observation history.

Retry policy stays explicit. `session.retry()` currently concerns capture; do
not use it as a processor-only recovery shortcut. Audio context interruption
requires the existing client activation/reapply journey; video can reapply crop
after a fault. No statistics threshold changes device selection, enables a
private Worker route, resumes a context, or substitutes an engine. Session stop
and disposal invalidate all processor generations. Observer unsubscribe only
removes the listener, never stops capture or disposes application-owned clones.

### Delivery, debounce and hysteresis candidates

- Commit authoritative lifecycle/output changes before invalidating subscribers,
  using the existing immediate session publication path. Do not defer failures,
  fallback, cancellation, recovery readiness or output identity behind a timer.
  The next applicable React commit must be able to read that state; no browser
  wall-clock deadline for React scheduling is promised.
- Statistics use candidate **nonoverlapping 5-second windows**, published on
  completion, with at most **one statistics-only invalidation per second**.
  A configurable interval cannot be below 1 second without renewed cost review.
  These proposed defaults are not current package behavior. Fault/stop boundaries
  may immediately publish one partial window, distinct from periodic ticks.
- Soft warning policies name a metric ID, upper limit `H`, and recovery limit
  `L` (candidate `0.8 * H`). Enter degraded assessment after **two complete bad
  windows** (`value > H`); recover after **three complete good windows**
  (`value <= L`). The deadband preserves assessment and resets consecutive
  streaks. Incomplete/unavailable windows break streaks and set not evaluated;
  a route/generation change resets them. Equality at `H` is not a violation.
  Values of `H`, metric eligibility and the 0.8/2/3 defaults need owner approval;
  they do not change the Worklet, raw Worker or crop safety guards.
- Recovery readiness is immediate; recovery *assessment* waits for good windows.
  A repeated fault with the same reason is one episode until the route recovers
  and faults again. Repeated reasons do not cause repetitive announcements.
- Subscriptions invalidate a latest-value store; they are not a durable event
  stream and offer no replay/exactly-once event delivery. A React render may
  skip intermediate snapshots. Monotonic sequences and cumulative counters
  reveal activity despite coalescing; no unbounded transition queue is retained.
  A future audit stream needs separate review. Reads are cached/reference-stable
  until change; subscribe/unsubscribe is idempotent, reentrant-safe, and listener
  exceptions are isolated from other listeners and media processing.
- Aggregate off the render-critical path in bounded storage. No per-block/frame
  callback to application code, React state update, sort, unbounded log, or
  allocation-heavy aggregation belongs in the Worklet/processing callback.
  Future transport uses bounded messages/buffers; omitted measurements count
  explicitly, never as dropped media. This is not a change to the audio
  candidate's present per-frame timing messages.

## 5. Measurement definitions

### Windows, quantiles, counts and resets

The candidate window uses session-relative monotonic milliseconds `[start,end)`.
A duration belongs to the window containing its completion; record start/end
endpoints in its metric definition. Epoch starts on explicit collection enable;
reenabling creates a new epoch and zero counters, with no retroactive statistics.
Counters persist across generation changes and stop/start **within that enabled
epoch**, so retries cannot erase repeated faults. Dispose ends the epoch.
Enabling midway through an existing fallback does not manufacture an entry:
the current route is visible, but earlier episodes are outside this epoch.
Window counts reset at each boundary; counters are nonnegative safe integers,
saturate at the safe maximum rather than wrap, and require a new epoch if
exhausted. No counter called `sinceEnabled` claims pre-enable/lifetime coverage.

Do not mix states, routes, sample rates, effect parameters or clock mappings in
a distribution. Split on generation/configuration, fallback, retry, input/output
replacement, visibility interruption or mapping change; close the old segment
as partial. Audio/video have separate windows/counts, even when their wall
intervals coincide. Startup and steady processing are separate phases. Fallback
and bypass durations stay in the timeline and episode counters but cannot
populate a successful transformed-media latency distribution. Whole-run
qualification must retain those intervals instead of cherry-picking active ones.

A domain-level `Window` counts observed render blocks for audio and observed
input frames for video; each distribution has its own sample-unit counts.
`activeMs` is the measured processed-route portion of that segment, not a claim
about unobserved playback. A stale source or hidden page does not create
imaginary frame/block samples to fill the wall interval.

For finite sorted samples `x[0..n-1]`, use exact nearest rank:
`Q(p) = x[ceil(p*n)-1]`, for p=0.50, 0.95, 0.99; max is `x[n-1]`.
`attempted = accepted + excluded`; exclusions have stable reason codes and
counts. Empty distributions are unavailable/insufficient-samples, never a zero
latency. For `n < 100`, nearest-rank p99 is the maximum; even larger correlated
samples do not establish tail precision. Show `n`, actual duration, coverage,
timer resolution and uncertainty, not just a percentile. A five-second runtime
window is diagnostic, not the three-run/ten-minute qualification protocol.

Candidate bounded storage: at most 8,192 duration samples per metric per segment
and one completed aggregate per domain; retain no raw media. If the capacity is
exceeded, count omitted samples, mark partial coverage and make that full-window
quantile summary unavailable with `capacity-exceeded` rather than silently
reporting a biased retained subset. Keep that metric's window/method metadata:
for 8,193 otherwise valid attempts, 8,192 accepted and one excluded with
`capacity-exceeded`, partial coverage and unavailable quantiles. The common
omission counter increments too; the metric-specific exclusions locate the loss.
A reviewed histogram/sketch would need a new method ID and published error
bounds. Never average per-window p95s to obtain a longer-window p95; combine
compatible raw samples or an approved mergeable estimator. No cross-device,
cross-browser, cross-effect or cross-epoch aggregation is implied.

### Latency and baseline relationship

| Metric | Endpoint / sample | What it cannot establish |
| --- | --- | --- |
| Audio model-frame compute | Local monotonic duration of one RNNoise/native frame call; sample unit model-frame | Whole render callback deadline, framing/queue/bridge delay, speaker delay, speech quality |
| Audio render-quantum compute | Entry to exit of a measured complete Worklet `process()` call, including all frame work; sample unit render-quantum | Whether the browser started it late or downstream playback was continuous |
| Audio track-output lag | Matched source reference to selected standard output at an explicitly named consumer, with calibrated common clock; correlation-window sample | Physical microphone/headphone delay unless the physical path is measured; every-sample latency |
| Video processing duration | Input processing callback entry to draw/output submission completion; label synchronous JS duration | GPU completion, browser presentation, source-camera acquisition or monitor scanout |
| Video callback-to-preview delay | Correlated input callback to matching preview callback, as in the corrected benchmark; matched-frame sample | Historical source-to-preview optical metric or physical camera-to-display latency |

Each distinct endpoint/estimator has a versioned `metricId`, e.g.
`audio.native-frame-ms.v1`, `audio.track-lag.legacy.v1`, or
`video.callback-to-preview-ms.v1`. A model frame, render quantum, correlation
window and video frame are different sample units. If normal application media
has no calibrated reference or matching output timestamps, output latency is
`not-instrumented`/`clock-unmapped`, not an estimate derived from compute time.
Runtime collection must not inject markers, read pixels or retain PCM simply to
fill an end-to-end field. Existing benchmark instrumentation stays separate.

Baseline requires the same source/capture profile, rate, channels, effect
scenario, consumer, visibility/load/power conditions, protocol and clock mapping.
Reference mismatch is `baseline-mismatch`; absent reference is `baseline-missing`.
Record baseline trial ID, distribution/count and method, not just its median.
Capture-only, graph/no-op and transformed conditions are distinct; no-op cost is
not deducted from a primary added-delay metric that includes that graph cost.

Preserve the Decision-12 distinction:

- Legacy diagnostic: `added[q] = Qq(processed_lags) - median(original_lags)`.
  Keep signed values and the original analyzer/protocol ID; this is not
  `AudioContext.baseLatency` subtraction or two-p95 subtraction.
- Proposed paired diagnostic: `d[i] = processed_lag[i] - original_lag[i]`,
  then `Qq(d)`. Requires validated matching and new metric ID, pairing count and
  uncertainty. It generally differs from the legacy estimator and is not
  approved as its replacement. Its sample window metadata covers accepted
  pairs, with unmatched/excluded observations counted separately.
- Report absolute processed and baseline p50/p95/p99/max alongside signed added
  values. Negative added values can reveal measurement/mapping error or noise;
  preserve them, do not clamp to zero or infer a faster-than-baseline guarantee.
  Browser `baseLatency`/`outputLatency` are optional separate API telemetry with
  their own endpoints; never sum overlapping delays or treat an API zero as a
  physical measurement. Rounding cannot turn a miss into a pass.

### Audio continuity and load

`renderBlocksObserved` counts measured render calls; a block's length is its
actual quantum sample count, not always 128 and not the 480-sample model frame.
At sample rate `Fs`, that block's nominal scheduling budget is `1000*N/Fs` ms.
`lateBlocks` counts observed whole callbacks whose compute duration exceeds
that block's budget, once per block even if it processes multiple model frames.
Call this a compute overrun, not proof of late playback. A start-deadline miss
needs an independent mapped deadline/sequence; lacking that, it stays unknown.
The candidate native-frame guard must not be relabeled as this counter.

`missedBlocks` counts proven missing expected render intervals with a validated
continuous sample clock and expected sequence, not long wall-clock gaps during
suspension. `expectedRenderBlocks` is unavailable if the observer cannot know
the schedule or variable lengths. Worklet silence, an all-zero denoised block,
a raw source timestamp jump, message loss and a downstream observer's missing
input are distinct observations; none alone proves a missed audible block.
Current routes therefore cannot promise a portable available missed-block
counter. Future adapters must document the observation boundary and preserve
unknown/unclassified continuity events in qualification evidence.

Native compute/budget ratios and bounded queue depth/high-water marks may be
additional effect-specific load metrics after review; a ratio is dimensionless
and a queue is measured in frames/blocks/samples with that unit stated. Neither
is process CPU percentage. No universal CPU ceiling is introduced. Render
deadline, output delay and quality remain independently evaluated.

### Video continuity and load

`inputFramesObserved` and `outputFramesObserved` count unique frame identities
at their named boundaries. `droppedFrames` counts unique processor-accepted
inputs intentionally discarded without output, only when input/output identity
and discard evidence exist. A canvas draw failure is a fault, not an invented
exact drop total. The existing crop cannot measure frames lost before its video
element; full camera-to-preview loss stays unavailable without an appropriate
reference. Do not infer drops from requested FPS minus observed FPS.

`callbackGaps` sums positive `presentedFrames` sequence gaps at the instrumented
video element, with reset/discontinuity excluded and counted. It measures
callback-observed presentation gaps, not physical camera loss. rAF fallback
without that metadata makes this field unavailable.

`staleFrames` counts distinct output presentation events older than an
owner-selected age budget, using a mapped source timestamp and preview clock.
Repeated output presentations may each be stale; a timer poll of the same
presentation cannot increment it again. Without matched identities/clock or an
approved age limit it is unavailable. Source freeze can also expose elapsed
time since last new frame as a separate gauge; do not call it a stale-frame
count or zero drops. These fields never merge with audio late/missed blocks.

### Common counters and clocks

- `overloadEpisodes`: increment once on entry to a runtime overload fault or a
  distinct soft overload episode, with its typed reason; distinguish those
  sources in presentation. It counts episodes, not over-budget frames/windows;
  `episodesByReason` provides the bounded typed breakdown by **source and reason**
  so coalescing cannot erase either. The same reason may be used by a runtime
  guard and an observation policy; their rows remain distinct. `lifecycle`
  identifies loading/capability/failure fallback entries that are not overload
  guard episodes. Each event increments exactly one source/reason row; sum of
  all breakdown counters equals the corresponding total, without double counting.
- `fallbackEntries`: increment once when a configured effect routes to original
  due to loading, unsupported, overload or failure; include the typed cause.
  Initial loading-original selection counts once even if it was already the
  capture route; remaining original during a startup fault does not count again.
  Explicit bypass/remove/no-effect are excluded. Private raw-route ineligibility
  followed by working Worklet is not original-media fallback.
- `recoveryAttempts` counts explicit processor retries; `successfulRecoveries`
  counts a retry that reaches usable output and completes the required good
  windows. Partial windows or a brief active poll do not prove recovery. Window
  counters reflect event time, while `sinceEnabled` preserves totals.
- All exposed durations are finite milliseconds; rates are Hz/fps; counts are
  integers. Internal audio `AudioData` timestamps in microseconds convert by
  `/1000`; audio context/sample time in seconds converts by `*1000`, but this
  does not align clock origins. Sample count/Fs gives elapsed media time, not a
  wall timestamp. Main thread and Worker monotonic times require an explicit
  offset/drift calibration before cross-realm subtraction. Clock resets suspend
  the comparison and split the segment; no `Date.now()` fallback is accepted for
  latency comparisons. No wall-clock date or device identifier is exposed.

## 6. Disabled mode, SSR, React and privacy

Statistics collection is proposed default-off and independent of effect enable,
bypass and the private audio Worker feature flag. Constructing/subscribing an
observer must not start capture, load a model, allocate a media graph or turn on
collection. Disabled statistics are exactly `{ mode: "disabled" }`; lifecycle
state remains observable through existing APIs and the candidate projection,
assessment stays not evaluated, no timers/timing buffers/periodic messages are
added. Disabling cancels collection and clears retained aggregates; old snapshots
held by applications remain their responsibility. An unsubscribe does not
toggle collection for other consumers; observer disposal disables its collector.

SSR import and inert construction touch no browser media globals, clocks,
timers or assets. The candidate server snapshot is one stable cached value:
epoch/sequence/observed time zero, both statuses off, routes none, no-effect,
assessment not evaluated, statistics disabled. Client hydration reads that
same server snapshot even if another client consumer has activated observation.
Collection starts only in an explicit client action/effect; server enable is
unsupported with no resource allocation, not a fabricated healthy result.
Multiple observers/listeners must not multiply per-block measurement work;
future implementation must define one session collector and explicit enabled
observer ownership, retaining it until the last enabled observer disposes.
Enabling/disabling one observer cannot erase another observer's epoch or data.

React reads a cached immutable snapshot with `useSyncExternalStore`; no new
measurement is performed during render, and no render creates a session or
collector. State/output replacement remains immediately readable, preserving
Decision-1's next applicable commit rule. Periodic statistics have the separate
bounded cadence above; session-only hooks receive no extra statistics ticks.
Strict Mode subscribe/cleanup/subscribe cannot restart capture or reset an epoch.
Do not announce every percentile update via an ARIA live region; announce
meaningful status/reason/recovery changes with repeated messages suppressed.
The application owns product UI, logging and any transport replacement.

Only local aggregate durations, counts, availability and typed reason codes are
eligible for this channel. Exclude raw PCM, frames, fingerprints, faces, speech
content/transcripts, device labels/IDs/group IDs, URLs (including asset query
tokens), raw timestamps with wall origins, arbitrary effect options, error
`cause`, stack traces and free-form browser messages. Session-relative IDs and
times are ephemeral; even aggregate load can fingerprint hardware, so expose
only requested bounded data, clear it on disable/dispose, and do not persist or
upload by default. Diagnostic observers do not gain borrowed-input ownership,
recording, network or telemetry functionality. Application opt-in export is
application policy and should select/redact fields rather than serialize the
session snapshot, which already contains device information. No media/network
collection is needed to display unavailable values honestly.

## 7. Consumer examples

**Available today:** existing output/status handling, with no statistics claim.
For the crop example an already started camera session is assumed. The same
factory on the audio candidate does not mean mainline implements that effect.

```ts
import { createMediaSession } from "react-rich-media-hooks/core";
import { crop } from "react-rich-media-hooks/effects/video";

const session = createMediaSession({ capture: { video: true, audio: true } });
const unsubscribe = session.subscribe(() => {
  const snapshot = session.getSnapshot();
  console.log(snapshot.processors.video.status);
  // Reattach preview/transport when snapshot.outputs.video?.id changes.
  // Do not stop session-owned output tracks from this subscription.
});
async function enableCrop() { // called after a client Start action
  const result = await session.setVideoEffects({ effects: [crop()] });
  if (result.status === "failed" || result.status === "unsupported") {
    console.log(result.error.code); // original-media fallback may remain live
  }
}
// Unsubscribe removes only this observer; the explicit owner disposes the session.
unsubscribe();
```

**Proposed consumer adapter:** `observer` below is injected, typed only with the
candidate interface above; no suggested function is an existing package export.
Activation/deactivation would be explicit in an owner-approved future factory.

```ts
function describeAudio(observer: CandidateObserver): string {
  const snapshot = observer.getSnapshot();
  const health = snapshot.health.audio;
  if (snapshot.statistics.mode === "disabled") return `${health.status}; statistics off`;
  const audio = snapshot.statistics.audio;
  const latency = audio.outputLatency.added;
  const { window, metricId, quantiles } = latency;
  if (quantiles.availability === "unavailable") {
    return `Added delay unknown: ${quantiles.reason}; attempted=${window.attempted}`;
  }
  const { p95Ms } = quantiles.value;
  return `${p95Ms.toFixed(1)} ms added p95; n=${window.accepted}; ${metricId}`;
}
// Audio late/missed blocks and video dropped/stale frames remain separate UI rows.
// Route original + status degraded means fallback, not successful denoising.
```

```ts
import { useSyncExternalStore } from "react";

function useCandidateObservation(observer: CandidateObserver): Observation {
  return useSyncExternalStore(
    (listener) => observer.subscribe(listener),
    () => observer.getSnapshot(),
    () => observer.getServerSnapshot(),
  );
}
// Pass a stable, application-owned observer. Its construction/activation is outside render.
// Use session.getOutput(kind) and the existing session subscription for output handoff.
```

## 8. Versioning, compatibility and adoption gates

This PR is documentation-only. Keep existing status unions, snapshot shape,
reason strings, synchronous session notification behavior, operation results,
track/clone ownership, React peers, entry points, asset/distribution contracts
and default effect behavior unchanged. Do not expose private `getMetrics()`,
parse fault-message text, or add engine selectors as a shortcut.

After explicit owner approval and an accepted Decision, prototype behind an
opt-in experimental contract with package/asset versions aligned under
[Decision-6](<../backlog/decisions/decision-6 - Adopt-the-release-versioning-and-changelog-contract.md>).
`schemaVersion: 1` identifies the observation payload semantics, not a new
release version or permission to ignore SemVer. Changing endpoints, quantile
rule, sample unit, baseline estimator, counter meaning/reset, reason/state union,
notification guarantees or disabled semantics needs review and version/migration
notes. A new discriminant can break exhaustive TypeScript consumers. Consumers
of serialized experimental data reject unknown schema versions and show unknown
metric/reason IDs without interpreting them as healthy. Renaming a metric cannot
rewrite old evidence. No release bump or changelog edit belongs to this spike.

Audio TASK-1.12 AC3 remains open at the audio evidence pin: the unchanged 40 ms
gate, continuous denoised output, quality/listening and reference matrix still
need their own proof. Observation availability/fallback does not satisfy them.
Video TASK-1.11/Decision-7 retain 30 fps and <=50 ms p95, capture loss/startup,
retention and supported-row evidence rules; the runtime 95% guard is not a new
quality criterion. Browser support remains the existing desktop hypothesis and
approved cadence; missing native rows stay unknown and mobile stays feasibility
only. TASK-4 does not resolve Decision-12 or promote any route to supported.

## 9. Test and validation plan

This is a future implementation plan, separate from the checks run for this
documentation change. Approval of the plan and metric policies precedes code.

| Layer | Required cases and evidence |
| --- | --- |
| Type / compatibility consumers | Current consumers compile unchanged; audio reasons rejected for video and vice versa; exhaustive known status union unchanged; unavailable data forces narrowing; schema/version rejection; ESM/CJS and tree-shaking budgets |
| State machine / races | Every transition in section 4; fault while loading/active; stale setup and late telemetry after remove/stop/dispose; independent simultaneous audio/video faults; cancellation restores prior route; exact one fallback/overload episode; explicit bypass excluded; retry never reacquires unrelated media; clone lifetime |
| Deterministic aggregation | Fake monotonic/sample clocks; empty, one, 60, 100 and large samples; exact nearest rank, ties, signed deltas, invalid/omitted samples, capacity exhaustion, partial segments, variable quanta, no average of p95s, saturating counters, boundary event attribution; paired and legacy estimators intentionally differ |
| Availability / continuity | Missing reference, clock drift/reset, timer quantization, Worklet native timing without callback instrumentation, source jitter without PCM loss, legitimate silence, observer-message loss; video callback gaps without exact source loss, rAF metadata absence, source freeze, duplicate frame identity; unknown never zero/pass |
| Notification / React | Fake timers prove 5-second windows and <=1 Hz statistics ticks; two bad/three good windows and deadband; lifecycle/fault bypasses debounce; stable snapshot identity, sequence/counter coalescing, subscriber throws/reentrancy/unsubscribe/dispose; React 18.2/19 Strict Mode and hydration; no extra session-hook renders; shared collection work |
| Disabled / SSR / privacy | Browser globals absent at import/construction; stable server snapshot and client hydration; enable server-side unsupported; disabled/disposed no timers/buffers/messages; listeners do not enable collection; independent observer epochs; network audit with no default uploads and payload inspection for media/device/error/URL leakage |
| Runtime cost | Collection off/on A/B at identical load and negotiated settings: callback p50/p95/p99/max, queue pressure, allocations, retained heap after five warm cycles, ten-minute stability. No measured media budget regression; owner sets an explicit collector CPU/memory/message budget before adoption |
| Browser / qualification | Same native reference rows and cadence as existing contracts, no fake support promotion. Known-delay/clock controls, paired reference validity, three independent runs and approved long continuity/quality/listening evidence. Compose audio+video under UI/CPU contention; preserve original legacy verdicts and exclusions; changed support/threshold requires its own approved Decision |

For this spike: typecheck the documentation's candidate types and consumer code
as isolated fixtures (including a negative cross-kind reason assignment), check
local and pinned Git paths, check immutable API/runtime/threshold scope by diff,
run the repository's required quality gate, and record exact results in TASK-4.
No fresh media benchmark, physical-device claim or Decision-12 study is needed
or authorized by this documentation work.

## 10. Implementation preparation after design-direction approval

The owner selected implementation preparation through `msg_8341cf409cef` after
PR #34 publication; its first head `fdae36e` passed all four CI jobs and received
an independent agent review. That review identified three specification
inconsistencies (deferred configuration, unavailable-distribution metadata and
episode source classification), corrected in this document before final-head
verification. Approval authorizes this decomposition and design clarification,
not new production code, measurement trials, exact exports, new numerical
policies or changed Decisions. These are proposed work packages, **not newly
created Backlog tasks or Dispatches**. No additional worker or PR is needed to
prepare them; implementation assignments must be created separately only when
their adoption/dependency gates are satisfied.

### Delivery slices and dependencies

| Slice | Concrete deliverable and boundary | Evidence required before integration | Dependencies |
| --- | --- | --- | --- |
| P0 — Freeze adoption boundary | Review the remaining choices below, inspect current Decisions again and record the approved observer contract in a new accepted Backlog Decision with a substantive title, related tasks and any exact Supersedes clauses. Keep Decision-12 and numerical/support decisions separate; do not edit historical accepted records | Owner confirmation of exact API and policies, accepted Decision metadata/body, compatibility/migration checklist; no inferred approval from this implementation plan | Preparation only now; adoption outside the two-file PR scope |
| P1 — Common observer contract and lifecycle | Implement the selected framework-neutral optional observer/factory and immutable snapshot/cache/subscription ownership at the approved export location. Define exact enable/disable/dispose results, per-observer epochs on one bounded session collector, typed reason/source mapping and schema/version behavior. Preserve existing session status/output subscriptions and no-acquisition semantics | Strict consumer/type fixtures, unavailable-quantile narrowing with metadata still readable, cross-kind reason rejection, no new notifications for ordinary session-only consumers, clone/session ownership tests | P0; no import or merge of the audio candidate |
| P2 — Aggregation core | Pure bounded per-metric aggregation: monotonic half-open windows, segment splits, exact quantiles, independent metadata and numerical availability, omissions/capacity, source/reason counter totals, epoch offsets, saturation and signed comparisons. Keep runtime-instrumented metrics separate from legacy/paired analysis adapters | Deterministic fake-clock tests for empty/small/tail samples, 8,193-attempt overflow metadata, preserved historical counters after effect removal, independent observer enable/disable, quantile non-averaging and source classification | P0 and P1 contract; no media acquisition or native backend work |
| P3 — State, route and recovery projection | Map lifecycle events to the approved projection, including pre-capture deferred configuration, live-input loading, output handoff, explicit bypass/remove, faults, cancellation/supersession, stop/dispose and retry verification. Add internal typed event evidence rather than parsing existing human messages | Table-driven transition/race tests; startup-original fault does not double-count fallback; stale generations cannot publish; soft warning and runtime guard sharing one reason retain separate source totals; recovery does not reacquire unrelated media | P1/P2; existing runtime guard algorithms and thresholds unchanged |
| P4 — Video crop observation adapter | Instrument only available callback/draw/submission durations and unique observed boundaries at bounded cost. Export callback gaps with their actual scope; mark exact source drops/stale output age/output delay unavailable without identities, mapping and an approved budget. Preserve rAF fallback and output dimensions/handoff | Crop lifecycle/rAF/metadata tests, invalid clocks/sequence reset, source freeze and duplicate presentation tests, collection off/on cost comparison under the same crop profile; no marker/pixel readback in normal processing | P1/P2/P3; mainline TASK-1.11/Decision-7 remains the baseline |
| P5 — Audio observation adapters | Integrate after an independently approved/mainline audio implementation is available. Treat model frames, full render quanta, raw Worker writes, reference lag and continuity as different boundaries; retain private route gating. Adapter fields remain unavailable when current private timings cannot justify them | Pinned/fake backend contract tests for variable quanta, native-call-only evidence, unknown missed deadlines, silence vs missing input, source-clock jitter, Worker stall and interruption; no PCM retention or changed processing/safety behavior | P1/P2/P3 plus explicit TASK-1.12 integration/dependency choice; do not copy `f92bd88` implementation into this PR |
| P6 — React/SSR notifications | Thin opt-in store adapter, cached server/hydration snapshot, no render-time construction/clock access, immediate lifecycle readability and separately bounded statistics ticks. Shared measurement work must not multiply with listeners, while observers retain independent enable epochs | React 18.2/19 Strict Mode subscribe/remount/rerender tests, server imports without browser globals, hydration parity, fake-timer cadence/hysteresis, throwing/reentrant listeners, no post-dispose ticks or resource control | P1/P2/P3; P4/P5 for realistic composed fixtures, not for SSR unit isolation |
| P7 — Consumer documentation and contract validation | Replace provisional examples only after exports are approved; document unknown metrics, factual original/processed routes, privacy-safe local export and application-owned output attachment. Implement section 9 contract/privacy/packaging tests and audio/video composed-load checks | Current/new consumer fixtures, no telemetry/media/device identity in observation payload, frozen package/API compatibility and bundle checks, readable available/unavailable/counter examples; qualification remains separate from observer tests | P4/P6; audio-specific claims additionally depend on P5 and TASK-1.12 qualification |
| P8 — Controlled experimental rollout | Opt-in experimental exposure with agreed package/schema/asset versioning, documented rollback by disabling observation, known gaps and explicit promotion criteria. No default-on switch or support promotion from field presence | Current-head CI/review, approved collector CPU/memory/message budget, off/on A/B and retained-resource evidence on agreed reference rows; legacy measurement outputs and failed cells retained | P7 and applicable P5 evidence; separate release/owner approval under Decision-6 |

P2 and P3 may be developed as isolated pure fixtures after the contract is
accepted; P4 and P5 are independent adapter work once those shared boundaries
settle. Audio integration must not block an honest video-only experimental
observer that marks audio unavailable, **if that staged exposure is explicitly
approved**. Conversely, video success never supplies missing audio AC3 evidence.
Do not turn these slices into dispatchable work until their task records and
dependencies can reference the adopted contract and a real integration base.

### Additional owner choices before implementation

| Gate | What is already authorized | Exact choice still required / consequence of absence |
| --- | --- | --- |
| G0 — Adoption and public compatibility | Shared observer/statistics design direction and this preparation work | Final factory/entry-point and type names; API options and activation/settlement behavior; whether prototype is experimental; compatibility and migration handling for new discriminants; accepted Decision before dependent code. This PR does not add that Decision because its authorized files remain the proposal and TASK-4 record |
| G1 — Collection and policy defaults | Separation of immediate lifecycle visibility from optional aggregates; preserve disabled semantics and existing media guards | Freeze or revise candidate 5-second windows, <=1 Hz statistics invalidation, 8,192-sample capacity, 2-bad/3-good windows and 0.8 recovery ratio; pick required metric scopes and warning limits or explicitly ship assessment not evaluated. These are observation choices, never a new 40 ms or video acceptance rule |
| G2 — Cost and retention | Bounded local aggregates, no default media/identity collection or upload | Quantitative collector CPU/callback, memory and message budgets; reference rows and off/on regression rule; ownership of collection requests and per-observer epoch reset/retention. Unmeasurable or over-budget collectors cannot be promoted by omitting overhead evidence |
| G3 — Audio measurement process | Keep legacy results and Decision-12 proposed, with 40 ms/quality/continuity gates unchanged | Scenario/consumer, reference devices, pairing/clock/uncertainty protocol and study resources remain Decision-12 choices. Runtime compute/counter instrumentation may be planned, but no new end-to-end estimator or qualification trial is authorized by observation design approval |
| G4 — Integration and staged scope | Mainline video evidence plus pinned unmerged audio research can inform design | Choose the actual accepted audio integration commit and task dependency; explicitly approve any video-first experimental surface with audio unavailable. Preserve private Worker gating, mainline unsupported behavior until audio integration, and current browser/support rows |
| G5 — Rollout and promotion | Preparation may specify experimental opt-in and compatibility validation | Owner decides release classification, exposure/promotion criteria and reference coverage under Decision-6. No default-on collection, release-support claim, numeric target revision or API implementation follows from documentation integration |

Exit from preparation is a reviewable contract-freeze packet: selected G0–G5
values or explicitly deferred portions, the accepted Decision and exact related
tasks to be created, slice-specific acceptance criteria and test commands, an
integration base, and a release/migration plan. Until that packet is approved,
stop at this documentation/task plan; retain the current 40 ms, quality,
continuity, fallback, ownership, SSR/React and support contracts. Approval of
observer design is not approval of Decision-12, new backends or relaxed gates.
