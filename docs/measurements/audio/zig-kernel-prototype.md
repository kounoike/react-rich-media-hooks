# Experimental Zig RNNoise affine kernels

Owner-authorized TASK-1.12 follow-up, Dispatch `ctx_ec9fc37c5590`, existing PR #32.
This experiment does not replace the production C+Zig artifact or adopt a new
engine, API, compatibility requirement, Decision or fallback policy.

Historical report: the owner subsequently rejected fallback-only adoption or
closure. See the [current route research](route-prototypes.md) for the authorized
next phase and current disposition; the measurements below remain unchanged.

## Boundaries and unchanged acceptance

Measurement A (`AUDIO_AC3_STAGE=graph`) runs the known 0/30/60 ms controls,
original-track baseline, no-RNNoise processor graph and graph plus 1440 samples.
It runs no RNNoise inference during collection. Measurement B
(`AUDIO_AC3_STAGE=compute`) separately runs controls and its own original-track
baseline, followed by actual C generic, Zig generic and Zig SIMD host paths,
then isolated raw/kernel/callback timing. Both use identical local 48 kHz mono
speech and producer-labelled one-second windows. Strong/wet-only output avoids
a dry component dominating correlation.

**Added latency = processed loopback lag minus that run's original-track median.**
It includes the processor's graph, model analysis and 480-sample staging delay.
The no-RNNoise graph cost is diagnostic evidence, not an amount deducted to meet
the unchanged 40 ms criterion. A new regression requires a 90 ms processed lag
and 20 ms original lag to produce 70 ms added latency even with a 60 ms graph
control; subtracting graph delay would incorrectly pass at 30 ms.

The calibration, discontinuity/backpressure and state/transition exclusions are
unchanged. Original fallback never qualifies a processed p95; later fallback
rejects the whole phase. The fixture still uses the actual production host,
unchanged 1000 ms preparation bound and two-consecutive-render-budget guard.
The private constructor substitution chooses prototype modules only in this
opt-in test; no selector or inference bridge is added to runtime code.

These are headless WSL synthetic loopbacks, not physical microphone-to-speaker
or broad browser/device qualification. Context buffering and fixed test order
limit causal comparisons of small end-to-end changes. Raw native wall-clock
measurements are not added latency. Worklet `Date.now` can be coarse and include
scheduling stalls; a zero-millisecond sample is not zero computation.

## Minimum port and oracle

`experiments/rnnoise-zig/kernels.zig` implements RNNoise's `compute_linear_c`
affine operation: dense column-major float multiplication, sparse 8x4 float
blocks, bias and GRU diagonal terms, plus the corresponding int8 paths. The
pinned default model exercises four dense-float and six sparse-float calls per
480-sample frame. Its int8 paths are not exercised by that model; this experiment
does not qualify alternate model layouts.

The model, feature extraction, pitch/FFT/synthesis, activation approximations
and GRU orchestration remain the pinned C implementation. This is a hybrid
compute-kernel prototype, not a full RNNoise rewrite or a wrapper-only change.
The builder verifies both upstream archives, renames only the C affine function
definition in a temporary source copy, and resolves unchanged C callers to the
Zig symbol. The production source, manifest and WASM are never written.

Both variants use Zig 0.15.2, WASM32-WASI reactor linking and identical C `-O3`
inputs. Generic uses `-mcpu baseline` with scalar output lanes. SIMD uses
`-mcpu baseline+simd128` and explicit four-float output lanes; these are
independent rows, retaining each row's original accumulation order. Strict
floating arithmetic avoids FMA, relaxed SIMD and horizontal reduction changes.
All bytes are written under ignored `.cache/audio-zig/`; ordinary package builds
do not build or ship them. Derived source retains upstream BSD notices.

Both prototypes have no host imports, fixed 8 MiB memory and the same 256 KiB
stack setting/private frame ABI. The production generic digest remains
`43acc555d5612d3bc59ac3dac5a387059fd33c473d3282f871c8c9475a854b56`.

## Numerical and quality checks

The streaming comparison uses the C artifact as oracle with identical independent
state initialization and 480-sample inputs, without delay compensation or
correlation alignment. Both Zig variants are bit-exact for 492 speech frames
(236,160 samples) and 1000 mixed silence/impulse/voiced/seeded-noise frames
(480,000 samples); output and speech-probability differences are zero and memory
identity remains fixed. The stated experimental maximum normalized difference
1e-5 and RMS difference 1e-6 are not new compatibility/quality promises; the
observed result is zero, so tolerance is not hiding a regression.

Independent 36-cell offline runs per artifact reproduce identical attenuation,
STOI and reference-error metrics with no clipping, using the existing pinned
three-clip/synthetic-noise fixture. This remains one-speaker engineering smoke;
representative acoustic conditions, blind listening and live quality remain
unqualified. Browser batch comparisons and real-time output/state evidence are
reported separately from offline quality.

## Results and disposition

Both independent invocations passed 2/2 collection/fallback contracts. Accepted
known-delay controls had zero error in both browsers; this does not make the
performance gates pass. Each native phase requested 60 one-second windows.

Measurement A, no native inference during capture:

| Browser | Original median | No-RNNoise graph added p95 | Graph + 1440 samples added p95 |
| --- | ---: | ---: | ---: |
| Chromium | 21.3125 ms | 46.6875 ms | 86.6875 ms |
| Firefox | 0 ms | 0 ms | 30 ms |

Independent contexts have different media-buffer alignment: adding a 30 ms
buffer to a separately created Chromium graph need not increase observed lag
by exactly 30 ms. The direct known-delay controls validate the measurement
scale; cross-context buffering is part of the measured route and is not
subtracted or treated as a universal browser lower bound.

Measurement B, original-relative end-to-end added p95:

| Browser | C generic | Zig generic | Zig SIMD128 |
| --- | --- | --- | --- |
| Chromium | Rejected: later overload | Rejected: later overload | 89.375 ms; active 60 windows, exceeds 40 ms |
| Firefox | Rejected: original fallback | Rejected: original fallback | Rejected: original fallback |

Chromium's B baseline was 21.3125 ms. Its C phase had 29 accepted processed
windows at 146.6875 ms total lag before fallback; Zig generic had 26 at
99.3125 ms total lag. Neither gets a qualifying phase p95. Firefox had no
qualifying processed window in any native phase. All three modules compiled
and executed in both browsers, and browser batch outputs were bit-identical
over 236160 samples per module. Current execution is not broader compatibility
qualification, and the SIMD candidate adds a feature requirement not adopted
by the production artifact.

Isolated Worklet wall-clock timings in milliseconds, 80 warm-up plus 240
measured model frames; native = raw engine call, kernel = copying/checked
boundary, in-place = current owned-buffer boundary:

| Browser | Variant | Call | p50 | p95 | p99 | max | Callbacks over 2.667 ms |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: |
| Chromium | C | native | 1 | 1 | 2 | 3 | 2/900 |
| Chromium | C | kernel | 1 | 1 | 1 | 1 | 0/900 |
| Chromium | C | in-place | 1 | 1 | 1 | 1 | 0/900 |
| Chromium | Zig generic | native | 1 | 1 | 2 | 2 | 0/900 |
| Chromium | Zig generic | kernel | 1 | 1 | 2 | 2 | 0/900 |
| Chromium | Zig generic | in-place | 1 | 1 | 1 | 4 | 1/900 |
| Chromium | Zig SIMD | native | 0 | 1 | 1 | 1 | 0/900 |
| Chromium | Zig SIMD | kernel | 0 | 1 | 2 | 6 | 1/900 |
| Chromium | Zig SIMD | in-place | 0 | 1 | 1 | 2 | 0/900 |
| Firefox | C | native | 5 | 7 | 14 | 15 | 240/900 |
| Firefox | C | kernel | 5 | 7 | 12 | 19 | 240/900 |
| Firefox | C | in-place | 5 | 7 | 11 | 17 | 240/900 |
| Firefox | Zig generic | native | 5 | 7 | 8 | 9 | 240/900 |
| Firefox | Zig generic | kernel | 5 | 6 | 9 | 15 | 240/900 |
| Firefox | Zig generic | in-place | 5 | 6 | 10 | 16 | 240/900 |
| Firefox | Zig SIMD | native | 2 | 3 | 4 | 5 | 45/900 |
| Firefox | Zig SIMD | kernel | 2 | 3 | 6 | 2099 | 61/900 |
| Firefox | Zig SIMD | in-place | 2 | 3 | 4 | 5 | 46/900 |

The checked SIMD profile includes an unexplained 2099 ms wall-clock tail,
retained without trimming. Scheduling/GC/clock effects cannot be separated from
that interval by this timer; it is not attributed to a specific native function.
Profile callbacks include diagnostic input preparation, but exclude the separate
post-timing microbench; they are not a full production callback CPU profile.
The guard-free diagnostic profile observes costs even when real processing
would already have fallen back; actual host-state results above take priority.

| Artifact | Bytes | Node gzip bytes | Imports | Fixed memory |
| --- | ---: | ---: | --- | ---: |
| Retained C generic | 5,579,171 | 5,041,787 | none | 8 MiB |
| Zig generic prototype | 5,577,329 | 5,041,345 | none | 8 MiB |
| Zig SIMD prototype | 5,589,873 | 5,045,372 | none | 8 MiB |

**Reject this minimum port as a production/AC3 solution.** The SIMD affine
implementation produces a real partial compute improvement (Firefox raw p95
7 to 3 ms and fewer over-budget callbacks); it is not accurate to say that no
computation improved. However, generic Zig shows no decisive practical gain,
SIMD still exceeds the render budget and fails real Firefox processing, and
Chromium's graph/added latency remains above 40 ms. Exact limited numerical
quality does not overcome these runtime and support gaps. No production asset
is replaced and no compatibility/quality/deadline/fallback contract is relaxed.

The next realistic candidate is **fallback-only qualification for these
reference cells**, using the retained C version's documented original-media
recovery, with explicit owner approval before any support-policy adoption.
This is recorded as a candidate, not an accepted Decision or a newly completed
acceptance criterion. TASK-1.12 AC3 stays open and PR #32 stays Draft. A minimum
prototype and short synthetic runs do not qualify representative listening,
physical reference latency or uninterrupted denoised continuity.

Primary artifacts: [build](audio-zig-build-2026-11-21.json),
[frame oracle](audio-zig-frames-2026-11-21.json),
[graph controls](audio-zig-graph-2026-11-21.json),
[compute/actual host](audio-zig-compute-2026-11-21.json),
[quality comparison](audio-zig-quality-comparison-2026-11-21.json) and
[environment/source identity](audio-zig-environment-2026-11-21.json).

## Reproduction

Use the pinned toolchain and local licensed fixture preparation in
`docs/audio-processing.md`, then:

```sh
mise exec -- node scripts/experiment-audio-zig.mjs
mise exec -- node scripts/compare-audio-zig.mjs
# Before starting a persistent server, build the unchanged production package.
mise exec -- pnpm build
# Server: Vite on 127.0.0.1:4173 with hmr:false, watch:null.
# Restart after EVERY source/build change; the protocol/digest handshake rejects stale code.
AUDIO_AC3=1 AUDIO_AC3_STAGE=graph AUDIO_ZIG=1 mise exec -- pnpm exec playwright test \
  tests/browser/audio-ac3.spec.ts --project=chromium --project=firefox
AUDIO_AC3=1 AUDIO_AC3_STAGE=compute AUDIO_ZIG=1 AUDIO_AC3_WINDOWS=60 \
  mise exec -- pnpm exec playwright test tests/browser/audio-ac3.spec.ts \
  --project=chromium --project=firefox
# Each invocation uses one worker; no competing builds/benchmarks during capture.
# Decode audio-ac3.json attachments and summarize each stage independently:
uv run --no-project --with numpy==2.3.5 --with scipy==1.16.3 \
  python scripts/summarize-audio-ac3.py /tmp/chromium.json /tmp/firefox.json
# Repeat for generic (unset AUDIO_EXPERIMENT), zig-generic and zig-simd128:
AUDIO_EXPERIMENT=zig-simd128 AUDIO_QUALITY_OUTPUT=.cache/audio-zig/quality-zig-simd128.json \
  uv run --no-project --with numpy==2.3.5 --with scipy==1.16.3 \
  --with soundfile==0.13.1 --with pystoi==0.4.1 python scripts/measure-audio-quality.py
```

Raw audio stays outside Git. Reports retain module/input/source identities,
frame/state exclusions, full distributions and setup/fallback outcomes. The
profile protocol now excludes the callback completing warm-up frame 80, so
128-sample runs cover exactly 900 measured callbacks/240 native frames; older
901-callback boundary counts are not relabelled as improved performance.
