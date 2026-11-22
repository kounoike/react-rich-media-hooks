# AC3 remediation experiment

TASK-1.12 / PR #32; owner-authorized follow-up Dispatch `ctx_188a6f22c6ca`.
This is an implementation and qualification report, not a new Decision. Production
keeps the approved generic Zig/WASM + AudioWorklet, public API, local processing,
original-track fallback and session resource ownership. The 40 ms added-latency
criterion, 1000 ms preparation deadline and two-consecutive-render-budget guard
are unchanged. The SIMD128 candidate is not adopted or packaged.

## Method and controls

`audio-ac3.spec.ts` records producer-labelled, exact 48,000-frame windows sampled
uniformly at 16 kHz. Each phase warms for one second. A bounded, recycled pool
transfers paired reference/observed samples. Measurement phase and sequence are
stamped in the Worklet, never inferred from message arrival. Session/output
transitions are recorded against that context's sample frame. Discontinuous,
low-energy, nonfinite, backpressured and low-correlation windows are rejected;
transition windows have a 256-frame exclusion margin. Any fallback disqualifies
the whole RNNoise phase, even when earlier processed windows exist. Original
fallback can demonstrate liveness but never qualifies processed latency.

Known 0/30/60 ms delays in the collector context validate the correlation scale
before interpreting original-track, pass-through runtime, pass-through plus
1440 samples, or actual RNNoise results. Both native phases use the unchanged
strong tier (wet=1), avoiding an aligned dry signal dominating the correlation. Each accepted window has exactly 16,000
samples and 48,000 source frames. Nearest-rank percentiles do not interpolate
latency. Incremental latency subtracts the original-track median. These are
synthetic headless loopbacks, not physical microphone-to-speaker qualification;
short correlated windows are not independent device trials.

The profile Worklet runs 80 warm-up model frames then 240 measured frames,
one per 480 audio samples. It separates raw `engine_process`, checked/copying
kernel calls and the optimized in-place kernel path. Callback timings include
its diagnostic input preparation, not the full production graph. The profile
intentionally bypasses the production overload guard to observe compute; this
does not demonstrate that such processing is safe for rendering. Timers are
reported per browser and can be coarse. Isolated copy/mono/validation batches
run after timed callbacks; they do not enter callback budget statistics.

A diagnostic-only constructor substitution supplies either the approved generic
module or candidate at the private Worklet boundary. It does not provide a
public engine selector and does not bypass production verification in shipped
code. A controlled constructor rejection checks original-output preservation;
it is not a test on a real browser without SIMD support.

## Evidence before optimization

Both browsers passed known-delay calibration with zero error in accepted
windows. One Chromium control window spanned 48,003 frames and was rejected,
not rounded into an exact second. The initial strict harness assertion found
that discontinuity; the analyzer retains it as an exclusion.

Chromium original-track median was 12 ms. Even the graph pass-through without
RNNoise added 64.6875 ms (total 76.6875 ms); the same graph plus 30 ms explicit
delay measured 110 ms total. Generic processing produced some 112.6875 ms
windows then overloaded, so whole-phase processed qualification is rejected.
SIMD's short phase added 88 ms, already above 40 ms. Firefox pass-through added
0 ms and the explicit 30 ms control measured 30 ms, but both native variants
fell back before stable processed windows.

Raw generic native p50/p95/p99/max was 1/1/1/1 ms in Chromium and
5/6/11/15 ms in Firefox. Raw SIMD was 1/1/1/4 ms and 5/7/10/15 ms respectively.
Firefox had 241/901 callback budget exceedances in each raw profile; its
2.667 ms quantum cannot accommodate this native inference. Guarded production
fallback is observed separately. A fast raw Chromium native call does not
eliminate the measured media-bridge latency.

## Scoped optimization

The Worklet now fills its instance's preallocated native frame directly,
eliminating two 480-sample boundary copies. The private copying kernel entry
still works. A mono input bypasses the generic multi-channel averaging loop,
preserving signed-zero behavior. Existing model frames, delayed dry mixing,
finite/memory guards, fault telemetry, deadlines and ownership remain unchanged.
An actual-native 80-frame regression requires exact equality between borrowed
and copied buffers; existing 128/192-quantum and mixing tests remain in force.

The isolated 100,000-round-trip copy batches cost about 6 ms in Chromium and
4 ms in Firefox, versus effectively submillisecond direct reads. This is a
small avoidable boundary cost, not the dominant native or end-to-end cost.
Native/copy-call profiles do not identify an individual upstream RNNoise function
hotspot. A function-level native attribution remains unknown; no matrix/math
algorithm was changed from speculation. Validation-loop results varied across
browsers and batches, so finite-sample
validation was retained. There is no evidence-backed native-algorithm or guard
change within this scope. No speculative rewrite was added.

## SIMD build candidate

`mise exec -- node scripts/experiment-audio-simd.mjs` rebuilds the generic
artifact byte-for-byte first and verifies the same pinned source/model archive
hashes. It then adds exactly `-mcpu baseline+simd128` to Zig 0.15.2's
`-target wasm32-wasi` production-equivalent build, writing only ignored
`.cache/audio-experiment/` outputs. No relaxed SIMD, alternate engine, new native
source or production artifact replacement is used. Named, unstripped diagnostic
twins expose the target feature sections; the stripped measured modules omit
them. The generic default features are unchanged except for `+simd128` in the
candidate. Pinned RNNoise `src/vec.h` selects AVX/SSE/NEON or portable code; there
is no explicit WASM SIMD specialization in that source (see the
[pinned vector dispatch](https://github.com/xiph/rnnoise/blob/904a876dce1f9ab8860c0a5000ed151f9f6eef58/src/vec.h#L38-L48)). A target flag alone
therefore does not imply that its recurrent kernels were usefully vectorized.

Generic: 5,579,171 bytes / gzip 5,041,787; candidate: 5,592,233 / 5,045,826.
Both instantiate without host imports and retain fixed 8 MiB memory / 256 KiB
stack. Candidate SHA-256:
`3dccaf732681036ad8b2cc70ed5cb6f0ad6c06dab7f34f6a9060b9416b311da3`.
See the build record for exact input identities and features. SIMD would add a
runtime compatibility requirement and another asset/distribution choice;
neither is approved or silently introduced by this experiment.

## Accepted post-optimization measurements

The fresh-server run passed both browser measurement contracts. All accepted
0/30/60 ms controls again had zero error. The deployed generic artifact and
both served diagnostic modules are identified in the environment/report files.
Each native phase requested 60 one-second windows; the first, shorter reference
probe is retained separately and is not presented as an equal-duration A/B.

| Browser/path | Added p95 versus original | Processed qualification |
| --- | ---: | --- |
| Chromium graph pass, no RNNoise | 56.625 ms | Diagnostic graph only |
| Chromium graph pass plus 30 ms | 78.000 ms | Diagnostic graph only |
| Chromium generic RNNoise | Rejected | 51 stable windows at 114 ms total lag, then overload/fallback |
| Chromium candidate SIMD128 | 90.625 ms | 60 stable probe windows; exceeds 40 ms |
| Firefox graph pass / plus 30 ms | 0 / 30 ms | Diagnostic controls only |
| Firefox generic / SIMD128 | Rejected | Both used original fallback; zero qualified processed windows |

Chromium original median was 20.6875 ms; Firefox was 0 ms. Cross-context
buffering varies between graph instances/runs. The earlier stale-profile run's
latency observations (generic 101.375 ms and SIMD 86 ms added p95) are not used
for an in-place optimization claim. Neither this sequence nor the fixed order
isolates a causal SIMD latency benefit. Even the no-RNNoise graph exceeds the
40 ms criterion on this Chromium reference route. This is evidence against an
achievable gate here, not a universal browser lower bound.

Wall-clock milliseconds around native/checked calls, 80 warm-up + 240 measured
frames per cell, using `Date.now` in these Worklets:

| Browser | Variant/call | p50 | p95 | p99 | max | Callback budget exceedances |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Chromium | generic raw | 1 | 1 | 1 | 2 | 0/901 |
| Chromium | generic copying | 1 | 1 | 2 | 2 | 0/901 |
| Chromium | generic in-place | 1 | 1 | 2 | 4 | 2/901 |
| Chromium | SIMD raw | 1 | 1 | 1 | 2 | 0/901 |
| Chromium | SIMD copying | 1 | 1 | 1 | 2 | 0/901 |
| Chromium | SIMD in-place | 1 | 1 | 1 | 2 | 0/901 |
| Firefox | generic raw | 5 | 8 | 11 | 15 | 241/901 |
| Firefox | generic copying | 5 | 6 | 10 | 13 | 241/901 |
| Firefox | generic in-place | 5 | 8 | 15 | 16 | 241/901 |
| Firefox | SIMD raw | 5 | 8 | 12 | 16 | 241/901 |
| Firefox | SIMD copying | 5 | 7 | 10 | 12 | 241/901 |
| Firefox | SIMD in-place | 5 | 6 | 11 | 16 | 241/901 |

The 901-callback sample starts at the warm-up boundary and includes the callback
completing the 80th warm-up frame; the engine distribution excludes all 80
warm-up frames. Thus 241 callback exceedances is not a count of 241 measured
engine calls. All callbacks have a 2.667 ms render budget; the raw native distributions must
not be confused with full-graph deadlines. Coarse, wall-clock measurements
include scheduling effects. No p95 native gain from the boundary optimization
is established at this resolution. The purpose of retaining the optimization
is fewer bounded operations with exact output equivalence, not a claimed
latency fix. Post-timing microbench medians were 4–5 ms for 100,000 copy round
trips and 0 ms at this timer resolution for direct access. Mono reference
batches took 5–20 ms per 4000 frames versus 1–5 ms on the short path. Full batch
samples, tails and browser state history remain in the JSON, without trimming.

### Quality and compatibility evidence

Each browser executed both modules. Generic and SIMD batch output matched
bit-for-bit over 236,160 identical local PCM samples (zero max/RMS difference,
all finite). Separate 36-cell offline runs per artifact had zero difference in
attenuation, STOI and reference-error SNR metrics; all cells met the existing
provisional gates with zero clipping. The three-clip/synthetic-noise limitation
and absent representative listening/live-browser quality qualification remain.
This evidence does not promote a SIMD asset or qualify processed continuity.

Controlled Worklet-constructor rejection in both browsers returned failed
setup, preserved the exact original live track and did not reacquire capture.
This tests the existing failure contract, not a real legacy browser with SIMD
disabled. Old-browser feature gating remains unqualified; no compatibility
promise or fallback contract is changed.

### Sustained output and cleanup

The generic production module then ran sequential ten-minute trials in both
browsers, with 20 ms main-thread busy work approximately every 250 ms and
explicit level updates/retries each minute. No repository build or competing
benchmark ran during collection. Both measurement/cleanup contracts passed.

| Browser | Wall duration | Downstream samples | Active/degraded polls | Missing input/nonfinite | Zero quanta |
| --- | ---: | ---: | ---: | ---: | ---: |
| Chromium | 600.171 s | 28,800,000 | 1747 / 473 | 0 / 0 | 131 |
| Firefox | 600.160 s | 28,800,000 | 0 / 2219 | 0 / 0 | 0 |

Each acquired capture once. The application clone of the initial original
output remained live after session disposal; the session-owned original track
ended and the analysis context closed. Initial setup calls took 151.4–214 ms
in Chromium and 130–183 ms in Firefox. Subsequent update rows use `ms:0` as an
unmeasured marker, not a zero-latency claim.

Chromium faulted and returned to original output several times. Firefox briefly
re-entered active after explicit retries, then degraded before every regular
poll. Both happened to exit after an explicit retry with processed output;
that final snapshot does not establish sustained processing. Poll counts are
observations, not duration-weighted or per-sample state proportions. Zero
quanta may be intentional suppression or other silence; the probe cannot
identify every upstream underrun or audible artifact. These are sustained
rendering/fallback and cleanup results, not uninterrupted denoised speech or
physical/live quality qualification. Full transitions, settings and counters:
[`audio-endurance-remediation-2026-11-20.json`](audio-endurance-remediation-2026-11-20.json).

## Recommendation and remaining acceptance

Keep the generic production artifact and these small boundary optimizations;
do not adopt SIMD128 from this evidence. It adds 13,062 bytes (4,039 gzip bytes)
and a SIMD compatibility requirement without removing Firefox budget misses
or meeting Chromium added latency. The approved architecture's current
reference route has no evidence-backed path to 40 ms through these optimizations.
No further deadline extension, guard weakening or speculative algorithm/graph
rewrite is justified in this scope.

The realistic next candidate is **fallback-only qualification for these
reference browser/device cells**: original standard media, observable degraded
or failed state, one acquisition, independent clones and owned cleanup. Its
benefit is predictable recovery; its cost is that noise reduction is not
qualified in those cells. This candidate is recorded for owner consideration,
not adopted as a new product/support policy. No new task or Decision is created.
AC3 stays open and PR #32 stays Draft. Representative quality/listening,
physical-device latency and uninterrupted denoised continuity remain unproved.

## Reproduction

Use the exact toolchain and corpus procedure in `docs/audio-processing.md`.
Build before starting the measurement server. Do not rebuild or run competing
benchmarks during latency/profile collection. The operation-only Vite server
used `hmr:false, watch:null`; otherwise generated HTML trace/report files can
reload active measurement pages. This setting is not shipped or a workflow
change. Restart that server after every source/build edit: disabling the watcher
also disables module-cache invalidation. The first optimized probe was discarded
for in-place profile claims after stale source delivery was detected. The final
probe requires a diagnostic protocol marker and the borrowed-frame kernel in the
served code, records both served-module digests and fails on a stale handshake.
Chromium and Firefox run sequentially with one Playwright worker.

```sh
mise exec -- node scripts/experiment-audio-simd.mjs
mise exec -- pnpm build
# Start a persistent Vite server with hmr:false, watch:null on 127.0.0.1:4173.
AUDIO_AC3=1 AUDIO_AC3_WINDOWS=60 mise exec -- pnpm exec playwright test \
  tests/browser/audio-ac3.spec.ts --project=chromium --project=firefox \
  --output=/tmp/audio-ac3 --reporter=json > /tmp/audio-ac3.json
# Decode each audio-ac3.json attachment to a separate raw JSON file.
uv run --no-project --with numpy==2.3.5 --with scipy==1.16.3 \
  python scripts/summarize-audio-ac3.py /tmp/chromium.json /tmp/firefox.json
uv run --no-project --with numpy==2.3.5 --with scipy==1.16.3 \
  python -m unittest discover -s tests -p 'test_audio_latency_analysis.py'
AUDIO_ENDURANCE=1 mise exec -- pnpm exec playwright test \
  tests/browser/audio-endurance.spec.ts --project=chromium --project=firefox
# Optional offline SIMD corpus repeat, never changes the packaged engine:
AUDIO_EXPERIMENT=simd128 AUDIO_QUALITY_OUTPUT=.cache/audio-experiment/quality-simd128.json \
  uv run --no-project --with numpy==2.3.5 --with scipy==1.16.3 \
  --with soundfile==0.13.1 --with pystoi==0.4.1 python scripts/measure-audio-quality.py
```

Keep raw paired audio out of Git. Committed summaries retain per-window frame,
state, lag, correlation, rejection and provenance evidence. The measurement
collector's duration bound scales with requested windows; production setup and
render deadlines remain unchanged.
