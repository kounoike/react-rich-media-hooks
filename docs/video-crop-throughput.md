# Fixed-crop throughput investigation

TASK-1.25 independently reproduced an output scheduling loss on 2026-10-07. A crop can draw every input frame and still deliver fewer frames when `canvas.captureStream(30)` samples the canvas through another periodic timer. The input video's callbacks and the canvas capture timer have separate phases.

The [canvas capture specification](https://w3c.github.io/mediacapture-fromelement/#html-canvas-element-media-capture-extensions) describes a periodic capture-request flag. A paint can be captured only while that flag is set; explicit `requestFrame()` requests capture of the next paint without waiting for the periodic timer. This explains the measured dependence on output capture policy and startup phase.

## Controlled experiment

Open `/tests/browser/video-crop-throughput.html` on the task Vite server. The current task server is available at `http://localhost:4174/tests/browser/video-crop-throughput.html`.

The page defaults to a synthetic 1280×720 source. It paints at 30 fps and explicitly requests capture of each generated frame, while advertising 30 fps in the source track settings. No camera is acquired for this mode.

Four conditions use the same live source:

- `direct`: display the source without a crop.
- `library`: run the actual `createCanvasCropProcessor` implementation.
- `timer`: draw the 960×720 crop and use the original `captureStream(30)` timer policy.
- `request`: perform the same draw and call the output track's `requestFrame()` immediately afterwards, retaining `captureStream(30)` and its track settings.

Each condition has one second of warm-up followed by six seconds of measurement. The second trial reverses condition order. Per-frame observation only records video callback metadata and synchronous draw duration: no pixel readback, optical marker decoder, prototype hooks, screenshots, Performance recording, or per-frame DOM updates are used. The input video is detached in the recorded experiments.

FPS is calculated from the difference between the first and last `presentedFrames` values divided by their callback timestamp interval. Callback count, callback gaps, wall-window rate, endpoint metadata, draw duration, output settings, and cleanup are also retained. A difference between callback rate and presented rate indicates missed callbacks rather than proving undelivered camera frames. Library input observation uses a separate reference video of the same track; timer/request input observation uses the video being drawn.

## Windows Chrome 154 results

All results below use the synthetic source on the Windows reference host. These are browser/pipeline evidence, not physical-camera acceptance measurements.

| Actual library | Trial 1 | Trial 2 | Trial 3 |
| --- | ---: | ---: | ---: |
| Input before fix | 29.918 fps | 30.001 fps | 30.001 fps |
| Output before fix | 26.219 fps | 30.000 fps | 26.798 fps |
| Input after fix | 30.001 fps | 30.001 fps | 30.000 fps |
| Output after fix | 30.001 fps | 30.001 fps | 30.000 fps |

In the after-fix run, the unchanged timer control delivered 26.314, 28.493, and 28.325 fps while the explicit-request control delivered approximately 30 fps in every trial. Both controls had approximately 0.3 ms synchronous draw p95. All output callback-gap counts were zero. The missing timer-control frames were therefore lost before presentation, while drawing and input observation continued at approximately 30 fps. Their exact sensor-level count is not measurable with this fixture.

The original policy occasionally reaches 30 fps, so one successful trial does not disprove the issue. The unchanged timer control remaining slower in the same after-fix run distinguishes a policy change from a general improvement in host performance.

Raw reports: [before](measurements/crop-throughput-chrome154-before.json), [after](measurements/crop-throughput-chrome154-after.json). Both completed and confirmed source track release. The current diagnostic also observes all generated and cropped tracks and reports their state after cleanup.

## Targeted implementation change

The runtime requests the captured output frame after each successful crop draw when the source reports a positive rate at or below the configured output rate (up to 30 fps). The source stays detached; the draw backend, output dimensions, and declared output rate remain the same.

The source rate is rechecked for each draw so an in-place change from 30 to 60 fps disables explicit requests and retains the original 30 fps output cap. The final live-rate guard was also measured on Windows: library output was 30.001, 30.001, and 30.001 fps across three trials. All four observed source/output tracks ended after cleanup. See the [final guard report](measurements/crop-throughput-chrome154-live-rate-guard.json).

Explicit requests can bypass the automatic rate gate. Faster or unknown-rate sources therefore retain the original automatic capture policy, preserving the 30 fps output limit. A browser without `requestFrame()` also retains that policy. Existing cancellation, output replacement, original-media fallback, and disposal remain in place.

The raw request control deliberately demonstrates explicit capture and is not a rate-limited implementation for arbitrary faster sources. Select `library` alone when using the 60 fps synthetic source to check the runtime's output cap.

## Remaining evidence

The user supplied a completed camera comparison started at `2026-10-07T09:56:51.157Z`, on Windows Chrome 154 with 1280×720 input and 960×720 crop output. Input video was detached. The three library output/input ratios were 1.000004, 1.000004, and 1.000021: output tracked the approximately 29.917 fps input in all three trials. This confirms that no additional crop throughput reduction was observed in this camera run; it does not establish exactly 30 fps sensor delivery.

| Camera trial | Library input | Library output | Original timer output |
| --- | ---: | ---: | ---: |
| 1 | 29.917 fps | 29.917 fps | 29.246 fps |
| 2 | 29.916 fps | 29.917 fps | 29.917 fps |
| 3 | 29.916 fps | 29.917 fps | 29.750 fps |

The original timer control had an output/input rate ratio of 0.977577 in trial 1, a clear remaining rate shortfall. Trial 3's smaller endpoint-rate difference is not sufficient to count lost frames: input and output each observed 179 callbacks, with different endpoint spans. The explicit-request control matched input to within approximately 0.006% in every trial. All observed callback-gap counts were zero; this is not an exact count of sensor frames never delivered. Ten observed source/output tracks were ended after cleanup. Library draw counts/timings are not instrumented; the zero draw count does not describe the actual crop workload.

See the [user-report summary](measurements/crop-throughput-camera-2026-10-07-summary.json). It is explicitly a summary of the pasted evidence, not the full original JSON. The report did not record camera model or commit identity, and did not measure latency, first usable frame, retained heap, or the five required effect cycles. The original reference-device benchmark remains necessary for those metrics and TASK-1.25 acceptance. Camera measurement remains user-operated.

The user subsequently supplied a [five-repeat throughput table](measurements/crop-throughput-five-repeat-user-table.csv), recorded at display-rounded precision. Library and request output/input ratios were 1.000 in all five trials. Timer ratios were 0.972, 0.944, 0.972, 0.966, and 0.961. This strengthens throughput repeatability evidence. These are five repetitions of the four FPS profiles, not five session-owned add/update/bypass/remove cycles or five camera stop/start cycles. Those operation checks are implemented in `/tests/browser/video-crop-benchmark.html` and run automatically during its normal measurement flow.

The preliminary Firefox experiment produced no observed frames because its synthetic source called an unavailable `requestFrame()` method. On a loaded page, Firefox 153 explicitly reported `Synthetic requestFrame unavailable` for both attached and detached input conditions. These are fixture capability failures, not FPS comparisons or proof of a DOM attachment problem. The runtime feature check retains automatic capture on such tracks; no Firefox performance improvement is claimed. Edge, Safari, and mobile remain within decision-7's existing cadence.

## Follow-up acceptance-page provenance correction

The subsequent full camera acceptance report declared commit
`4a5fd536640a98407736b1511701e332b226410e`, but the existing Vite server served
an older runtime through its cached plain compiled core entry. This explains
why the declared SHA could not establish that the acceptance page exercised the
same implementation as this source-importing comparator. See the
[provenance finding and corrected protocol](video-crop-benchmark.md#physical-report-declaring-commit-4a5fd53-provenance-failure).
The full report supplies five successful effect and five successful camera
cycles and zero live tracks after cleanup. Corrected physical throughput,
processing latency, and controlled post-GC retention remain unverified.
