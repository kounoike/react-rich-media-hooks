# Private raw-audio Worker qualification

Decision-11 records the owner's approval to implement this private direction;
it supersedes only the exclusive Worklet/no-extra-Worker clauses of Decisions
10/8. This is a default-off engineering route, not release, SIMD, public API,
browser-support or merge approval. TASK-1.12 remains In Progress and PR #32 Draft.

## Build and eligibility

Normal `pnpm build` eliminates the raw adapter import and Worker JavaScript.
A repository qualification build uses:

```sh
VITE_RNNOISE_RAW_WORKER=1 mise exec -- pnpm package:check
# Restart the frozen Vite server after building, before any measurement.
AUDIO_RAW_BUILD=1 mise exec -- pnpm exec playwright test \
  tests/browser/audio-raw-worker.spec.ts --project=chromium --project=firefox
```

The private build constant is not an effect option or consumer engine selector.
Enabled builds select raw processing only for live audio tracks whose actual
settings declare 48 kHz and one channel, with Window audio track processor,
generator and Worker constructors. Unknown settings, other rates/channels and
missing constructors retain the current Worklet and its resampling/downmix.
Before publication, confirmed Worker AudioData or endpoint/stream-transfer
capability rejection disposes the unused raw resources and retains Worklet.
Asset/integrity/CSP/initialization failures, active format faults and processing
failures use observable original-media fallback. They do not silently retry
a different processing route. Existing explicit consumer retries remain.

This uses transferable streams, not SharedArrayBuffer. Raw processing is tested
without isolation; no COOP/COEP or SAB requirement is introduced for this path.
No SAB route is enabled. A future SAB implementation would require both
`crossOriginIsolated === true` and `SharedArrayBuffer`, with separately approved
scope and qualification. Constructor presence alone is insufficient evidence:
Window audio extensions differ from the current [W3C transform draft](https://www.w3.org/TR/mediacapture-transform/),
which specifies video, and [WebCodecs](https://www.w3.org/TR/webcodecs/)
does not require any particular codec or deployed transform extension.

Enabled builds distribute one content-hashed module Worker, using the unchanged
C RNNoise WASM SHA-256 `43acc555d5612d3bc59ac3dac5a387059fd33c473d3282f871c8c9475a854b56`,
ABI 1, no host imports and fixed 8 MiB memory. Hash verification and compilation
remain outside inference. The Worker reuses the existing native kernel; no
model, arithmetic, SIMD or C source changes. Add the same-origin Worker asset to
`worker-src` CSP for this qualification build. Default builds need no such asset.

## Framing, readiness and queue bounds

The UA input queue requests four AudioData chunks; each acquired chunk must be
mono/48 kHz and contain 1–960 frames. Other formats fail observably rather than
allocate arbitrary storage. Four chunks are **not** four native frames: the
requested cap can represent up to 80 ms, in addition to UA-hidden queues. It
is a safety bound, not a latency pass. At most one acquired chunk, one partial
480-sample native frame, two pending output writes and fixed scratch/dry/sample
buffers belong to the Worker. Two pending writes are required to avoid the
serialized-write throughput failure retained in the earlier research.

Inference processes exact 480-sample frames. Light/standard/strong mix wet
ratios 0.55/0.75/1 with the unchanged two-frame dry alignment. Updates apply at
the next model frame, without reacquisition or model reset. The host first
waits for Worker AudioData/ABI/native-state preparation, then creates the owned
input clone and track endpoints; cold module loading cannot fill an unpublished
input queue. An engine-prepared acknowledgement is not output readiness. Silence is usable
valid output; readiness requires three consecutive native frames and accepted
writes, not engine construction. Original media stays published during setup.

Capture AudioData timestamps can jitter by approximately +/-10 ms while sample
counts remain continuous. Output PTS therefore advances by counted samples
from the input origin, not by adjacent wall-clock timestamp jumps. Diagnostics
retain cumulative source clock extrema, timestamp jitter counts, processed,
submitted and accepted sample counts, and startup resets/discarded partial
samples. Positive cumulative drift above 40 ms before readiness restarts only
the unpublished readiness streak, records discarded partial samples and clears
the dry alignment. After readiness, either sign above 40 ms faults as overload;
negative drift above that bound also faults during startup. This guard is a
queue/freshness limit and does not measure or replace graph-inclusive latency.
It cannot prove that smaller timestamp changes are actual sample gaps.

Every read/write wait is bounded at 100 ms. A host progress watchdog also
observes frame timing acknowledgements at 50 ms intervals and faults after
more than 100 ms without progress, covering a Worker stuck inside native code. A stalled endpoint, invalid PCM,
source end, write rejection, cumulative drift or Worker execution/message error
reports the existing typed fault and restores original media. The 100 ms safety
timeout does not change the 40 ms acceptance threshold. Unit tests use the
actual C module and cover arbitrary chunk boundaries, exact level/dry output,
invalid input, discontinuity, bounded writes, cancellation and stream locks.

## Ownership and cleanup

Only an input clone and generated output belong to the adapter. Startup abort,
timeout, stale preparation, transfer failure and active faults stop those owned
tracks; the session's source and independent application clones retain their
ownership. The signal covers startup, as in the existing Worklet adapter.
Updates retain the same output. Worker error/fault callbacks report once;
stale callbacks cannot reactivate a disposed generation.

Disposal cancels the reader, releases stream locks and destroys native state.
It deliberately releases the writer without closing or aborting the generator,
which would end all application clones. Stop acknowledgements terminate the
Worker; a 150 ms force-termination bound handles unresponsive Workers. A final
partially submitted output write may remain at stop and is retained in sample
counts. Stop-boundary leftovers are not a claim of missing active audio.
Operation abort listeners are removed on completion instead of racing every
frame against one never-settling promise, which would retain frame history.

## Qualification policy and outstanding gates

Measurements retain the [v6 signed-control policy](route-prototypes.md):
processed lag minus same-run original-track median, no graph-cost subtraction,
all exclusions and negative baselines retained. The latency criterion remains
40 ms added p95. Worklet inference retains its 2.667 ms rendering guard for
ineligible inputs; Worker model times above 2.667 ms are comparison counts,
not Worklet callback misses. The graph observer is not a full callback profiler.

The 10-minute probe must remain denoised for 600 stable seconds, with all 60
one-second windows uniformly spaced across that interval, under requested
20 ms/250 ms UI contention. Original fallback cannot count as denoised endurance.
Memory evidence separates fixed native storage/bounded application buffers from
whole-browser process memory, hidden queues and GC, which require separate
qualification. Headless WSL executables and Orca Win32 Electron embedding are
different cells; neither establishes standalone Chrome/Edge/device support.

The unchanged expanded ten-speaker/two-recorded-noise/three-level corpus remains
119/120 provisional numeric passes: speaker 251, living-room noise, 0 dB,
strong STOI changes 0.7530266 to 0.7208394 (delta -0.0321871). This failure remains;
no mix or threshold changes hide it. The local blinded 16-case listening packet
includes that cell. Human review stays PENDING under coordinator message
msg_4ac65140a988; the key stays unopened. Physical latency, representative
listening, broader corpus, standalone browser/device and full memory gates
remain open. No fallback-only closure or release support claim follows.

## Recorded cells (2026-11-21)

| Cell | Added p95 | Window/continuity result | Disposition |
| --- | ---: | --- | --- |
| Win32 Orca Electron 43.8.10 / Chromium 150, **final host** | **41.3125 ms** | 60/60, 600.0107 stable seconds, no fallback; two unclassified observer jumps and three stable zero quanta | **Fails 40 ms and strict continuity qualification** |
| Same embedding, final host short screen | 32.6875 ms | 8/8, 8.008 stable seconds, zero stable gaps/zero quanta | Short screen only; cannot replace failing long run |
| Win32 Orca Electron 43.8.10 / Chromium 150, before prepared-first correction | 32.6875 ms | 60/60, 600 stable seconds; three unclassified stable zero quanta | Historical diagnostic, not final host |
| Same native embedding, prepared-first Worker | 31.3125 ms | 60/60, 600 stable seconds; zero stable missing/nonfinite/zero/render-gap/collector-drop counts; 2406 UI contention ticks | This embedding cell passes the numeric latency/observed continuity probe; not standalone/device/listening qualification |
| WSL Linux headless Chromium 151, prepared-first, short screen without contention | **42.6875 ms** | 59/60; one excluded internal observer jump, two stable observer gap events and three zero quanta | **Fails 40 ms and the full-window/continuity gate**; no ten-minute claim |
| WSL Firefox 153 | Unqualified | Window raw-audio constructors absent; current Worklet/fallback remains | No raw processing support claim |
| Edge / WebKit in this WSL environment | Unmeasured | Edge distribution and WebKit executable absent on fresh launch checks | No product-unsupported claim |
| Physical microphone/speaker and representative devices | Unmeasured | No reference-device or acoustic experiment | Pending |

The native prepared-first run used Worker `noise-worker-Ppvt9oyD.js`. It ran
60,161 actual C frames, source/submitted/accepted output all 28,877,280 samples,
with no active fault, startup reset or partial-sample discard. Native Worker
call p50/p95/p99/max were 0.5/0.8000001/1.1999999/12.6999999 ms. There were 106
Worker-only comparisons above 2.667 ms, not rendering callback misses. Stop was
acknowledged, the output clone stayed live after 150 ms, and the captured input
ended when the owning session disposed. A source-end message during disposal
is marked `duringClose`, not an active fault.

Signed controls -30/0/+30/+60 ms calibrated exactly over retained windows; one
+30 ms control window with internal opposing observer jumps was excluded and
retained in the report. All 60 processed windows were accepted. The original
baseline was +4 ms, so total p95 35.3125 minus 4 equals 31.3125 ms. The WSL
baseline was **-12 ms**, so total 30.6875 minus -12 equals **42.6875 ms**; negative
baselines are not clamped and graph cost is never deducted.

The 600-second prepared-first run precedes the final host-only capability
routing and progress-watchdog hardening. Its exact served/source identities
are retained; it is not relabeled as a final-host long run. The Worker/WASM
bytes remain identical, and the final host is screened separately. The final
host was subsequently run for ten minutes: it remains active but fails the
latency/strict continuity gates as recorded below. Matrix/release qualification
remains open. The earlier
three-zero-quanta run is retained, not replaced or silently upgraded.

The Window-exposed heap probe grew from 7,537,363 to 32,258,205 bytes while the
measurement retained PCM windows and diagnostic arrays. These values do not
prove Worker memory leakage or bounded whole-browser memory; neither a
post-GC engine-only baseline nor process-attributable memory was measured.
Native fixed memory and explicit buffer/queue bounds pass their separate
checks. Whole-browser memory qualification remains pending.

Evidence: [prepared-first native run](audio-private-native-endurance-2026-11-21.json),
[earlier native run](audio-private-before-prepare-2026-11-21.json),
[failed headless screen](audio-private-headless-2026-11-21.json). Reports contain
scalar/window metadata and raw-report identities; PCM remains local/ignored.

## Reproduce the private route

Build with the private gate, start one frozen server, and run this separately
from other benchmarks/builds:

```sh
VITE_RNNOISE_RAW_WORKER=1 mise exec -- pnpm package:check
# Start/restart the Vite fixture server before measuring.
AUDIO_ROUTE_RESEARCH=1 AUDIO_ROUTE_PRIVATE=1 AUDIO_ROUTE_MODE=routes \
  AUDIO_ROUTE_ISOLATED=0 AUDIO_ROUTE_CASES=private-session-c \
  AUDIO_ROUTE_WINDOWS=60 AUDIO_ROUTE_TRIAL=endurance AUDIO_ROUTE_DURATION=600 \
  AUDIO_ROUTE_INPUT=.cache/audio-routes/corpus/latency-loop.f32 \
  mise exec -- pnpm exec playwright test tests/browser/audio-route-research.spec.ts \
  --project=chromium
```

`AUDIO_ROUTE_PRIVATE=1` uses only the unchanged C artifact and instruments the
actual private Worker; it does not require building/loading SIMD prototypes.
`private-session-c` rejects a Worklet result if the private gate/capability is
ineligible, so a Worklet cannot silently qualify as raw processing. The short
WSL screen used the same command with `AUDIO_ROUTE_TRIAL=screen`; it had 60
requested one-second windows and no endurance contention loop.

For the native embedding diagnostic, use the owned Orca fixture procedure in
[route-prototypes](route-prototypes.md), installing `native-setup.mjs` then
`private-worker-setup.mjs`. Before clicking, set `nativeResearchOptions` to
`mode: "endurance", duration: 600, windows: 60`. The second script selects
`private-session-c`, C only, and records bounded native timing/diagnostics and
stop acknowledgements. The final host screen instead sets `mode: "screen"`
and `windows: 8`; it must not be labeled 600-second evidence.

```sh
python scripts/collect-native-audio-routes.py --page <owned-page-id> \
  --output .cache/audio-private/native-endurance.json
PYTHONDONTWRITEBYTECODE=1 uv run --no-project --with numpy==2.3.5 \
  --with scipy==1.16.3 python scripts/summarize-audio-routes.py \
  .cache/audio-private/native-endurance.json
python scripts/summarize-private-audio-worker.py \
  .cache/audio-private/native-endurance.json
```

The collector now includes private Worker diagnostics when present. The scalar
summary tool retains all faults, capacity flags, timing tails, final counters
and memory limitations without exporting PCM. Stop owned fixture tabs/server
processes after collection; preserve every historical worktree and raw report.


## Final host disposition

The final host's 600.0107-stable-second run retains all 60 processed windows and
2405 UI contention ticks with no fallback. Total p95 is 35.3125 ms, but the
same-run original median is **-6 ms**: added p95 is **41.3125 ms**, failing the
unchanged 40 ms criterion. Two opposing observer frame-clock jumps occur in
the processed phase outside captured windows, plus three unclassified stable
zero quanta. All windows still correlate, but the global continuity counters
prevent strict continuity qualification. Do not cancel the two events, discard
the zero quanta, clamp the baseline, or choose the earlier favorable run.

The earlier prepared-host total p95 was also 35.3125 ms with a +4 ms baseline.
These are distinct measured cells; their differing signed baselines do not
establish that the host watchdog caused a 10 ms regression. The final short
screen's 32.6875 ms is not substituted for the required long tail.

Actual browser hard termination now also passes: terminating the active Worker
leaves the application output clone and input live, the host reports a progress
overload, and the session restores the original track. Normal/cooperative
shutdown, source stall, CSP rejection and synthetic execution errors have
separate tests. The source inventory check now rejects stale first-party
Worker/Worklet source digests as well as checking the unchanged native asset.

Final evidence: [long final-host run](audio-private-final-host-endurance-2026-11-21.json),
[short final-host screen](audio-private-final-host-screen-2026-11-21.json), and
[builds, package/browser/forced-termination and unavailable-runtime evidence](audio-private-build-2026-11-21.json).
The enabled Worker/WASM bytes are identical to the prepared-first long run;
source and host-bundle identities remain separately recorded.

Final probes used a temporary Vite config with `root` set to this repository,
`base: "./"`, and `server: { hmr: false, watch: null }` to prevent documentation
changes from reloading the frozen fixture. No build or competing benchmark ran
during capture. Start that configuration before measurement and keep `dist/`
unchanged until collection finishes. Human listening, the failed quality cell,
standalone/device support and whole-browser memory remain unresolved. TASK-1.12
AC3 stays open; no merge or fallback-only completion is authorized.
