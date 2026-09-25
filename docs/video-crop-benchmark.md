# Fixed camera crop benchmark

## Approved scenario and budgets

This report covers the TASK-1.11 vertical slice approved in `decision-7`:
one user-selected, fixed crop of a 1280×720 camera source requested at 30 fps.
The crop region is `{ x: 0.125, y: 0, width: 0.75, height: 1 }`, yielding a
960×720 output. Background effects and auto-framing are outside this task.

The adopted TASK-1.6/doc-6 targets are:

- Capture first usable frame within 500 ms after the capture request.
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
