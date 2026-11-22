# Audio latency target: provenance and proposed revision process

Status: investigation and proposal for TASK-1.12 AC3, 2026-11-22, starting at
`998aa6fd1a7a51795d0376f8116b96251f4a17e3`. The owner authorized this prerequisite
before further optimization/qualification. This document selects no new numeric
limit, changes no runtime, measurement script, CI policy or PR behavior, and
passes no acceptance criterion. [Decision-12](../../../backlog/decisions/decision-12%20-%20Qualify-audio-latency-targets-through-approved-scenarios-and-baseline-evidence.md)
is **proposed**, not accepted. Existing 40 ms results retain their old verdicts.

## Finding and authority

**40 ms is a documented, user-approved provisional product hypothesis whose
numerical derivation is undocumented in the audited evidence.** It is neither
an established external denoiser standard nor a number that agents may discard
because an implementation misses it. Approval of the contract establishes its
present authority; it does not demonstrate perceptual validation of the value.

The audit found no cited standard, participant study, target-user experiment,
scenario-specific delay allocation or calculation explaining why 40 rather
than 20, 30 or 50 ms was chosen. This is a bounded finding about the inspected
repository/history and public PR evidence, not proof that no private discussion
or relevant research exists. The owner can supply missing original evidence.

| Evidence | What it establishes | What it does not establish |
| --- | --- | --- |
| [Decision-1](../../../backlog/decisions/decision-1%20-%20Adopt-the-initial-product-and-quality-contract.md), Context/Considered Options/Decision | Adopts doc-1; deliberately uses falsifiable provisional targets before measured release claims | A derivation of 40 ms or a fixed reference device |
| [doc-1](../../../backlog/docs/product/initial-product-quality-contract/doc-1%20-%20Initial-Product-and-Quality-Contract.md), Status, Quality hypotheses, Consequences | User-approved revised contract; audio p95 <=40 ms beyond browser-reported baseline; no sustained underruns; numerical revisions require evidence and an explicit decision | Which browser baseline field/boundaries, percentile unit, scenario or user tolerance justified 40 |
| [TASK-1.1](../../../backlog/tasks/task-1.1%20-%20Define-the-initial-product-and-quality-contract.md), proposal/scope revision/approval notes | Earlier unapproved **20 ms no-op audio** proposal; user expands scope to first-party denoising; later approval of revised contract | A controlled experiment supporting the later 40 ms denoising value; the old 20 ms is not a competing accepted limit |
| [audio doc-5](../../../backlog/docs/research/media/doc-5%20-%20Browser-Audio-Processing-Feasibility.md), accepted baseline/probe/conclusion | Inherits 40; about 21.6 ms of browser-reported lower-bound signals from one synthetic Chromium smoke; explicitly not p95/device/speech qualification | Independent validation or derivation of 40; its sources do not document such a derivation |
| [verification doc-6](../../../backlog/docs/verification/doc-6%20-%20Cross-Browser-Verification-Strategy.md), sections 4–6 | Inherits provisional 40; same-profile capture/no-op baselines, >=3 independent runs, per-row evidence, measured latency rather than API telemetry alone | A chosen physical reference matrix or a user-based numeric justification |
| [TASK-1.12](../../../backlog/tasks/task-1.12%20-%20Deliver-a-composable-audio-processing-vertical-slice.md), Decisions 8/10/11 | Continues the gate, documents failures and rejects fallback-only closure; Decision-11 explicitly retains graph-inclusive 40 ms | An approved threshold revision or proof that fallback qualifies first-party denoising |

Doc IDs are duplicated in the repository: video research is also doc-5 and API
contract is also doc-6. Exact paths above identify the audio and verification
sources; no renumbering or historical edits are part of this work.

### History and public review trace

- [`7251bc3`](https://github.com/kounoike/react-rich-media-hooks/commit/7251bc30438d85dffeb9f145bb28d5c88269899e), merged 2026-08-16: earliest reachable `git log --all --reverse -G '40.?ms|40 ms|40 milliseconds'` introduction. Adds Decision-1/doc-1 and retains the earlier 20 ms proposal and scope/approval narrative in TASK-1.1. The contract records approval on 2026-08-15; this differs from commit date and is not a chronology error.
- [PR #2](https://github.com/kounoike/react-rich-media-hooks/pull/2): body describes approved hypotheses and document validation; the inspected issue comment concerns Decision-body restoration. The reviews endpoint returned no reviews. Neither provides numerical derivation; missing public review text does not revoke the recorded owner approval.
- [`6b0d6e4`](https://github.com/kounoike/react-rich-media-hooks/commit/6b0d6e4), 2026-08-17: audio doc-5 inherits the hypothesis. [`a820f0f`](https://github.com/kounoike/react-rich-media-hooks/commit/a820f0f), 2026-08-19: verification doc-6 carries it forward.
- Those four authoritative files each have only their introducing commit in the reachable `--all` path history at this checkpoint. Later implementation commits `3bf12cd`, `93993e5`, `cd1a222`, `88b5586` and `998aa6f` operationalize/profile/test it; they do not add a user-research derivation. This audit covers reachable Git refs and inspected PR #2, not deleted refs or private chat.

## External evidence: useful boundaries, not replacement limits

Reviewed on 2026-11-22:

- [W3C Web Audio Recommendation, baseLatency/outputLatency](https://www.w3.org/TR/2021/REC-webaudio-20210617/#dom-audiocontext-baselatency) and [2026 Web Audio 1.1 draft](https://www.w3.org/TR/2026/WD-webaudio-1.1-20260922/#dom-audiocontext-baselatency) distinguish destination-to-audio-subsystem buffering from graph processing and hardware output timing. Neither supplies this library's denoising p95 limit. A MediaStream track consumer need not traverse the hardware destination described by those fields.
- [ITU-T G.114 (05/2003), sections 1, 3 and 4](https://www.itu.int/rec/dologin_pub.asp?id=T-REC-G.114-200305-I!!PDF-E&lang=e&type=items), listed [in force with amendments](https://www.itu.int/rec/T-REC-G.114/en), concerns total one-way conversational/network delay. Its roughly 150 ms interactivity discussion and 400 ms network-planning bound do not allocate 40 ms to a browser denoiser, specify added p95, or validate self-monitoring. It cautions that some interactive tasks are affected below 100 ms. Do not subtract an assumed browser/network budget from these figures to invent a library allowance.
- [RFC 7874](https://www.rfc-editor.org/rfc/rfc7874.html), sections 3–5, specifies WebRTC codecs, levels and echo processing, not this denoiser's added p95. Its 40 ms occurrence concerns minimum DTMF event duration, not an audio-effect latency SLO.

These sources help define endpoints and avoid category errors. They are not
retrospective provenance for the repository's original choice. G.114 Annex A also mentions a 40 ms mobile-system planning objective; that
is not a browser-denoising p95 rule. No claim of
exhaustive external literature review or standards conformance follows.

## Metric audit: three different quantities

1. **Original contract wording:** <=40 ms beyond an unspecified browser-reported
   audio baseline. It does not identify the timestamp endpoints or aggregation.
2. **Legacy implemented probes:** the early
   [summarize-audio-latency.py](../../../scripts/summarize-audio-latency.py) uses
   nonnegative 0–300 ms correlation lag and NumPy `higher` p95; the later
   [audio_latency_analysis.py](../../../scripts/audio_latency_analysis.py) uses
   signed lag, frame-indexed state/exclusions, signed known-delay controls and
   nearest-rank quantiles. In the latter, with accepted processed-window lags
   `Lp[i]` and same-trial original-window lags `L0[j]`:

   `DeltaLegacy[q] = Qq(Lp) - median(L0)`

   This follows because a constant median is subtracted from every accepted
   processed lag. It includes transport/graph/framing/model costs; pass-through
   cost and model delay are never deducted. It is **not** subtraction of
   `AudioContext.baseLatency`. A one-second correlation lag is the estimator's
   sample unit, not a latency measurement for every individual audio sample.
3. **Proposed future paired estimand:** `d[i] = Lp[i] - L0[i]` for matched windows
   from the same source/reference clock and output consumer, then report
   `Q50/Q95/Q99(d)`, alongside the absolute `Lp` and `L0` distributions. Pairing,
   endpoint diagrams and clock calibration must first be validated; this is
   not a new implementation or an approved replacement metric. In general,
   `Q95(Lp-L0)` differs from `Q95(Lp)-median(L0)` and from subtracting two p95s.

Thus there is a material ambiguity between approved prose and operational
measurement. The current scripts are useful evidence, not a retroactive
amendment of Decision-1. Clarifying or replacing that estimand needs owner
approval and versioned parallel results. API latency telemetry remains separate;
do not sum overlapping fields or substitute a browser's reported zero for a
physical microphone/headset measurement.

### Preserve the old gate and its uncomfortable results

| Frozen legacy cell | Original median | Total processed p95 | Added p95 under old metric | Old disposition |
| --- | ---: | ---: | ---: | --- |
| Prepared-first native embedding, before final host hardening | +4 ms | 35.3125 ms | 31.3125 ms | Numeric probe within 40; not overall release qualification |
| Final host native embedding, 60/60 windows over 600.0107 stable seconds | -6 ms | 35.3125 ms | **41.3125 ms** | **FAIL 40**; two observer jumps and three zero quanta remain unclassified |
| WSL Chromium short screen, 59/60 windows | -12 ms | 30.6875 ms | **42.6875 ms** | **FAIL 40**, excluded window/continuity limits; no 600-second claim |

See [final host report](audio-private-final-host-endurance-2026-11-21.json),
[headless report](audio-private-headless-2026-11-21.json) and
[private Worker history](private-worker.md). Different signed baselines account
for the first two derived deltas; those separate trials do not prove a causal
10 ms host-watchdog regression or prove the target should become 50 ms.
Negative baselines and opposing observer jumps cannot be clamped/cancelled to
obtain a pass. Near-boundary numerical precision is not an uncertainty bound.

## Proposed prerequisite and owner gates

The recommendation is **approve scenario/metric/protocol design first, retain
40 ms pending evidence, then make a separate explicit numerical/support choice**.
No further optimization, new qualification trial or target adoption is authorized
by this audit. Read-only replay of existing raw data is verification only.

### Gate A — approve the product scenario and its boundaries

| Scenario candidate | Measurement boundary and user outcome | Product decision still needed |
| --- | --- | --- |
| S1: processed voice track for an application-owned downstream consumer | Same captured source -> standard processed track -> fixed consumer; speech intelligibility, responsiveness and, if composed with video, A/V alignment | Recommended primary scenario; owner selects the actual consumer and acceptable user outcome. Networking/codec budgets belong to the application and are not silently included in this library's guarantee |
| S2: live headphone self-monitoring | Physical microphone/acoustic input -> headphones/acoustic output, plus matched unprocessed condition; perceived delay/distraction | Include only if explicitly approved; it can demand a substantially different budget. No musical-performance or sidetone guarantee is inferred from doc-1 |
| S3: metering/non-auditory preview | Capture -> observable meter/state | Separate responsiveness metric; cannot replace denoised-output latency or justify relaxing S1/S2 |

Offline post-processing, recording, network transport and musical-instrument
monitoring are not new first-release scope. A conversational application may
use the standard track, but G.114 does not turn the library into a call stack.
Define absolute user-experience budget and how much may be allocated to the
library, with headroom for the actual application. Adding marginal p95 budgets
is not a proof of an end-to-end p95; measure the composed scenario.

### Gate B — preregister the metric and experiment before looking for a pass

- Publish source/capture, bypass, pass-through, denoiser and consumer endpoints,
  timestamps/clock mappings and a physical reference diagram. Use identical
  capture settings, AEC/AGC/browser noise suppression policy, rates/channels,
  content hashes, output consumer, gain and cache/power conditions within pairs.
- Keep the legacy analyzer, thresholds, raw hashes, exclusions and report fields
  unchanged. Any future analyzer gets a distinct metric/protocol ID, explicit
  pairing and quantile rule, clock/uncertainty calibration and side-by-side
  legacy output. Switching estimator or sample unit is not merely relabeling T.
- Report absolute bypass/processed and added **p50/p95/p99/max**, count, coverage,
  uncertainty and per-trial values; retain signed values. Nearest-rank p99 of
  only 60 observations is their maximum, not a stable tail estimate. Propose
  >=3 independent 10-minute runs per cell (doc-6 minimum), dense nonoverlapping
  windows and >=1000 valid matched observations across runs for tail analysis;
  pilot precision/autocorrelation determines whether more are required. These
  are proposed planning minima, not an enacted harness change or proof of power.
- For independent observations, `1 - 0.99^n` reaches 0.95 at n=299 merely to see
  at least one top-1% event; it does not accurately estimate p99. Speech windows
  and thermal/scheduler drift are correlated. Use trial/block-level resampling,
  publish interval method/coverage assumptions and a precision goal before data
  collection; do not treat 60 correlated windows as independent listener trials.
- Counterbalance paired/control order and repeat bypass before/after processing
  to detect drift; use simultaneous matched paths where clock/crosstalk tests
  demonstrate validity. Calibrate signed zero/known delays and consumer graph
  cost, retaining it in the primary added metric. Physical loopback must check
  its own equipment delay rather than borrow headless API telemetry.
- Keep every attempted window and every interval in the state timeline. Exclude
  only preregistered invalid estimates, record reasons/counts, and report coverage
  and whole-run counters. Fallback, gaps or missing reference cells cannot become
  successful denoising. Distinguish estimator failure from audible failure; until
  classified, neither can be called a continuity pass. Do not resample only a
  favorable minute or average across incompatible cells.

### Gate C — approve and freeze a reference matrix

Candidate rows inherit doc-6; exact machines are **unselected**, not silently
chosen from whichever host passes:

| Required candidate row | Reference hardware/device records | Current status |
| --- | --- | --- |
| Standalone Chrome + Firefox on native Windows and/or Linux | Owner-approved low and middle desktop tiers; CPU/model/core count, RAM, OS/build, driver, wired mic/headset and power mode; exact browser builds | WSL headless/Orca embedding are diagnostics, not substitutes |
| Standalone Edge on Windows | Same Windows tier/profile/device, tested independently of Chrome | Missing local runtime; unknown |
| Safari on macOS | Exact Apple hardware, OS, Safari build, physical devices | WebKit automation is not Safari/device evidence; unknown |
| Other capture rates/channel layouts | 44.1/48 kHz and mono/stereo where supported, actual negotiated settings and conversion paths | Raw Worker eligibility does not expand; ineligible inputs retain current Worklet/fallback |

Freeze current stable versions and, when approved by the compatibility contract,
minimum supported builds; record patch versions and retest on refresh. Select
at least a low and middle tier to avoid calling an embedding's fast CPU the
universal reference. A high tier is diagnostic unless explicitly part of the
support promise. Wired devices provide the reproducible primary condition;
Bluetooth/speakers/AEC, mobile and unusual devices are separate owner-selected
cells, not averaged into it. Missing cells remain unknown; scope reduction also
requires explicit approval rather than silently dropping Firefox/Safari.

### Gate D — expose contention, continuity and quality tradeoffs

- Freeze idle and loaded conditions per row: retain the legacy requested
  **20 ms busy loop every 250 ms**, logging actual timing, plus capture-only,
  composed audio/video and a separately specified sustained CPU-load profile
  on the chosen hardware. Define load/power/visibility controls in the pilot;
  do not vary them to suit a backend. Background/interruption/recovery are
  separate lifecycle cases, not normal always-on performance promises.
- Retain 600-second denoised continuity, complete sample/timestamp accounting,
  missing/late/duplicate/nonfinite/zero counters, queue depth, Worker/Worklet
  failures and recovery. Keep the **2.667 ms Worklet callback budget** where
  applicable separate from added p95; a different latency SLO cannot relax it.
- Keep the current >=6 dB noise attenuation and <=0.03 intelligibility-loss
  hypotheses, all semantic levels, clipping/artifact checks and representative
  demographic/noise/rate/device slices. The existing **119/120** numeric result
  and pending human review remain unresolved regardless of a future T.
- Use separate blinded listening and interactive-delay studies. Randomize and
  blind delay conditions around candidate budgets (including both sides of 40)
  with quality held constant, then cross delay with approved denoising levels,
  noise, pauses and speech. Measure task success, turn timing where applicable,
  discomfort and quality preference; control AEC/AGC, headroom and A/V alignment.
  No participant study is conducted or implied here. Start with a representative
  pilot to estimate effects/variance; preregister the confirmatory sample size,
  meaningful degradation and acceptance/noninferiority rule before outcomes.
  The existing denoising A/B/C packet alone does not validate latency tolerance.
- Evaluate extra buffering as a latency/underrun tradeoff, faster compute as a
  quality/CPU/asset tradeoff, and thermal/heap behavior over time. Reject a
  supposed latency win achieved by dropped samples, speech damage, fallback,
  unsupported APIs or hidden resource growth. Keep artifact/import/size/privacy,
  ownership and cleanup gates independent.

### Gate E — select or retain a threshold with a new explicit decision

| Alternative | Supporting evidence needed | Tradeoff / recommendation |
| --- | --- | --- |
| A: retain universal 40 ms as the present engineering/release gate | Owner reconfirms the scenarios, metric and reference coverage; evidence shows user outcomes and feasible delivery with margin | Preserves ambition and comparability; does not fix the missing numerical rationale or mean current failures pass |
| B: approve scenario-specific validation first; retain 40 pending data | Gates A–D agreed, then pilot/confirmatory paired user and technical evidence with uncertainty and quality/continuity | **Recommended process**, not an approved replacement target; may ultimately retain, tighten or increase T, or narrow scope by explicit choice |
| C: raise a universal gate to 50/60 ms because recent results narrowly miss 40 | Would still need scenario/user/budget/matrix evidence independent of current backend outcomes | Not recommended: 41–43 ms measurements alone only describe implementation; they do not establish acceptability or justify rounding up |
| D: use 150/400 ms conversational/network guidance as the library allowance | A product-specific allocation and full scenario evidence would still be necessary | Reject direct substitution: wrong boundary/statistic; can harm self-monitoring and consume application headroom |

The owner must select the scenario(s), consumer/endpoints, reference devices,
study resources, metric and preregistration before more latency optimization or
qualification. That approval would authorize the protocol, **not** a new T.
After evidence, a later explicit decision must name the chosen T and statistic,
scenario/support cells, uncertainty/margin rule, quality/continuity constraints,
activation date and exact superseded Decision-1/doc-1 audio clauses and dependent
Decision-8/10/11 references. Preserve accepted histories and old verdicts; amend
canonical references through the Backlog workflow only after approval. If 40 is
retained, record its new rationale and still keep failures as failures. AC3 can
pass only when all its approved gates, not just a revised number, are proven.

## Reproducible audit checks

No new benchmark is run. At the checkpoint, the existing 13 analyzer regressions
and local raw replay can verify unchanged behavior without editing old reports:

```sh
git log --all --reverse --oneline -G '40.?ms|40 ms|40 milliseconds' -- backlog docs scripts src tests
git show 7251bc3 -- backlog/decisions/decision-1* backlog/docs/product backlog/tasks/task-1.1*
PYTHONDONTWRITEBYTECODE=1 uv run --no-project --with numpy==2.3.5 \
  --with scipy==1.16.3 python -m unittest discover -s tests -p 'test_audio_latency_analysis.py'
PYTHONDONTWRITEBYTECODE=1 uv run --no-project --with numpy==2.3.5 \
  --with scipy==1.16.3 python scripts/summarize-audio-routes.py \
  .cache/audio-private/final-host-endurance.json > /tmp/audio-provenance-native-replay.json
```

Raw audio stays local; if the hashed raw report is unavailable, report replay as
blocked rather than reconstructing PCM from scalar summaries. Compare only
legacy baseline/phases/qualification fields to committed reports, which omit
raw Worker arrays. Neither read-only replay nor numeric-target research is
permission to alter scripts, production behavior or old acceptance outcomes.
