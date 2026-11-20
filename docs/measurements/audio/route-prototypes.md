# Profiled RNNoise and disposable audio routes

TASK-1.12, owner authorization `ctx_d42fd3efde41`, existing Draft PR #32.
The owner rejects fallback-only adoption or closure. That direction supersedes
historical recommendations in the previous experiment reports. AC3 remains open;
no production artifact, public API, support promise, Decision or fallback policy
is changed by these research fixtures.

## Question, controls and limits

Compare the unchanged first-party C generic engine with profile-selected Zig
kernels, a bounded Worker/SAB route, and raw audio processor/generator routes.
A literal whole-engine translation is not assumed to improve the dominant path.
The current C artifact remains the oracle and distributed engine, SHA-256
`43acc555d5612d3bc59ac3dac5a387059fd33c473d3282f871c8c9475a854b56`.

Added latency is the processed standard-output lag minus the **same run's
original-track median**, including graph, RNNoise analysis and frame staging.
The graph-only diagnostic is never subtracted. The 40 ms added p95, 128/48000 s
(2.667 ms) Worklet quantum, two-consecutive-native-frame overload guard and
1000 ms production initialization bound remain unchanged. No late original
fallback qualifies as denoised output; a short active interval is not ten
minutes of denoising. Negative added differences are reported rather than
clamped; they can reflect independent browser media-consumer buffering.

This fixture corrects the earlier cyclic diagnostic topology: the captured
source, processor and independent observer contexts form a DAG. The reference
is the original captured track, rather than an un-captured source oscillator.
The observer records producer-labelled 16000-sample/48000-frame one-second
windows with a three-pair Worklet transfer pool. The main-thread diagnostic
retains the requested windows and recycles replacement buffers; retained PCM
is bounded by the configured window count (76 pairs in the 60-window trial),
not a claim that the entire recorder uses only three pairs. Sample-time state changes,
low correlation, silence, nonfinite samples, dropped collector windows and
incomplete windows retain their existing exclusions. A raw path can precede
its reference consumer, so this experiment explicitly searches -300..300 ms;
legacy reports retain their 0..300 ms default. Known -30/0/30/60 ms controls
calibrate the signed estimator. A regression also preserves the rule that
90 ms processed minus 20 ms original is 70 ms, never 30 ms after graph
subtraction. Controls in both current browser cells have zero observed error.

The principal automated cells are headless Linux Chromium 151 and Firefox 153
on WSL2. Their Playwright desktop User-Agent strings contain Windows; that is
an override, not proof of a Windows-native executable. An additional owned
Orca tab runs Win32 Electron 43.8.10 / Chromium 150. It is a native-host
**diagnostic** cell, not standalone Chrome/Edge and not an acoustic microphone
loopback. No microphone was acquired; generated-source playback feeds captured
standard tracks and the observer's hardware output is zero-filled. Do not pool
these environments or call them the complete release/device matrix.

Representative quality and timing fixtures are distinct. The expanded quality
fixture contains ten speakers, actual living-room/kitchen noise and noise-only
padding needed for attenuation measurements. Its first 600-second raw-C run
kept denoising active for 600.165 seconds, but only 39/60 latency windows
correlated; 21 exclusions and two unclassified observer clock jumps prevent
60-window/continuity qualification. That run remains visible as an incomplete
qualification, despite its 31.3125 ms measured added p95. It is never relabelled
as a pass.

Follow-up timing uses the established pinned 4.92-second speech clip plus
living-room noise at 10 dB, with no inserted noise-only padding (SHA-256
`cb0a291b17fffa822a95c6abf1ffeb02da69552395a7a897df73a1880c653ee2`). This isolates
measurable voice delay from noise attenuation quality. Each long case requests
60 one-second windows at a fixed ten-second stride across 600 stable seconds,
with one second of startup warm-up, identical inputs and requested 20 ms/250 ms
UI contention. Selection is fixed before results, independent of lag or state;
all exclusions are reported, and native/callback/continuity counters cover the
entire run. The production 1000 ms startup deadline is unchanged; the diagnostic
collection watchdog reflects the sampled duration, not a longer product deadline.
An actual two-window/four-second probe verifies exact 48000-frame windows and
96000-frame spacing. Internal render gaps are also recorded per window, so a
gap followed by an overlap cannot cancel at its endpoints and qualify.

Individual fixture order, media-consumer buffering, diagnostic clock resolution
and ordinary host activity limit causal claims about small route differences.
Unsupported and failed cells remain visible; no aggregate hides Firefox.
Human listening is explicitly PENDING following coordinator reply
`msg_4ac65140a988`; do not open the blinded key or infer hearing from STOI/bit
identity. A physical reference/device matrix remains unqualified. Raw timestamp
jitter events alone are not proven audio drops: report timestamp deltas,
samples/span, waveform correlation and render counts separately.

## Full-stage evidence and the expanded Zig trial

Diagnostic builds wrap the real C stages with nested timing markers: total,
features, forward/inverse FFT, radix-4 FFT, pitch downsample/search/doubling,
model, convolution, GRU, affine, activation, synthesis and pitch filter.
Only these diagnostic builds import `probe.mark`; uninstrumented oracle and
prototype controls have no imports. High-resolution Worker profiles use 80
warm-up plus 320 measured identical voiced/noise frames and include untrimmed
p50/p95/p99/max. Stage inclusive and exclusive costs are reported separately;
marker overhead means they are not a production deadline measurement.

Firefox C affine exclusive time is 1434.42 ms/320 frames, versus 47.14 ms
radix-4, 62.88 ms other forward/inverse FFT, 41.80 ms activation and 13.38 ms
GRU orchestration. With the earlier affine SIMD port, affine still takes
420.28 ms, radix-4 44.44 ms, other FFT 59.82 ms and GRU control 4.04 ms.
Consequently the next prototype keeps dense/sparse affine accumulators in
register tiles and implements actual radix-4 FFT SIMD with independent lanes.
Actual browser batches compare236160 samples per artifact in both Chromium
and Firefox with zero differing PCM bits, zero normalized peak/RMS/probability
difference and enforced fixed memory. The expanded variants record4428 radix-4
calls over 492 frames, proving the FFT path is actually used.
It retains C model data, features, other FFT radices, pitch, activation and
GRU control. Rewriting the entire low-cost GRU orchestration is not supported
by this profile. No approximate math, reordered per-output reduction, FMA or
relaxed SIMD is introduced.

Uninstrumented Worker engine times (ms, same 320 frames):

| Browser | Engine | p50 | p95 | p99 | max |
| --- | --- | ---: | ---: | ---: | ---: |
| Chromium | C generic | 0.310 | 0.425 | 0.625 | 1.120 |
| Chromium | Previous affine SIMD | 0.175 | 0.260 | 0.340 | 0.875 |
| Chromium | Tiled/FFT scalar | 0.230 | 0.355 | 0.495 | 0.695 |
| Chromium | Tiled/FFT SIMD | 0.145 | 0.225 | 0.480 | 0.595 |
| Firefox | C generic | 4.820 | 7.420 | 11.460 | 12.660 |
| Firefox | Previous affine SIMD | 1.700 | 2.780 | 3.520 | 6.300 |
| Firefox | Tiled/FFT scalar | 3.620 | 4.860 | 6.380 | 9.680 |
| Firefox | Tiled/FFT SIMD | 1.580 | 2.060 | 2.380 | 2.520 |

The Worker improvement is real, but actual Worklet profiles and processing
still fail to establish a safe real-time cell. Firefox raw native diagnostic
p50/p95/p99/max is 5/7/15/22 ms for C and 2/3/5/6 ms for tiled/FFT SIMD;
callbacks exceeding 2.667 ms are 240/900 and 15/900 respectively. The checked
and in-place SIMD paths exceed on 18/900 and 35/900 callbacks. These Worklet
clocks are `Date.now`, with coarse resolution and scheduling stalls; zero
means below clock resolution, not zero work. Warming the module in a temporary
Worker before the actual Worklet also failed to prevent the actual Firefox
production guard from restoring original audio. No guard is relaxed to make
the port pass.

| Artifact | Raw bytes | gzip bytes | Imports | Fixed memory |
| --- | ---: | ---: | --- | ---: |
| Unchanged C | 5579171 | 5041787 | None | 8 MiB |
| Tiled/FFT scalar | 5578164 | 5041692 | None | 8 MiB |
| Tiled/FFT SIMD | 5591888 | 5045941 | None | 8 MiB |

Prototype hashes are `9a15deaf80ccea05800c8f292cf1f89f8d4bc75b5ec88dc91965011a0d46106c`
(scalar) and `da72f53a3586a9066b3cb61434921d4bef31da9a64a1cf166381541cf4c7925f`
(SIMD). Both use Zig 0.15.2, the same pinned C/model inputs and 256 KiB stack.
SIMD128 is an explicit additional machine requirement, never a silent generic
replacement. Both variants match C bit-for-bit over 1492 streaming 480-sample
frames, including speech, silence, impulse, voiced and seeded noise; frame,
probability, normalized peak and RMS differences are zero. Both repeat the
original 36 quality cells identically. Default-model float paths are exercised;
no alternative-model/int8 compatibility promise is made.

## Bounded Worker and raw-track trials

The SAB prototype uses one Worker, fixed 1920-sample input and output FIFOs,
atomic producer/consumer counters and a 128-sample Worklet pump. The Worklet
never blocks or runs inference; only the Worker waits. Full/empty queues,
post-readiness input/render gaps and consecutive callback overruns fault and
restore the original output. Shutdown sets a stop flag, wakes waits, releases
native state, acknowledges, stops only owned tracks and closes the context.
The experimental startup reserve grid of 128/256/480/960 samples is explicit
buffering, counted in measured latency. Every tested C and tiled-SIMD cell
so far faults with output-ring underrun; moving computation alone does not
solve scheduling and 480/128 frame pacing. Do not claim ten-minute or
60-window denoising for those failed paths. These failed implementations do
not prove that every possible SAB design is infeasible.

A second bounded scheduler uses a direct Worklet-to-Worker MessagePort, one
coalesced credit and at most four native frames per event; no main-thread PCM
forwarding is added. Clock-only startup, actual-output/caught-up startup, and
observed real-time cadence plus a 480+128-sample reserve also fail in the WSL
cells. The last variant requires two consecutive 20 ms cadence windows within
two render quanta before ingesting input; its reserve follows the 480/128
boundary, not a relaxed deadline. It may discard **only unpublished startup
output**, whose exact count is recorded, before handing off from original
media; it never drops active output to hide underflow. Input capacity remains
1920 samples and the original startup watchdog remains 1000 ms. Fault records
retain wall/render time, queue occupancy, unpublished discard and cadence
warm-up, distinguishing startup/scheduling failure from inference cost.

Chromium 151 exposes the legacy Window audio `MediaStreamTrackProcessor` and
`MediaStreamTrackGenerator`; trials actually read and write `AudioData`.
Neither constructor exists in Firefox 153, and neither exists in the Worker
global in either cell. Chromium can create the endpoints in Window and
transfer the readable/writable streams into a Worker. This remains a
disposable experiment, not a new public main-thread bridge. RNNoise inference
runs locally in that Worker; output is a standard audio track. The browser may
still involve Window tasks in transferable-stream implementation; complete
independence from UI scheduling is not promised.

The raw prototype accepts 48 kHz input, downmixes channels, frames 480 samples,
retains input timestamps, and bounds application writes to two in flight.
Its source processor requests a four-chunk queue; actual browser buffering is
also a measurement unknown. Every AudioData is closed; stop cancels the
reader, drains/releases the writer, stops the session-owned generator and
terminates the Worker. Closing the writer itself ended independent clones in
a preliminary invalid trial; the corrected experiment releases its lock and
checks clone state 150 ms after shutdown. A serialized one-write-at-a-time version
lost approximately 20% of expected input throughput; those low-latency numbers
are explicitly discarded. Neither fix is adopted in production.

Signed, calibrated eight-window screening on clean speech found Chromium raw
C added p95 17.375 ms and raw SIMD 29.375 ms. Raw pass-through was -4.625 ms,
and a separate raw 30 ms delay route was 21.375 ms; different media consumers
can change buffering, so their between-route difference is not exact model
latency. These are screening observations, not release qualification. Firefox
raw cells are explicitly unsupported. SAB resource loading needed matching
COEP headers on Worker scripts in addition to top-level COOP/COEP. Non-isolated
Chromium actually reads/writes raw audio, while SAB is unavailable; isolation
is a deployment requirement of SAB, not an assumed consumer default. In the
Orca native-host diagnostic, isolation and SAB remain unavailable despite the
server headers; do not infer standalone Chrome behavior from an embedding.
Its eight-window raw-C screen has baseline 4 ms, added p95 21.3125 ms,
8/8 accepted windows, no stable missing/nonfinite/zero/render-gap counters,
acknowledged Worker disposal and an independent output clone live after 150 ms.
This screen lacks the final run's HTTP identity checks and is labelled as such;
it is not a ten-minute pass.

The standards situation is material: the current [W3C MediaStreamTrack
Transform draft](https://www.w3.org/TR/mediacapture-transform/) does not have
working-group consensus on audio processing, and exposure differs from
Chromium's older Window implementation. [Chrome's insertable media processing
documentation](https://developer.chrome.com/docs/capabilities/web-apis/mediastreamtrack-insertable-media-processing)
describes that older audio route. Capability checks and actual read/write
trials are necessary; the presence of `AudioData` alone proves neither track
API. Browser version numbers are observations, not a forward guarantee.

## Buffer, copy, queue and ownership accounting

| Boundary | Current path / allocation or queue | Measured or unresolved cost |
| --- | --- | --- |
| Capture and standard track sources | Capture source shared by independent track clones; browser media graphs | UA buffering is included in end-to-end results, not directly observable or subtracted |
| Worklet input | 128 normalized samples downmixed/scaled directly into borrowed native 480-sample buffer | No native-frame `set` pair on owned-frame path; 480-sample framing still contributes delay |
| Native engine | Per-instance fixed 8 MiB; in-place frame and checked finite/memory/ABI results | Dominant CPU is model affine; 20 ms pinned model analysis delay remains |
| Dry and output alignment | Fixed 480 dry frame, 960 dry delay, 480 output frame, cursors | Dry history aligns all semantic mixes; output frame contributes staging, not an unbounded queue |
| Timing telemetry | One serialized small message per 480 samples, main retains at most 1000 timings | Browser port queue has no explicit credits; cannot assert its internal memory bound; no audio frames traverse it |
| Processor graph | MediaStreamSource → Worklet → MediaStreamDestination in its own context | Fixed graph cost is independently measured and retained in the 40 ms result |
| Application output clone | Standard `track.clone`, independent lifetime | No JavaScript PCM copy per quantum; stop owned output only, check clone after 150 ms |
| SAB trial | Two 1920-sample FIFOs, 128-byte control, preallocated native timing storage | 480 input native copy + 480 output ring copy; Worklet128 ring copies; explicit reserve and capacity, fault on exhaustion |
| Raw trial | Source processor requested max four chunks; at most two pending 480-sample writes | AudioData copies/downmix, native scaling/output copy, transferable-stream/UA buffers; actual chunk/timestamp/sample counts reported |
| Observer | Three-pair Worklet pool; main retains configured windows and returns new buffers; fixed native and timestamp histograms | Diagnostic only; base64 conversion occurs after contexts close; no PCM upload or package asset |

Isolated boundary microbench medians per frame: two `Float32Array.set` calls
0.04 µs Chromium / 0.05 µs Firefox; reference versus direct mono loops
1.50/0.25 µs and 4.00/1.00 µs respectively. Finite `.every` is 3.75 µs /
0.60 µs. These batched hot-loop figures are diagnostic bounds, not additive
causal estimates of total callback savings. Millisecond native inference and
browser scheduling dominate; clone count and copies alone do not explain
or fix the measured failure.

## Representative quality and listening

The [pinned source manifest](audio-route-corpus-sources-2026-11-21.json)
selects the first five F/five M speaker IDs from LibriSpeech's own metadata and
the first suitable archive clip, not clips selected by quality scores. The
first channel of DEMAND living-room and kitchen recordings supplies actual
noise. [LibriSpeech](https://www.openslr.org/12) is CC-BY-4.0; the [DEMAND source
record](https://zenodo.org/records/1227121) describes CC-BY-SA-3.0. Archive and
member hashes and author attribution are retained; audio and mixed derivatives
stay in ignored local cache, never Git, uploaded evidence or package output.
This broadens coverage beyond one reader/synthetic noise but is still English
read speech and two environments, not a universal corpus.

Ten speakers × two noises × 0/10 dB × three semantic levels gives 120 cells.
All outputs are finite, unclipped and bit-identical across unchanged C and
both expanded prototypes. Applying the **existing**, unrelaxed smoke limits
(tail attenuation ≥6 dB and STOI delta ≥-0.03) gives 119/120 passes. Strong on
speaker 251, living-room noise, 0 dB has STOI 0.753027 → 0.720839 (delta
-0.032187), with 81.865 dB tail attenuation. This failure remains visible; it
is not rounded into a pass. Mean/min STOI deltas for light, standard, strong
are 0.02051/-0.00129, 0.02354/-0.00398 and 0.01914/-0.03219. The tentative
numeric smoke criterion is not a substitute for approved listening quality.

A deterministic 16-case local blinded A/B/C packet contains clean/noisy/C-strong
versions (including failed-cell case 09), reviewer instructions, attribution and a separate hidden key at
`.cache/audio-routes/review/index.html`. Human results are PENDING; the agent
does not claim to have listened. Live browser continuity also requires its
own evidence rather than offline oracle equality.

## Matched native-host long-run results

The final v6 Win32 Orca/Electron diagnostic runs C and tiled/FFT SIMD
sequentially on the same pinned input, same original-track reference and
requested UI load. All -30/0/30/60 ms controls have zero error. The original
baseline is **-6 ms** and is retained unchanged: processed p95 34 ms minus
-6 ms is 40 ms, not a lower value after clamping or subtracting graph latency.
Doc-1 specifies no more than 40 ms, so C touches the measured boundary with
**no margin**; this is not robust release qualification.

| Measure | C generic raw Worker | Tiled/FFT SIMD raw Worker |
| --- | ---: | ---: |
| Accepted one-second windows across the ten-minute run | 60/60 | 60/60 |
| Total loopback p50/p95/p99/max, ms | 24/34/34/34 | 26/36/36/36 |
| Added p50/p95/p99/max, ms | 30/40/40/40 | 32/42/42/42 |
| Native engine p50/p95/p99/max, ms | 0.5/0.9/1.5/14 | 0.4/0.6/0.9/10.5 |
| Native frames timed | 60123 | 60124 |
| Native frames above 2.667 ms, comparison only | 199 | 51 |
| Stable processed seconds | 600.000 | 600.008 |
| Stable observer samples | 28800000 | 28800384 |
| Source/output samples, equal within each case | 28859040 | 28859520 |
| Stable missing input/output, nonfinite, render gaps, collector drops | 0 | 0 |
| Stable all-zero render quanta, unclassified | 3 | 3 |
| Requested 20 ms/250 ms contention ticks observed | 2404 | 2404 |
| Worker shutdown acknowledged / clone live 150 ms after close | Yes / Yes | Yes / Yes |

Inference is on the Worker, so its 199/51 native-frame comparisons above
2.667 ms are **not Worklet callback deadline misses**. The model still uses
480-sample frames; no render guard or acceptance threshold was relaxed.
The actual end-to-end result does not improve with SIMD in this fixed-order
run, despite its lower engine time. Different media-consumer buffering and
order prevent attributing the 2 ms difference solely to the kernel. Do not
replace C or add a SIMD requirement to make an isolated compute chart look
better.

Both cases remain denoising-active without original fallback and retain all
60 windows, including late latency increases. Three all-zero quanta per case
are not classified as silence versus a rendering artifact. Native/source sample
counts and absence of missing channels do not establish perceived continuity;
no glitch-free or no-underrun release claim is made. The browser's source and
observer contexts each report baseLatency about 10.021 ms and end outputLatency
40 ms; neither is deducted from the result. Whole-browser heap growth was not
measured: fixed native memory and bounded application containers are distinct
from a process-memory qualification, and the diagnostic retains configured PCM
windows. Human listening, standalone browsers, other rates/devices and acoustic
reference latency remain PENDING.

The [full scored report](audio-route-native-endurance-2026-11-21.json) retains
per-window lags, state history, source/served identities, context timing,
all tails, zero-quanta counts and timestamp metadata. Legacy `stats.gaps` is
explicitly timestamp-jitter events, not a claim of tens of thousands of audio
drops. Raw PCM stays local. A separate same-host short graph/current-Worklet/raw
screen is retained to avoid comparing unlike operating systems as if they
were a controlled architecture speedup.

The additional same-native-host eight-window screen uses the same timing input
and 20 ms/250 ms requested UI load for all four paths. Its own original median
is4 ms, controls calibrate exactly, and each path has8/8 accepted windows:

| Same-host short screen | Added p95, ms | Scope |
| --- | ---: | --- |
| No-RNNoise processor graph | 20.0000 | Graph diagnostic only; never subtracted |
| Actual C generic Worklet | 50.6875 | Misses40 ms in this run |
| Actual tiled/FFT SIMD Worklet | 39.3125 | Short promising cell; not 600 seconds or Firefox qualification |
| C raw Worker | 10.0000 | Short promising cell; its long-run result is 40 ms, not 10 ms |

The [scored same-host screen](audio-route-native-matched-2026-11-21.json) shows
why a single short result cannot be promoted to a release claim: graph/media
consumer instantiation and fixed order change buffering, even on one host.
The original baseline also differs from the long run. Keep both runs; do not
choose the 10 ms screen over the 40 ms long tail or pool them. SIMD in the approved
Worklet architecture warrants further standalone/native long-run investigation,
but no unshipped artifact or extra Worker is adopted from an eight-window pass.

### Existing Worklet architecture: required long follow-up

The promising 39.3125 ms short SIMD Worklet cell was also tested for 600 stable
seconds on a fresh native-host fixture, with the same input, 60 uniform windows
and UI load. This actual SDK path uses no additional Worker. A passive Window
listener only records its existing timing/fault messages; the audio-thread
source and two-frame guard remain unchanged.

All 60 processed windows are accepted, with original median -6 ms, total loopback
p50/p95/p99/max 55.3125/75.3125/75.3125/75.3125 ms and **added
61.3125/81.3125/81.3125/81.3125 ms**. It stays active for 600 stable seconds with
zero stable missing/nonfinite/zero/render-gap counters and collector drops;
normal disposal preserves the application clone. Existing checked-kernel
messages (60129 observed, coarse Date.now) have p50/p95/p99/max 0/1/1/4 ms,
three comparisons above 2.667 ms and no consecutive-budget fault. These messages
are checked-kernel time, not a complete callback-duration distribution.

One known-zero control window has two internal render-clock discontinuities
and is excluded; its other two windows calibrate exactly. Two further clock
jumps occur during the predetermined startup warm-up. The 600 stable-second
interval has none. The [complete scored report and observed timings](audio-route-native-worklet-endurance-2026-11-21.json)
retain those events and exclusions. The short 39.3125 ms result is not used to
hide the long 81.3125 ms failure. This trial separates a successful compute/
render-guard outcome from failed end-to-end latency, without blaming a specific
unmeasured browser queue or deducting graph cost.

## Browser and device matrix

| Cell | Current Worklet / Zig trial | Bounded SAB Worker | Raw audio Worker |
| --- | --- | --- | --- |
| Linux/WSL Chromium 151 | Short actual-host results and tails retained; no established 40 ms production cell | C/SIMD underflow, including direct-port/cadence variants | Actual read/write; screening and incomplete first long run retained; no full qualification claim |
| Linux/WSL Firefox 153 | C and expanded SIMD actual host fall back; measured callback budget misses | C/SIMD underflow or overflow | Window and Worker audio track constructors absent |
| Native Orca Win32 Electron 43.8.10 / Chromium 150 | SIMD Worklet: 600 stable seconds, added p95 81.3125 ms; short 39.3125 ms does not qualify | SAB/isolation unavailable in this embedding | C raw: 60/60 windows, p95 40 ms at boundary,600 stable seconds; SIMD 42 ms fails; zero quanta and hearing/device gaps retained |
| Edge | Runtime missing at `/opt/microsoft/msedge/msedge`; not measured | Not measured | Not measured |
| WebKit / Safari | Playwright WebKit runtime missing; no Safari device available | Not measured | Not measured |
| Physical microphone/speaker/device references | No acoustic/reference measurement or support promise | Unqualified | Unqualified |

## Remaining integration unknowns and minimum follow-through

These prototypes are representative **strong/wet-only** processing routes, not
new public processors. A production proposal must preserve Decisions 2/9 and
must not infer compatibility from these fixtures:

- The raw prototype rejects input other than 48 kHz and chunks above 4096
  samples. The current 48 kHz AudioContext can resample other capture rates;
  raw input needs verified private resampling or an explicitly approved
  compatibility boundary. No 44.1/16/96 kHz device is qualified here.
- Its source queue requests four AudioData chunks, not four 480-sample native
  frames. Chunk size, hidden UA buffering and timestamp jitter vary; the
  observed 480-sample chunks do not prove a universal time bound. Two pending
  output writes are measured, not assumed to prevent every overload.
- Existing light/standard mixtures require the same two-frame dry alignment
  and update semantics in a Worker. Original 36-cell repeats cover all semantic mixes, and expanded model outputs
  remain bit-equivalent; the disposable raw route always uses
  strong. Arbitrary multichannel downmix rounding has not been qualified.
- Production readiness must mean usable output, not merely Worker engine
  initialization. The prototype's early ready message is a research shortcut;
  initial zero quanta are separately recorded, not a new lifecycle promise.
- Fault/termination, source end, cancellation during blocked writes, stale
  generation callbacks and bounded shutdown need actual Worker integration
  tests. Normal disposal preserves clones in the measured cells; this does
  not prove independent-clone behavior for every failure/abort path. No
  sample loss is silently accepted as a new fallback policy.
- Window-created track endpoints and transferable streams can involve
  browser-controlled Window scheduling; measure actual UI contention and
  timestamp/sample continuity. Do not advertise a fully main-thread-free
  native stream implementation.

If the owner approves a new Decision permitting a raw Worker direction, the
smallest integration plan is: retain the C default artifact and private ABI;
add an SSR-safe private adapter with versioned Worker asset/CSP checks; wire
existing level/bypass/add/remove/session-generation controls and usable-output
readiness; enforce bounded framing/backpressure and observable original-media
fallback; verify fault/cancellation/clone ownership and cleanup; then repeat
matched latency/quality/continuity on an agreed standalone browser/device
matrix and obtain the blinded human review, including the failed strong cell.
No public engine selector, alternate model, unrelated media reacquisition or
fallback-only task closure is part of that plan. A SIMD artifact is not needed
merely because it is faster in an isolated Worker; adopt it only for a
measured acceptance need with explicit compatibility/distribution approval.

## Research disposition and approval boundary

The expanded port improves compute and preserves tested numerical output. Its
short native-host SIMD Worklet screen reaches 39.3125 ms, but the required
long run fails at 81.3125 ms; Firefox also falls back. No qualified cross-browser
40 ms cell is established. Keep the current C artifact. A literal full Zig rewrite
of cheap stages has no evidence-backed performance case. Retain the
profile-selected port as an unadopted experiment; neither its scalar nor SIMD
artifact replaces C. Raw C in Chromium
is a candidate for further qualification at the 40 ms long-run boundary, with
no safety margin or standalone/device qualification; no raw Firefox implementation is
available in this reference cell. SAB and raw Worker paths conflict with
Decision-10's no-extra-Worker contract; raw routing also changes browser and
distribution/deployment boundaries. Any production adoption requires an
explicit owner choice and a **new accepted Decision** superseding the relevant
Decision-10 clauses before integration; historical Decisions are not edited.
No such Decision or adoption is created here. No fallback-only closure,
threshold relaxation, alternate engine, dependency or public selector is
introduced. Keep TASK-1.12 In Progress and PR #32 Draft/manual.

The long-run evidence is recorded above; the concrete owner question is
recorded in the task and the existing PR/coordinator handoff. Physical devices, human
listening and unsupported release-matrix cells remain explicit qualification
gaps, not implied successes.

## Evidence files

- [Build identities, sizes and fixed-memory/import contract](audio-route-build-2026-11-21.json)
- [Full-stage controls and exclusive/inclusive profiles](audio-route-stages-2026-11-21.json)
- [Untrimmed actual Worklet engine/callback samples](audio-route-worklet-2026-11-21.json)
- [Streaming frame bit/numeric comparison](audio-route-frames-2026-11-21.json) and
  [actual Chromium/Firefox batch equivalence](audio-route-browser-bits-2026-11-21.json)
- [Original 36-cell repeats](audio-route-quality-36-2026-11-21.json) and
  [expanded 120-cell evidence, including the failure](audio-route-quality-expanded-2026-11-21.json)
- [Timing input identity](audio-route-inputs-2026-11-21.json),
  [capability/unmeasured cells](audio-route-capabilities-2026-11-21.json),
  [bounded Worker failures](audio-route-worker-failures-2026-11-21.json), and
  [native-host eight-window screen](audio-route-native-screen-2026-11-21.json)
- [Matched native-host long run](audio-route-native-endurance-2026-11-21.json),
  [incomplete earlier run](audio-route-incomplete-endurance-2026-11-21.json),
  [actual-host controls](audio-route-host-controls-2026-11-21.json), and
  [same-native-host graph/current/raw screen](audio-route-native-matched-2026-11-21.json),
  [long actual Worklet follow-up](audio-route-native-worklet-endurance-2026-11-21.json)
- [Run/environment/source/raw-report provenance](audio-route-environment-2026-11-21.json)

## Reproduction

Use the repository-pinned tools and a frozen Vite server with COOP same-origin,
COEP require-corp and CORP same-origin headers for isolated research. Restart
that exact server after changing module sources; do not benchmark concurrently
with native builds or another browser measurement. The opt-in tests use the
existing Playwright fixture and import no research module from package entrypoints.

```sh
mise exec -- node scripts/experiment-audio-zig.mjs
mise exec -- node scripts/experiment-audio-optimized.mjs
mise exec -- node scripts/experiment-audio-stages.mjs
AUDIO_COMPARISON_BUILD=.cache/audio-optimized/build.json \
  AUDIO_COMPARISON_OUTPUT=.cache/audio-optimized/frame-comparison.json \
  mise exec -- node scripts/compare-audio-zig.mjs
PYTHONDONTWRITEBYTECODE=1 uv run --no-project --with numpy==2.3.5 \
  --with scipy==1.16.3 --with soundfile==0.13.1 --with pystoi==0.4.1 \
  python scripts/prepare-audio-route-corpus.py
AUDIO_ROUTE_RESEARCH=1 AUDIO_ROUTE_MODE=profile mise exec -- pnpm exec \
  playwright test tests/browser/audio-route-research.spec.ts \
  --project=chromium --project=firefox
AUDIO_ROUTE_RESEARCH=1 AUDIO_ROUTE_MODE=worklet mise exec -- pnpm exec \
  playwright test tests/browser/audio-route-research.spec.ts \
  --project=chromium --project=firefox
AUDIO_ROUTE_RESEARCH=1 AUDIO_ROUTE_MODE=routes AUDIO_ROUTE_WINDOWS=60 \
  AUDIO_ROUTE_TRIAL=endurance AUDIO_ROUTE_DURATION=600 AUDIO_ROUTE_CASES=raw-c \
  AUDIO_ROUTE_INPUT=.cache/audio-routes/corpus/latency-loop.f32 \
  mise exec -- pnpm exec playwright test tests/browser/audio-route-research.spec.ts \
  --project=chromium
```

Set `AUDIO_ROUTE_DELAY=128`, `256`, `480`, `960` to reproduce the reserve grid;
`AUDIO_ROUTE_CASES=current-c,current-next,current-warm-next,sab-c,sab-next` selects
actual-host/control paths. `AUDIO_ROUTE_ISOLATED=0` removes top-level isolation
for capability/deployment-negative checks. Tests collect evidence; a passing
measurement contract does not mark AC3 passed. Raw recordings remain local;
committed reports contain scalar summaries, state/lag windows and identities.


For the additional native-host cell, use an owned Orca browser tab at the local
`tests/browser/index.html` fixture, install
[`native-setup.mjs`](../../../experiments/audio-routes/native-setup.mjs) with
`orca-ide eval`, and click its button through the CLI to supply user activation.
Before clicking, set `nativeResearchOptions` to `mode: "endurance"`,
`duration: 600`, `windows: 60`, `cases: ["raw-c", "raw-next"]`. It verifies the
C, SIMD and input response hashes and records served-source identities before
starting. The two cases run sequentially in one fixture; output is muted and
no microphone is requested. Capture `visibilityAtStart/End` and actual contention
ticks; this remains an embedding diagnostic, not a release browser claim.
After the status is Complete, export locally without printing PCM:

```sh
python scripts/collect-native-audio-routes.py --page <owned-page-id> \
  --output .cache/audio-routes/native-final.json
PYTHONDONTWRITEBYTECODE=1 uv run --no-project --with numpy==2.3.5 \
  --with scipy==1.16.3 python scripts/summarize-audio-routes.py \
  .cache/audio-routes/native-final.json
```

The collector reads four windows at a time through local Orca IPC and guards
the fixture URL. Commit only the scored summary, not the raw PCM/base64 export.
The first hashed-preflight launch had a Web Fetch `Response.ok()` typo and
stopped before module import/audio creation; it was corrected to the boolean
property before the final run. No failed launch is counted as timing evidence.


Run actual browser frame equivalence independently of audio graph timing:

```sh
AUDIO_ROUTE_RESEARCH=1 AUDIO_ROUTE_MODE=comparison \
  AUDIO_ROUTE_INPUT=.cache/audio-routes/corpus/latency-loop.f32 \
  mise exec -- pnpm exec playwright test tests/browser/audio-route-research.spec.ts \
  --project=chromium --project=firefox
```

Validation: the final shared quality gate passes 50 unit tests, formatting,
lint/types, configuration/supply-chain checks, three Zig fmt/AST checks,
native ABI/integrity, ESM/CJS builds and packed React 18.2/19.1 SSR/type consumers.
Measurement-policy tests pass 13 regressions, including retention of a negative
original baseline (36 minus -6 equals 42, not 36). Actual browser batch comparison
passes 2/2 contracts with zero bit differences. Production browser smoke passes
31 tests with 13 intentional skips; skipped opt-in experiments and existing
Firefox capability exclusions do not count as denoising qualifications.


To reproduce the existing-Worklet long follow-up, install
[`worklet-monitor.mjs`](../../../experiments/audio-routes/worklet-monitor.mjs)
after the native setup. It selects `current-next`, 600 seconds and 60 uniform
windows, and passively observes existing checked-kernel messages. It does not
warm an extra Worker or change the audio-thread guard. Attach the observed
values to the completed local result before export; do not treat the observer
as a full callback profiler or claim unmeasured process-memory stability.
