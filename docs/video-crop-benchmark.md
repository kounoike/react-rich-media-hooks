# Fixed camera crop benchmark

## Approved scenario and budgets

This report covers the TASK-1.11 vertical slice approved in `decision-7`:
one user-selected, fixed crop of a 1280×720 camera source requested at 30 fps.
The crop region is `{ x: 0.125, y: 0, width: 0.75, height: 1 }`, yielding a
960×720 output. Background effects and auto-framing are outside this task.

The adopted TASK-1.6/doc-6 targets are:

- Capture first usable frame within 500 ms after the browser resolves
  `getUserMedia`; permission-prompt and stream-acquisition duration is recorded
  separately.
- Crop output sustains 30 fps with source-to-preview p95 latency at or below
  50 ms.
- Warm effect setup completes within 1 second after local code/assets are
  available.
- Across five warm add/update/bypass/remove cycles, retained heap growth stays
  within 10% or 5 MiB, and no inactive processor tracks remain live.
- Record browser/device versions, capture-only and pass-through controls,
  failures, and per-run measurements. PR coverage runs Chromium and Firefox;
  Edge/Safari run on the approved nightly or merge-queue cadence, and four
  desktop engines plus reference devices run at release. Mobile is feasibility
  or manual coverage.

## User-operated physical reference-device flow

For controlled retained-memory evidence, run the local server in the task checkout,
then start a dedicated reference browser from another terminal:

```sh
pnpm run video-crop:benchmark
pnpm run video-crop:reference
```

The launcher defaults to the server on port 4173. For the existing TASK-1.25
server on port 4174, use:

```sh
pnpm run video-crop:reference -- --url http://localhost:4174/tests/browser/video-crop-benchmark.html
```

On WSL it uses the installed Windows Node and Chrome. The launcher requires Node
22 or newer and creates one isolated browser profile; it verifies the debug
endpoint belongs to that profile and closes only that browser. The installed
Windows Node version is recorded. No new packages or browser installation are
required. An incompatible/older page is rejected before measurement.

In the dedicated window, confirm the reference-camera checkbox, select
**Start camera**, allow camera access, then select **Run measurements**. Commit
SHA, available OS/CPU information, controller runtime, and repository package
manager declaration are filled automatically. The actual camera label/settings
are recorded after Start. The user controls physical camera operation; the
launcher never clicks either button in its default mode.

At the four existing heap boundaries (before/after five effect cycles and
before/after five camera restart cycles), the launcher calls
[CDP HeapProfiler.collectGarbage](https://chromedevtools.github.io/devtools-protocol/tot/HeapProfiler/#method-collectGarbage)
and then [Runtime.getHeapUsage](https://chromedevtools.github.io/devtools-protocol/tot/Runtime/#method-getHeapUsage).
These calls occur after the FPS/latency profiles, not during their measurement
windows. The JSON identifies the controlled method and collection count.
The budget remains the larger of 10% of baseline or 5 MiB for each cycle window.
The measured heap belongs to the page renderer, not the Node controller.

Completed, stopped, and failed reports are saved locally under
`.artifacts/reference-device/` in this checkout. The page still offers its JSON
download. Close the dedicated window when finished; its temporary profile is
removed after the owned browser connection has closed. Existing browser
windows/profiles are untouched. Opening the page directly without this launcher
continues to report retained heap as unknown. Synthetic automation is available
only with explicit `--synthetic --headless --autorun`; headless/automatic physical
camera runs are rejected.

The direct-page flow below remains available for FPS/latency/lifecycle checks:

From the repository root, start the local page with:

```sh
pnpm run video-crop:benchmark
```

Open `http://127.0.0.1:4173/tests/browser/video-crop-benchmark.html`, enter the
full benchmark commit SHA, host OS/device model, Node and package-manager
versions, and camera description. The page requests the default camera only
when **Start camera** is clicked. **Run measurements** performs three trials of
capture-only, no-op pass-through, and fixed crop; each FPS stage warms for one
second and measures for two seconds. FPS collection performs no pixel readback.
Each crop trial then measures processing latency in a separate six-second
window. No photographed display or external marker window is required.

The page records five warm crop add/update/bypass/remove cycles and five camera
stop/start cycles. Capture is released at completion or when **Stop and release
camera** is selected. The input-video DOM manipulation experiment is optional
(`?dom=1`); it is excluded from the normal acceptance flow because it mutates a
private processor element and previously stalled frame delivery. Optional rows
are diagnostic and never replace the three fixed-crop acceptance trials.

The page imports the compiled core entry directly with a unique query per
session, bypassing stale stable-entry transforms in a long-running Vite server.
The JSON records the core URL, transformed module SHA-256, referenced runtime
chunk, and effects entry URL. The entered commit SHA is a user assertion;
these module fields provide additional evidence of the code actually loaded.

For each fixed-crop stage, the page also counts the processor input video
`requestVideoFrameCallback` callbacks and their `presentedFrames` gaps, the
processor's source-video `drawImage` calls, failures and p95 call duration, and
the final preview callbacks. These values use the same two-second measurement
window. The report records whether the processor input video is connected to the
document. This separates source-video presentation, crop drawing, and output
preview cadence. The draw duration is the synchronous JavaScript call duration;
the processor callback p95 also includes the surrounding callback work. Neither
measures deferred GPU completion. A low input callback rate with a higher
configured camera rate locates the loss before drawing; matching input and draw
rates with lower preview output locates it after drawing. Draw duration helps
identify expensive drawing.
These browser counters still cannot observe camera frames never delivered to
the video element. They also add lightweight callback instrumentation, so
compare runs with the same benchmark build and browser settings.

The downloaded JSON records browser user agent and client hints where available,
the user-entered host/runtime details, requested and negotiated camera settings,
commit SHA, crop and capture frame rates, presented-frame callback gaps, first
usable frame measured from `getUserMedia` resolution, time from the `getUserMedia`
request to stream resolution, crop setup time, processing-to-preview
p50/p95/maximum latency, heap observations, budget comparisons, lifecycle
results, and track cleanup. Results remain local until downloaded; camera
device IDs are not serialized.

The processing-latency probe stamps a temporary 24×16 pixel timing token after
each crop draw. A source callback timestamp and checksum associate the token
with the output preview callback. Receipt time is recorded before decoding.
Readback is limited to five samples per second and occurs only in the separate
latency window; at least 20 matched samples are required. `latencyMeasuredMs`
records that window independently of the FPS `measuredMs`. This measures from
the processor's input callback to the matching output preview callback,
excluding display refresh and camera acquisition. The probe exists only in the
benchmark; it changes no shipped processor code or public API.

Raw `performance.memory.usedJSHeapSize` differences are recorded as allocated
heap observations, not retained-memory verdicts. `retainedHeapGrowthWithinBudget`
is unknown without controlled GC before and after both the effect-cycle and session-cycle windows. The
Playwright GC test uses CDP `HeapProfiler.collectGarbage` and
`Runtime.getHeapUsage`; its synthetic evidence does not establish physical-device
retention. Presented-frame gaps likewise do not count camera frames never
delivered to the browser. The [synthetic post-GC report](measurements/crop-benchmark-synthetic-post-gc.json)
preserves the four controlled heap observations and cleanup evidence. Its
shortened test windows verify the protocol, not physical performance.
The historical reports below preserve the old optical
protocol and uncollected heap flags; those values must not be read as results
from the corrected protocol.

## Physical report declaring commit 4a5fd53: provenance failure

The [complete user report](measurements/crop-acceptance-c922-declared-4a5fd53.json)
ran on Windows 11 25H2, Chrome 154.0.8037.98, C922, 1280×720/30 input and
960×720 crop. First usable frame was 72.1 ms; all five effect cycles and all five
session cycles succeeded; all 19 observed tracks ended after cleanup. Crop
preview rates were 27.199, 27.652, and 29.934 fps while draw rates remained near
30 fps. DOM mutation diagnostics stalled in three states. Optical latency had
only nine crop samples in trial 1 and none in trials 2–3. Uncollected used heap
grew from 7,493,345 to 18,110,308 bytes; this is not proof of a retained leak.

[HTTP inspection](measurements/crop-benchmark-served-module-provenance.json) of
the same task-worktree Vite server on port 4174 proved that
its plain `/dist/core/index.js` still referenced `runtime-BV2FNQJa.js`, without
the explicit `requestFrame` fix. Disk and a uniquely queried core entry instead
referenced `runtime-B1MYy2hy.js`, containing that fix. The old root-entry import
and manually entered SHA did not establish the actual loaded implementation.
Therefore this report cannot validate throughput of the declared fixed commit.
The corrected loader has a regression test that preloads a stale core entry and
verifies that a new session uses the fresh compiled entry.

## Initial physical reference-camera result

The first user-operated run used Chrome 154.0.8037.98 on Windows 25H2 with a
C922 Pro Stream Webcam (046d:085c), negotiated at 1280×720 and 30 fps. The
reported host entry omitted the PC model. The Vite page was served by Node
v24.19.0 and pnpm 11.21.0 in WSL2 Ubuntu 24.04; the browser itself ran on
Windows. The benchmark commit was
`a9343566ac1d6a530c462b7166f7be91a4a8d086`.

| Run | Capture-only fps | Pass-through fps | Fixed-crop fps | Crop setup ms | Crop callback gaps |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 | 30.16 | 29.81 | 26.01 | 58.4 | 0% |
| 2 | 29.78 | 29.91 | 27.13 | 43.4 | 0% |
| 3 | 29.76 | 29.85 | 29.10 | 72.9 | 0% |

This run shows lower throughput in the crop path than in pass-through, with the
largest gap in run 1. All crop p95 values are unknown because the optical marker
produced zero samples. Browser-reported presented-frame gaps were zero; exact
camera frames never delivered remain unobservable. Five session retention
cycles completed, all observed tracks ended after disposal, and retained heap
decreased from 8,068,358 to 7,820,386 bytes. Crop setup met the one-second
budget in every run.

The 9,654.5 ms first-frame value in this report was measured from before
`MediaSession.start()` and includes the OS permission prompt, so it cannot be
compared to the 500 ms budget. The next benchmark version measures first frame
from `getUserMedia` resolution and reports request-to-stream time separately.
The five `removeRestoredInput` false values came from the benchmark comparing
the restored camera track with the cropped output track left active by the
previous profile. The measurement now retains the original capture track for
that identity comparison. The lifecycle operations themselves returned
success, bypass restored the input, and effect tracks ended in all five cycles.

This baseline confirms a crop-specific throughput gap but does not complete
criteria #1-#3: latency is missing and the startup timing is not comparable to
the approved budget. An optional
`CanvasCaptureMediaStreamTrack.requestFrame()` scheduling candidate was tried
on the follow-up run below, then removed after it showed no consistent
throughput improvement. The fixed-cadence `canvas.captureStream(30)` path
remains in use.

The follow-up run on commit `269f3fccf4a316832115ce8b3a68ef505ac660c5` used the
same browser, camera, and negotiated settings. First usable frame was 62.4 ms
after `getUserMedia` resolution; request-to-stream resolution took 743.1 ms.
Capture-only measured 29.65/29.90/29.94 fps, pass-through 29.77/30.20/30.15
fps, and fixed crop 26.85/25.50/26.93 fps. Crop setup took 58.8-60.0 ms and
presented-frame callback gaps remained zero. All five effect cycles restored
the original track after bypass and removal, all effect tracks ended, all five
session cycles passed, and cleanup left zero live tracks. Retained heap fell
from 7,893,077 to 7,725,369 bytes.

The first three latency values from that run were 1.9 s, 9.8 s, and 2.4 s;
the remaining stages had no marker samples. These samples are not accepted as
latency evidence: the decoder could accept matching marker codes retained for up
to 15 seconds, even if the marker animation had stopped. The benchmark now
excludes codes older than one second, reports fresh and stale sample counts,
and applies the 50 ms budget only to fixed crop, as specified by decision-7.
The request-frame experiment did not show a consistent throughput improvement;
fixed crop remains below 30 fps. That candidate has been removed. Criteria
#1-#3 remain open pending fresh marker evidence and a supported follow-up for
the crop throughput miss.

## Third physical reference-camera run (2026-10-06)

The latest user-operated run used Chrome 154.0.8037.98 on Windows 11 25H2 with
the C922 Pro Stream Webcam (046d:085c), negotiated at 1280×720 and 30 fps, on
benchmark commit `76f097062aaebd8fc6ce72dd61836630626e8af3`. The page measured
first usable frame at 69.7 ms after `getUserMedia` resolved and crop setup at
61.8–62.0 ms.

| Run | Capture-only fps | Pass-through fps | Fixed-crop fps | Crop marker p95 ms | Crop marker samples | Crop setup ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 29.76 | 30.30 | 25.94 | 783.3 | 28 | 61.9 |
| 2 | 30.19 | 29.87 | 25.44 | 650.0 | 48 | 62.0 |
| 3 | 30.17 | 29.82 | 24.88 | unknown | 0 | 61.8 |

All preview callback gap percentages were zero. The five effect cycles restored
the original track on bypass and removal; the five session cycles completed,
all 19 observed tracks were ended after cleanup, and no live tracks remained.
The report marked retained heap growth within budget. Its metadata fields for
runtime and camera were entered only as `Node` and `Camera`, so exact server
runtime versions and host model remain missing from this run.

The crop output stayed about 3.8–5.3 fps below its paired capture-only result.
This confirms a repeatable output-throughput shortfall, but the run did not
count internal input callbacks or canvas draw calls, so it cannot identify the
stage responsible. The next benchmark adds those same-window counters and a
paired detached-versus-connected measurement of the same live processor. The
user reported a roughly 3 fps association with detached input video; treat that
as a hypothesis until the paired values are reviewed. No runtime scheduling or
DOM behavior has been changed. Keep criteria #1–#3 open until that attribution
and valid latency evidence are recorded.

The `?test=1` page mode and Playwright coverage use synthetic input with shortened
durations to verify the flow. Those runs are tooling checks and do not count as
physical-device acceptance evidence.

## Protocol

The browser test uses a deterministic canvas media source configured as
1280×720 at 30 fps. It measures capture-only output, pass-through output, and
the crop output for two seconds each in three independently created sessions
per browser. It records presented frames, preview p95 latency by matching a
frame color to its source paint time, first-frame time, crop startup time,
output dimensions, track replacement, getUserMedia calls, five warm lifecycle
effect cycles, five warm session start/stop cycles, and available heap
measurements. Each session is first warmed and returned to an inactive state;
the heap comparison is taken from that inactive baseline through five further
start/stop cycles.
The `video-crop-baseline.json` Playwright attachment retains each run and its
individual source-to-preview latency samples; the table below is its compact
summary.

This is headless browser integration evidence, not a physical-camera result.
The run was performed in WSL2 Linux x86_64 with 24 logical CPUs. Playwright's
desktop device profiles report Windows in the page user agent. The fixture
replaces `getUserMedia` with its deterministic canvas track; no physical
camera, mobile device, or GPU configuration was measured.

Reproduce from the repository root after `pnpm build`:

```sh
pnpm exec playwright test tests/browser/video-crop.spec.ts --project=chromium --project=firefox
```

## Baseline results

The Chromium engine was Chrome 151.0.7922.34 and Firefox was 153.0. The
`capture fps`, `pass-through fps`, and `crop fps` columns are the three
independent two-second run results. All runs reported zero gaps in the
`requestVideoFrameCallback` `presentedFrames` sequence. First-frame values are
measured from capture request for the capture control and from crop application
for the crop column.

| Browser | Run | Capture fps | Pass-through fps | Crop fps | Crop p50 ms | Crop p95 ms | Crop max ms | Capture first frame ms | Crop first frame ms | Crop setup ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Chromium 151 | 1 | 29.78 | 29.72 | 29.66 | 24.50 | 34.20 | 42.90 | 61.30 | 68.60 | 27.40 |
| Chromium 151 | 2 | 29.91 | 29.82 | 29.08 | 25.50 | 34.40 | 35.10 | 68.30 | 84.20 | 39.50 |
| Chromium 151 | 3 | 29.87 | 29.82 | 29.60 | 25.70 | 33.70 | 34.70 | 67.30 | 83.50 | 38.30 |
| Firefox 153 | 1 | 15.49 | 16.69 | 13.57 | 39.94 | 46.14 | 46.58 | 54.68 | 148.86 | 36.00 |
| Firefox 153 | 2 | 16.27 | 16.26 | 13.99 | 44.12 | 47.60 | 47.92 | 62.40 | 149.92 | 36.00 |
| Firefox 153 | 3 | 15.92 | 16.66 | 14.23 | 40.46 | 44.24 | 44.48 | 58.02 | 149.88 | 37.00 |

For each two-second interval, source canvas paint counts / preview frame counts
were Chromium capture `60/60`, `60/61`, `60/61`; pass-through `60/60`,
`60/61`, `60/61`; crop `61/60`, `61/59`, `61/60`. Firefox counts were capture
`60/32`, `60/33`, `60/32`; pass-through `60/34`, `60/33`, `60/34`; crop
`60/28`, `60/28`, `60/29`. These interval counts are not a one-to-one source
frame delivery measurement: boundary timing and frame callbacks can include
adjacent frames. The exact source-frame drop percentage is **unknown**. A
synthetic pixel-ID decoder produced inconsistent IDs even for capture-only
output, so it was removed instead of using its false precision. The retained
latency sampler matches source paint colors and reports p50, p95, and maximum;
the zero preview sequence gaps count only missing `presentedFrames` callback
indices. The TASK-1.6 capture-only source-loss limit of 1% is **unknown** from
this run; these counters do not prove that limit.

Capture first-frame time was 61.30–68.30 ms in Chromium and 54.68–62.40 ms in
Firefox. Both browsers met the first-frame, crop p95, and warm setup budgets in
this fixture. Every capture-only run and every crop run missed the strict 30
fps target: capture measured 29.78–29.91 fps in Chromium and 15.49–16.27 fps in
Firefox; crop measured 29.08–29.66 fps and 13.57–14.23 fps respectively.
Firefox's capture-only and pass-through controls were already around 15–17 fps,
so the fixture does not isolate a physical-camera bottleneck. The headless
runner is a material limitation; real-device attribution remains open, and
the original camera output cannot recover capture cadence that the browser or
device does not deliver.

The documented overload watchdog restored the original camera output and
reported `degraded` in all three Firefox runs after two slow processing
windows. Chromium remained above the watchdog's 95% tolerance in these runs,
so that automatic path did not fire; its strict 30 fps miss uses the explicit
bypass. The test exercised bypass and removal in every run; both restored the
original video track without reacquiring media during the processing journey.

Each run created 960×720 crop output. Updating the region to a 640×720 crop
replaced the output track without reacquiring capture; bypass and removal
stopped the processor output tracks in all five warm effect cycles. Each run
also completed five further session start/stop cycles after an inactive
post-warm-up baseline, and stopped all five reacquired capture tracks.
Chromium reported 10,000,000 bytes before and after each five-cycle group,
within the adopted growth limit at the resolution exposed by this API. Firefox
does not expose `performance.memory` in this fixture, so its heap budget
remains unknown.

## Baseline comparison and experiments

### Repeat synthetic canvas run (2026-10-03 UTC)

I reran the Playwright baseline on the same WSL2 Linux x86_64 host (Microsoft
WSL2 kernel 6.18.40.1, 24 logical CPUs) with Chrome 151.0.7922.34 and Firefox
153.0. The Playwright desktop profiles reported a Windows user agent while the
browser platform was Linux x86_64. The fixture generated a changing 1280×720
canvas at 30 fps and returned its `canvas.captureStream(30)` track from an
overridden `getUserMedia`; it did not access a camera device. Each browser ran
three independent two-second capture-only, pass-through, and crop stages in
separate sessions, followed by five warm effect add/update/bypass/remove
cycles and five session stop/start cycles per session. The library session,
crop processor, output tracks, and preview were exercised in the real browser
engine. The synthetic fixture supplies no evidence about sensor capture,
camera drivers, device thermals, or physical-device throughput.

| Browser | Run | Capture fps | Pass-through fps | Crop fps | Crop p95 ms | Capture first frame ms | Crop first frame ms | Preview callback gaps |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Chrome 151 | 1 | 29.82 | 29.64 | 29.12 | 34.60 | 59.03 | 78.60 | 0 |
| Chrome 151 | 2 | 29.86 | 29.81 | 29.67 | 33.70 | 72.50 | 86.30 | 0 |
| Chrome 151 | 3 | 30.18 | 29.84 | 29.03 | 27.90 | 69.93 | 84.60 | 0 |
| Firefox 153 | 1 | 15.98 | 16.21 | 14.45 | 47.76 | 68.94 | 149.30 | 0 |
| Firefox 153 | 2 | 15.63 | 16.01 | 14.84 | 48.24 | 58.36 | 83.24 | 0 |
| Firefox 153 | 3 | 16.31 | 16.26 | 14.17 | 48.30 | 71.76 | 116.14 | 0 |

The attached `video-crop-baseline.json` recorded these exact two-second-stage
counts as preview callbacks / source canvas paints / latency samples:

| Browser | Run | Capture-only | Pass-through | Fixed crop |
| --- | ---: | ---: | ---: | ---: |
| Chrome 151 | 1 | 60 / 60 / 7 | 60 / 60 / 9 | 59 / 59 / 59 |
| Chrome 151 | 2 | 61 / 60 / 10 | 61 / 60 / 11 | 60 / 61 / 60 |
| Chrome 151 | 3 | 61 / 61 / 11 | 61 / 60 / 9 | 59 / 61 / 59 |
| Firefox 153 | 1 | 33 / 60 / 33 | 33 / 60 / 33 | 29 / 60 / 29 |
| Firefox 153 | 2 | 32 / 60 / 32 | 33 / 60 / 33 | 30 / 60 / 30 |
| Firefox 153 | 3 | 33 / 59 / 33 | 33 / 61 / 33 | 29 / 59 / 29 |

The crop p95 values therefore use 59–60 matched samples in Chromium and 29–30
in Firefox. Chromium's capture-only and pass-through color matcher produced
only 7–11 latency samples per run; those control-path p95 values are not used
for the crop comparison. The separate `?test=1` UI test uses 250 ms stages
and only about 4–9 frames, so it verifies the benchmark page's flow, cleanup,
and export behavior and contributes no performance values to these tables.

The source track reported 1280×720 at 30 fps in Chromium; Firefox reported its
1280×720 dimensions but omitted `frameRate` from `getSettings()`. Both engines
reported a 960×720 crop output. There were zero missing indices in the
preview's `requestVideoFrameCallback` `presentedFrames` sequence, but this
does not count source frames that the browser never delivered, so exact source
frame loss remains unknown. The capture first-frame values are below the
500 ms budget, and every crop p95 is at or below 50 ms in this run. Chromium
crop sustained 29.03–29.67 fps; Firefox capture-only was already 15.63–16.31
fps and crop was 14.17–14.84 fps. These synthetic results cannot attribute a
physical-device bottleneck and did not motivate an optimization. The Firefox
overload fallback and explicit bypass/removal paths passed; Chromium did not
cross the automatic watchdog threshold, and explicit bypass/removal passed.

All five effect cycles released their processor tracks, and all five session
stop/start cycles ended their input tracks in each measured session.
Chromium's exposed JS heap stayed at 10,000,000 bytes from the inactive
pre-cycle reading through the five cycles; this coarse reading excludes native
and graphics memory. Firefox does not expose `performance.memory`, so its
retained heap remains unknown. The browser checks also passed the synthetic
on-demand benchmark page's start/stop and JSON-export paths. No physical
camera was requested. Accordingly, the repeat run adds software-pipeline
evidence only; physical-reference criteria #1–#3 remain open.

The capture-only and pass-through controls show that most of Firefox's
30-fps miss is present before crop processing in this synthetic environment.
The crop rate was 0.06–0.83 fps below pass-through in Chromium and 2.27–3.12
fps below pass-through in Firefox. Crop p95 latency stayed below 50 ms in both
engines; the maximum sample was 42.90 ms in Chromium and 47.92 ms in Firefox.
No speculative pixel-processing optimization was applied because this run
cannot establish whether the Firefox ceiling represents a real camera or
reference-device bottleneck.

One browser integration experiment found that resizing the canvas did not
change Chromium's existing canvas-capture track settings: a 640×720 crop
continued reporting 960×720. Firefox reflected the changed dimensions on that
track. The implementation now creates a replacement canvas-capture track
when crop dimensions change, hands it to the session output, and stops the old
track. The follow-up browser run reported 960×720 then 640×720 in both engines
with capture requested once.

## Fallback and remaining work

If an application benchmark misses the 30-fps or 50-ms budget, it can retain
the original camera output with
`session.setVideoEffects({ effects: [cropOptions], bypass: true })`. For a
29-fps-or-faster source, the processor also automatically restores the input
after two consecutive two-second windows below 95% of source cadence. The
Firefox run verified this automatic fallback; Chromium's near-target results
did not cross that tolerance, so the explicit bypass remains the fallback for
its strict 30-fps miss. The processor reports its `degraded` state and keeps
the capture session active.

TASK-1.25 tracks the remaining device-specific baseline and measured
optimization work. The open evidence includes physical reference cameras,
Edge/Safari at the approved cadence, mobile feasibility, Firefox retained
heap, and whether the headless Firefox throughput ceiling occurs on actual
devices. No backend, dependency, or API change was selected from this
synthetic baseline.

## Independent throughput comparison

For a low-overhead comparison of the crop output capture policies, use
`/tests/browser/video-crop-throughput.html`. Its synthetic source requires no camera;
physical measurement starts only when the user selects camera input and starts the run.
See [the controlled throughput investigation](video-crop-throughput.md) for the protocol,
raw before/after reports, and the timer scheduling fix. This diagnostic does not replace
the reference-device acceptance protocol above.

## Processing-latency failure recovery

The user reported another failed run declaring benchmark commit
`5a849dbd8dbcfc322e3dc42a548a4b71bb4427a5`, with capture-only 15.0 fps and
pass-through 17.9 fps, followed by a processing-latency timeout. Those baseline
rates do not establish a crop-specific slowdown. The full physical report and
actual stopping cause remain unconfirmed.

An [injected `getImageData` exception](measurements/crop-benchmark-readback-failure-regression.json)
reproduced the page's failure pattern:
it escaped the frame callback, the report later showed only a generic timeout,
completed crop FPS was absent, and camera cleanup was absent. The collector now
catches that exception immediately, records the actual error, and saves FPS
before starting the separate latency probe. Latency diagnostics preserve input,
draw, output callback and readback counts, matching/rejected token counts,
visibility/focus, video state, processor state, and output track state. FPS rows
also preserve first/last callback timestamps, media times, presented-frame
counters, and visibility/focus. Every failed run attempts both stop and dispose;
unconfirmed cleanup retains the session for explicit release.

Regression coverage includes an injected readback exception, suppressed timing
callbacks with input/draw still running, and the normal six-second window with
five-Hz sampling and at least 20 matched tokens. This closes the earlier gap
where only shortened timing windows were exercised. Required latency coverage
applies only to fixed-crop rows; capture and pass-through controls intentionally
perform no timing probe. The reproduction confirms a collector defect, not that
this exception caused the user's physical timeout.

An isolated, headless Windows Chrome 154.0.8037.98 run of the corrected page used
only a 1280×720/30 synthetic canvas and the normal windows. It completed all
three trials: crop preview 30.106/30.453/30.436 fps, processing p95 16.8 ms in
all trials, 29 matched samples per trial, no runtime errors, and all 19 observed
tracks ended. The [complete native synthetic report](measurements/crop-benchmark-native-chrome154-normal-window.json)
is fixture evidence, not physical acceptance. Its zero commit SHA is explicitly
a fixture value; the browser module fields identify the compiled runtime, and
the benchmark was the working copy after 5a849db. Physical capture cadence and
the user's timeout cause must still be measured rather than inferred from this
successful synthetic run.

## Completed physical C922 run at a40114c

The user-operated run from 2026-10-07T22:37:37.021Z to
2026-10-07T22:38:38.333Z completed with no issues, declaring commit
`a40114c3c08100f146199e6a1e30d01654d2764a`. The automatically reported camera
was C922 (046d:085c), negotiated at 1280×720/30; output was 960×720/30;
Chrome was 154.0.8037.98 on Windows. The reported uniquely queried core entry's
SHA-256 was independently matched against the server response, and it referred
to the fixed `runtime-B1MYy2hy.js`. The
[selected-field summary and endpoint calculations](measurements/crop-acceptance-c922-a40114c-summary.json)
are explicitly not the full original JSON. Host/runtime/camera text was
`w`/`n`/`c`; missing PC model and runtime details are not inferred.

| Run | Reported capture fps | Reported crop fps | Crop presentation endpoint fps | Crop processing p95 ms | Matched timing samples |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 | 29.934 | 30.149 | 30.000000 | 16.8 | 28 |
| 2 | 30.194 | 29.657 | 30.000498 | 17.7 | 28 |
| 3 | 29.982 | 29.888 | 30.001505 | 18.8 | 29 |

Input callback, draw call, and output callback counts were identical within
each crop FPS window (61/60/60). No input or output presented-frame gaps or draw
failures were observed; the input video remained detached. Draw p95 was
0.3–0.4 ms. All three timing windows collected at least 20 matched tokens,
without rejected samples or errors. This run shows no additional crop frame
loss at the measured presentation stages; it does not count sensor frames
never delivered to the browser or prove that the earlier failed run had the
same cause as the injected-error reproduction.

The page's existing FPS field counts callbacks over the complete measurement
window, including the wait before the first callback. Recalculating cadence
uses `delta presentedFrames * 1000 / delta callback timestamp`. For crop trial
2, 59 frame intervals span 1,966.634 ms, yielding 30.000498 fps rather than the
reported 60 callbacks / 2,023.1 ms = 29.657456 fps. No new camera run is needed
for this calculation. This is a separately labeled derived rate, not a rewrite
of the original report or its strict 30 fps checks. Capture/pass-through trial
1 also had an extra presentation interval at the endpoints (29.753 fps), while
its media timeline was approximately 30 fps; those clock domains are kept
separate. The formal capture/crop FPS summary flags remain false in the
original report, and no tolerance or budget change was adopted.

First usable frame was 105.684 ms after stream resolution (budget 500 ms);
stream acquisition itself was 881.4 ms. Crop setup was 100.5/66.9/100.0 ms
(budget 1,000 ms). All five add/update/bypass/remove cycles succeeded and
restored the original input; all five camera restart cycles succeeded. No
capture was reacquired during profiles. All 19 observed tracks ended after
disposal. Physical collection/lifecycle evidence is now present.

Uncollected used heap grew by 78,042 bytes across the effect cycles and fell by
699 bytes across the camera cycles. These approximate allocated-heap values
meet the raw growth thresholds but cannot prove retained-memory compliance;
`retainedHeapGrowthWithinBudget` remains null. Strict FPS interpretation and
controlled physical post-GC retention remain open. No further physical camera
access or code changes were made to review this report.

## Endpoint FPS and controlled-GC preparation

The page now reports steady cadence as the advance in `presentedFrames` divided
by the first-to-last callback timestamp interval. It records
`frameRateMethod=presented-frame-callback-endpoints` and keeps the original
complete-window rate separately as `wallWindowFrameRateFps`. Processor input
uses the same endpoint method; draw calls use first-to-last draw timestamps.
The raw endpoints are retained for replay. Missing/reset endpoints stay unknown
and fail collection rather than producing a fabricated rate. The minimum stays
30 fps and verdicts use unrounded values; no acceptance tolerance was added.

The [offline re-evaluation](measurements/crop-acceptance-c922-a40114c-endpoint-reanalysis.json)
uses the same helper as the page on the saved physical report. All three crop
rates meet the unchanged threshold. Capture and pass-through trial 1 still
presented at 29.753 fps, so their strict checks remain failed; this is recorded
separately from the camera media timeline near 30 fps. The original report is
preserved and no extra physical run was used to calculate these rates.

The [native controlled-GC synthetic report](measurements/crop-benchmark-native-gc-endpoints-normal.json)
completed normal measurement windows on Windows Chrome 154.0.8037.98 with Node
v26.7.0, four GC observations, successful effect/camera cycles, retained-heap
checks within budget, and all 19 tracks ended. Input was an animated canvas,
not a physical camera. Its zero SHA is a fixture value and the tested benchmark
was the working copy; it proves the launcher/protocol, not device acceptance.
A final shortened native rerun also verified the explicit collector-version
handshake, npm-script argument forwarding, and local report save.

Firefox long-window testing with the canvas-generated input stalled during the
timing phase. Replacing that fixture with Firefox's configured native fake
`getUserMedia` source completed the same normal windows with sufficient matched
tokens, without changing the shipped processor. The normal Firefox test now
uses that input; all fixture reports are marked synthetic. This is not a
physical Firefox performance claim. CDP GC is Chromium-only; throughput fixtures
requiring `requestFrame` are capability-gated, while existing Firefox automatic
fallback and lifecycle coverage remain active.

Physical post-GC memory evidence remains pending user operation. The task and
Draft PR stay in manual review; neither a synthetic pass nor a metadata-only
reanalysis completes the remaining acceptance criteria.

## Development audit gate remediation

The first CI run for the prepared launcher detected existing development-only
advisories: [tinypool worker options](https://github.com/advisories/GHSA-5gmw-xhrv-c9v3),
[tinypool run options](https://github.com/advisories/GHSA-85c8-ppgw-ccpr), and
[source-map-js indexed offsets](https://github.com/advisories/GHSA-68fv-2mgg-jv7q).
The approved supply-chain policy requires immediate critical/high remediation.

The formatter pins tinypool 2.1.0 exactly. A narrowly scoped override selects
2.1.2 for `oxfmt@0.65.0>tinypool`; source-map-js resolves to its compatible patch
1.2.2. Direct development-tool versions, React peer range, runtime imports and
public exports are unchanged. pnpm 11 reads these settings from
`pnpm-workspace.yaml`; only the root package is included. The lockfile was
regenerated by pnpm, no audit exception was added, and production/development
audits, license/integrity policy checks and all 224 registry signatures passed.
These overrides must be reviewed with future toolchain updates and removed
when the upstream constraints safely resolve patched releases.
