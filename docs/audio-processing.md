# Experimental audio processing

TASK-1.12 uses Decision-10's project-built RNNoise 0.2 and Decision-9's private
backend boundary. Additional engines remain TASK-1.26 (evaluation) and
TASK-1.27 (an approved implementation). No public engine selector, generic
plugin SDK or stable common WASM ABI is provided.

Decision-11 additionally authorizes a private, default-off raw-audio Worker
qualification route using the same C engine. Normal builds retain Worklet
processing; enabled builds retain it for ineligible inputs. See the
[Worker implementation, gating and current qualification](measurements/audio/private-worker.md).
This is not a public selector or a new browser-support promise.


## Build and provenance

Normal JavaScript builds use the tracked native asset; package consumers and
ordinary CI builds do not need a native compiler. `pnpm build` checks its
digest, host imports, private ABI, fixed memory and basic processing before
bundling it. `pnpm package:check` checks packed ESM/CJS/SSR/type consumers.
The package includes `dist/assets/RNNOISE-NOTICES.txt` and
`dist/assets/rnnoise-build.json` alongside the model-bearing WASM.

For an independent source rebuild, install Zig 0.15.2 (pinned in `mise.toml`)
and run:

```sh
pnpm audio:rebuild
pnpm audio:check
zig fmt --check native/rnnoise/adapter.zig
```

The rebuild downloads digest-verified archives into `.cache/audio-native`:
RNNoise commit `904a876dce1f9ab8860c0a5000ed151f9f6eef58` (v0.2) and the
official default model `0b50c45`. It executes no upstream download/build
scripts. Archive bytes, compiler version, C source list and output digest are
recorded in `native/rnnoise/manifest.json`. The rebuild must match the tracked
asset byte for byte. `--write` can restore that same reviewed artifact; changing
upstream inputs or output digest requires a reviewed manifest change.

Zig's WASI compiler sysroot supplies standard C/math implementations at build
time. The final module imports **no host functions** and requires no WASI
runtime. It has 8 MiB fixed linear memory, a 256 KiB stack, preallocated engine
state and one reusable 480-sample PCM buffer. Each processor owns a separate
instance. `native/rnnoise/os_support.h` supplies only the `OPUS_CLEAR` memset
macro: upstream v0.2's portable vector header references an absent Opus header.
The upstream inference algorithm and model are retained.

The native WASM is 5,579,171 bytes; the entire module including its embedded
model compresses to 5,041,787 bytes with Node gzip (4.81 MiB). This is a transfer
estimate, not a model-only size or an assertion about your server's encoding.
The output digest is
`43acc555d5612d3bc59ac3dac5a387059fd33c473d3282f871c8c9475a854b56`.
Runtime preparation verifies that digest and the module's empty import list;
the worklet verifies its private ABI before initializing state. An asset served
from a stale version/cache fails verification rather than silently changing
the engine. Deploy and cache the package files as one versioned unit.

## Processing and lifecycle

The browser graph uses 48 kHz mono; Web Audio performs source-rate conversion.
The worklet handles variable render-quantum lengths with bounded 480-sample
model-frame staging. RNNoise v0.2 has additional analysis/synthesis delay.
The provisional dry/wet tiers align dry audio with that delay; tiers still
require corpus calibration. Neither a 10 ms model frame nor its compute time
is an end-to-end latency measurement.

At 48 kHz, a 128-sample rendering quantum has approximately 2.67 ms shared by
the audio graph. Two consecutive processed RNNoise frames observed above the
current quantum's budget trigger an overload fault and original-track fallback.
This is a conservative wall-clock heuristic; Worklet timer precision varies,
and it cannot observe every missed deadline or prove continuity. Startup
retains original media until usable processed output and context activation
are ready. Readiness, timeout, cancellation and failures release only resources
owned by this processing session.

## Evidence and release limits

Local headless Chromium 151.0.7922.34 initialized the actual built-package
backend, produced non-silent finite audio and completed add/update/bypass/remove
with one microphone acquisition. An initial source preparation/activation run
took about 200 ms. Frame-processing p95 was about 1 ms in this local smoke;
timer resolution is coarse, and this is not added audio latency.

Firefox 153.0 also initialized and processed the module. A longer oscillator
probe measured approximately 5–7 ms per processed frame, exceeding the 2.67 ms
quantum. The corrected guard therefore exposes degraded original-media output
on this configuration rather than claiming supported real-time processing.
A SIMD compiler experiment did not establish an improvement and is not shipped.

The automated tests cover the real model, independent state, sample framing
across 128/192-sample quanta, delayed dry mixing, overload faults, preparation
cancellation and cleanup. Browser tests require actual processed audio in the
Chromium reference cell; corrupted WASM and a self-hosted CSP exercise failure
and deployment paths. Other browser/device cells are unqualified.

Still required for a support/release claim: licensed representative speech and
noise, at least 6 dB improvement with no more than 0.03 intelligibility loss,
listening review, calibrated tiers, baseline-relative end-to-end p50/p95 and
tails, warm-start evidence, and ten-minute continuity under UI/CPU contention.
Do not infer these from finite samples, model provenance, fake capture or
short processor timings. Missing network/cache assets must use documented
fallback; no automatic offline-cache installation is supplied.

Primary sources:

- [RNNoise v0.2 source](https://github.com/xiph/rnnoise/tree/904a876dce1f9ab8860c0a5000ed151f9f6eef58)
- [Pinned model selection](https://github.com/xiph/rnnoise/blob/904a876dce1f9ab8860c0a5000ed151f9f6eef58/model_version)
- [Zig 0.15.2 WebAssembly](https://ziglang.org/documentation/0.15.2/#WebAssembly)
- [AudioWorklet and WASM preparation](https://developer.chrome.com/blog/audio-worklet-design-pattern/)

## Restart measurements (2026-11-20)

The implementation was reconciled onto `origin/main` at `8616866`, retaining
its security-patched JavaScript dependencies and video processing. Decisions
8, 9 and 10 restore the previously approved choices; their Context sections
identify the original workspace and approval provenance. Historical deferred
TASK-1.26/1.27 records remain in that retained workspace and have not been
started or replaced by new engine work here.

New regression coverage includes invalid-option disposal, cancelled overlapping
setup returning to the last settled state, stale setup after remove/stop/dispose,
rendering exceptions, ended outputs, startup timeout, and an AudioContext which
stops running after activation. An interrupted context causes observable
original-media fallback. Reapply the effect from a client action to retry;
there is no automatic context resume or alternate-engine substitution.

### Reproducible offline quality smoke

The external fixture manifest is
[`audio-quality-sources.json`](../tests/fixtures/audio-quality-sources.json).
It identifies three CC-BY-4.0 LibriSpeech development clips by archive member
and SHA-256 with attribution to the corpus authors. No speech recordings are
committed to this repository or uploaded for measurement. Downloads happen
only when explicitly running this measurement command:

```sh
python3 scripts/fetch-audio-quality-corpus.py
uv run --no-project --with numpy==2.3.5 --with scipy==1.16.3 \
  --with soundfile==0.13.1 --with pystoi==0.4.1 \
  python scripts/measure-audio-quality.py
```

Python measurement packages are isolated tooling, outside package dependencies.
The runner verifies input identities, resamples to 48 kHz, normalizes speech RMS
to 0.07, adds one second of noise before/after speech, and mixes seeded white
noise or synthetic bursts plus 120 Hz hum at 0 and 10 dB SNR. The reviewed WASM
processes each input independently. Scoring removes the native model's fixed
960-sample analysis delay; it does not measure browser scheduling or the
Worklet's extra 480-sample staging delay. STOI compares the speech interval
with the clean reference; noise attenuation uses a known speech-free tail.
Reference-error SNR includes speech distortion and is reported separately.

| Tier | Wet mix | Minimum tail attenuation | Worst STOI change | Numeric cells passing |
| --- | ---: | ---: | ---: | ---: |
| light | 0.55 | 6.935 dB | +0.0104 | 12/12 |
| standard | 0.75 | 12.039 dB | +0.0105 | 12/12 |
| strong | 1.00 | 63.948 dB | +0.0091 | 12/12 |

The earlier light mix of 0.45 could not reach 6 dB even with a perfectly silent
wet noise signal: its remaining dry gain of 0.55 limits attenuation to 5.19 dB.
The private light tier was adjusted to 0.55 and remeasured. These are initial
calibration cells, **not calibrated attenuation promises**. In particular, very
large tail attenuation on strong does not measure speech preservation. Full
results, exact tool versions and clip identities are in
[`audio-quality-2026-11-20.json`](measurements/audio/audio-quality-2026-11-20.json).

All three clips are from one speaker and are limited to eight seconds each;
the two noises are synthetic. These cells cannot qualify diverse speakers,
languages, reverberation, transients, real microphones or interaction with
browser AEC/AGC. A representative licensed corpus and blinded human listening
remain required before quality/support claims. The runner does not evaluate
perceived artifacts or substitute for listening review.

### Optional sustained and paired-loopback probes

Build once before starting any browser probe. Keep `dist/` unchanged during
measurements: rebuilding changes dynamically imported chunk names and Vite can
reload active pages. Use one persistent server so one test runner cannot stop
a server another runner is using:

```sh
pnpm build
pnpm exec vite --host 127.0.0.1 --port 4173 --strictPort
# In a second terminal:
AUDIO_ENDURANCE=1 pnpm exec playwright test tests/browser/audio-endurance.spec.ts --project=chromium
```

This opt-in probe renders for ten minutes with a 20 ms main-thread busy period
approximately every 250 ms, updates/retries the effect once a minute, records
processor states and downstream sample counters, and checks one acquisition,
clone lifetime and final cleanup. Downstream zero quanta can be intentional
noise suppression; counters do not distinguish upstream underruns from silence.
A run which falls back qualifies fallback endurance only, not ten minutes of
uninterrupted denoised speech.

For the optional latency probe, generate local PCM from the first fixture:

```sh
ffmpeg -y -i .cache/audio-quality/2277-149896-0026.flac \
  -ar 48000 -ac 1 -f f32le .cache/audio-quality/speech.f32
AUDIO_MEASURE=1 pnpm exec playwright test tests/browser/audio-latency.spec.ts \
  --project=chromium --project=firefox
```

The probe routes a local speech loop through an original-track baseline and
then the processed standard track, sampling reference and loopback together at
16 kHz. It records the browser-reported base latency and the processor's final
state. This is a synthetic loopback using an application-generated track in
the capture fixture, not a physical microphone-to-speaker measurement. Reject
processed latency qualification if the processor has fallen back. Physical
end-to-end p95 and broader startup/continuity qualification remain open.

The paired-loopback run on 2026-11-20 measured a Chromium original-track median
of 21.3125 ms and an incremental processed p50/p95 of **76.6875 ms** across the
accepted one-second windows. The browser reported 11.625 ms base latency. This
misses the 40 ms incremental target in this synthetic configuration. Firefox
became degraded through its render-budget guard, so a processed latency number
is rejected for that cell. Window correlations, estimates and exclusions are in
[`audio-loopback-2026-11-20.json`](measurements/audio/audio-loopback-2026-11-20.json).

`scripts/summarize-audio-latency.py` scores a decoded `audio-loopback.json`
Playwright attachment: normalized cross-correlation over 0–300 ms, rejection
below 0.3 correlation, subtraction of the median original-track lag, and an
upper-order-statistic p95. At least three baseline and five processed windows
plus a still-active processor are required. These short, correlated windows
are an engineering probe, not enough independent physical trials for release
qualification. `AUDIO_LOW_LATENCY=1` optionally injects a numeric zero latency
hint into the measurement fixture for comparison; it does not alter the
shipped runtime or imply that browsers must honor that hint.

The optional zero-latency-hint experiment lowered the reported Chromium context
baseline to 2.667 ms, but measured incremental loopback p95 was **82.6875 ms**
(original-track median 12 ms). It did not demonstrate an improvement over the
40 ms target and is **not adopted**. See
[`audio-low-latency-hint-2026-11-20.json`](measurements/audio/audio-low-latency-hint-2026-11-20.json).
Further latency work needs to distinguish the additional cross-context media
bridges from native frame/analysis delay with an agreed reference-device route;
these measurements do not justify replacing the approved processing backend.

The ten-minute Chromium run (before rebasing onto the hk-gate integration)
completed 600.073 seconds with one acquisition and five initial graph setups
of 147.8–203.2 ms. It recorded 28,752,000 downstream samples, no missing-input
quanta or nonfinite samples, and 209 all-zero quanta. Status polling observed
1,779 active and 439 degraded intervals; explicit minute updates retried the
effect after fallback. The final output clone remained live after session
disposal, the original track ended, and the analysis context closed. This is
sustained processing/fallback evidence rather than uninterrupted denoised
speech: the zero quanta are not classified as artifacts or underruns. See
[`audio-endurance-2026-11-20.json`](measurements/audio/audio-endurance-2026-11-20.json)
and the [environment record](measurements/audio/audio-environment-2026-11-20.json).

After rebasing onto main `5c81f03`, paired-loopback checks ran again on the
reconciled implementation. Both Chromium and Firefox initialized the native
engine and then fell back through the render-budget guard during this run;
processed latency estimates are rejected for both. See
[`audio-loopback-post-rebase-2026-11-20.json`](measurements/audio/audio-loopback-post-rebase-2026-11-20.json).
This reinforces the lack of a qualified real-time browser/device cell rather
than replacing the earlier active Chromium latency measurement. Browser smoke
accepts only successful native execution or its specific render-budget fallback
in the Chromium cell; unrelated glue/asset failures still fail that regression.

The first GitHub Firefox CSP run reached the existing one-second startup
deadline rather than a render-budget fault. That does not by itself identify
CSP blocking. The fixture now clicks an explicit activation control, asserts
zero `securitypolicyviolation` events and a live input, and requires original
output if Firefox returns a bounded startup failure. Unknown asset/glue errors
still fail. No timeout is extended and no warm-start qualification is inferred
from fallback; the underlying startup/activation cause remains unqualified.

## AC3 remediation and current qualification

The [controlled follow-up report](measurements/audio/ac3-remediation.md)
separates exact one-second/known-delay controls, no-RNNoise graph delay,
native-call/callback profiles and processor transitions. The final fresh-server
Chromium generic trial overloaded after stable processed windows, so its
whole-trial processed p95 is rejected; the unadopted SIMD candidate measured
90.625 ms added p95, above the unchanged 40 ms criterion. Firefox fell back
for both variants. The copy/mono optimization retains exact model output;
it does not establish a qualified real-time browser/device cell.

The production artifact remains generic WASM, with the same API, startup
bound, render-budget guard and original-output fallback. SIMD128 is only an
ignored-cache experiment; no asset selector or changed browser requirement is
shipped. Fallback-only qualification is a candidate for owner review, not an
accepted support policy. TASK-1.12 AC3 remains open and PR #32 remains Draft.
The controlled report and committed before/after summaries are the current
engineering evidence; older loopback reports above are historical probes.

The post-optimization ten-minute trials passed their rendering/fallback and
cleanup contracts in both browsers: 28,800,000 downstream samples each, one
capture acquisition, no probe-reported missing-input or nonfinite samples,
an independently live original-output clone after disposal, ended owned input
and closed analysis context. Chromium recorded 1747 active/473 degraded polls;
Firefox recorded 2219 degraded polls with brief active retries between polls.
These observations qualify neither uninterrupted denoised speech nor the
40 ms budget. See the controlled report for zero-quanta and polling limits.

## Minimum Zig compute-kernel prototype

The next [Zig kernel experiment](measurements/audio/zig-kernel-prototype.md)
ports RNNoise affine dense/sparse computation while retaining the C model,
feature extraction, FFT, activation and GRU orchestration as the oracle.
Separate graph-only and native/actual-host runs retain the original-relative
added-latency definition, including graph cost, and the unchanged 40 ms target.

The scalar port did not establish a practical improvement. Explicit SIMD
reduced Firefox raw native p95 from 7 to 3 ms, but still exceeded the 2.667 ms
render budget and fell back in the actual host. Chromium SIMD added p95 was
89.375 ms. Both variants matched C bit-for-bit in the tested frame sequences
and browser batch samples; all 36 limited quality cells per artifact had
identical metrics. The prototype is rejected as a production/AC3 solution and
remains opt-in, outside packaged assets; the current C WASM is unchanged.
The owner has rejected fallback-only adoption or closure. Further profile-selected
Zig/SIMD and disposable Worker/SAB/raw-track trials are documented in
[the current route research](measurements/audio/route-prototypes.md). The C
production artifact and Decision-10 remained in force at that research checkpoint;
no public API or Worker route had been adopted. Decision-11 subsequently
authorized the default-off Worker direction described above. AC3 and Draft
PR #32 remain open for manual review.


The expanded research preserves the C production engine. In the additional
native-host diagnostic, raw C measured40 ms added p95 across60 windows/600 stable
seconds (no margin, three unclassified zero quanta); raw SIMD measured42 ms.
A short SIMD Worklet screen reached39.3125 ms, but its required long follow-up
measured81.3125 ms despite checked-kernel p95 1 ms and no guard fallback. These
are experimental/embedding results, not release support. The broader120-cell
quality corpus retains one strong-level numeric failure, and human listening
is PENDING. The [current comparison](measurements/audio/route-prototypes.md)
records the alternatives before Worker authorization. Decision-11 now permits
the gated C Worker implementation; SIMD adoption and release qualification
remain unapproved, and fallback-only closure remains rejected by the owner.
