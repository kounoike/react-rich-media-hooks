import type { MediaSession, OperationResult, VideoEffectConfig } from "../../src/core/index.js";
import type { CropOptions } from "../../src/effects/video/index.js";

type Profile =
  | "capture-only"
  | "pass-through"
  | "fixed-crop"
  | "crop-dom-detached"
  | "crop-dom-connected";
type OperationStatus = OperationResult["status"];

const isCropProfile = (profile: Profile): boolean =>
  profile === "fixed-crop" || profile === "crop-dom-detached" || profile === "crop-dom-connected";

interface FrameMetadataLike {
  readonly presentedFrames?: number;
}

type VideoWithFrameCallbacks = HTMLVideoElement;
interface NavigatorUserAgentData {
  readonly brands?: readonly { readonly brand: string; readonly version: string }[];
  readonly mobile?: boolean;
  readonly platform?: string;
  getHighEntropyValues?: (hints: string[]) => Promise<Record<string, unknown>>;
}

interface NavigatorWithUserAgentData extends Navigator {
  readonly userAgentData?: NavigatorUserAgentData;
}

interface ExtendedPerformance extends Performance {
  readonly memory?: { readonly usedJSHeapSize: number };
}

interface StageMetric {
  readonly run: number;
  readonly profile: Profile;
  readonly operationStatus: OperationStatus | "not-applied";
  readonly processorStatus: string;
  readonly sourceSettings: Record<string, number | string | boolean>;
  readonly outputSettings: Record<string, number | string | boolean>;
  readonly warmupMs: number;
  readonly measuredMs: number;
  readonly frames: number;
  readonly frameRateFps: number;
  readonly presentedFrameGaps: number;
  readonly presentedFrameGapPercent: number;
  readonly sourceToPreviewP50Ms: number | null;
  readonly sourceToPreviewP95Ms: number | null;
  readonly sourceToPreviewMaxMs: number | null;
  readonly latencySamples: number;
  readonly latencyMeasuredMs: number | null;
  readonly staleMarkerSamples: number;
  readonly processorInputVideoFrameCallbacks: number | null;
  readonly processorInputVideoFrameRateFps: number | null;
  readonly processorInputPresentedFrameGaps: number | null;
  readonly processorInputVideoConnected: boolean | null;
  readonly cropDrawImageCalls: number | null;
  readonly cropDrawImageFailures: number | null;
  readonly cropDrawImageRateFps: number | null;
  readonly cropDrawImageDurationP95Ms: number | null;
  readonly cropCallbackDurationP95Ms: number | null;
  readonly latencyMethod: "processor-sideband-id-v1";
  readonly cropSetupMs: number | null;
  readonly budgetChecks: {
    readonly frameRateAtLeast30: boolean;
    readonly presentedFrameGapAtMost1Percent: boolean;
    readonly sourceToPreviewP95AtMost50Ms: boolean | null;
    readonly cropSetupWithin1Second: boolean | null;
  };
}

interface EffectCycle {
  readonly cycle: number;
  readonly addStatus: OperationStatus;
  readonly updateStatus: OperationStatus;
  readonly bypassStatus: OperationStatus;
  readonly removeStatus: OperationStatus;
  readonly bypassRestoredInput: boolean;
  readonly removeRestoredInput: boolean;
  readonly oldTracksEnded: boolean;
}

interface SessionCycle {
  readonly cycle: number;
  readonly startStatus: OperationStatus | "not-started";
  readonly trackEndedAfterStop: boolean;
}

interface CameraEvidence {
  readonly requested: {
    readonly width: number;
    readonly height: number;
    readonly frameRate: number;
  };
  readonly settings: Record<string, number | string | boolean>;
  readonly cameraLabel: string | null;
  readonly mediaTrackState: string;
  readonly physicalDeviceResult: string;
}

interface BenchmarkRecord {
  readonly schemaVersion: 1;
  readonly taskId: "TASK-1.25";
  readonly decisionId: "decision-7";
  status: "running" | "completed" | "stopped" | "failed";
  readonly startedAt: string;
  finishedAt: string | null;
  readonly commitSha: string;
  readonly hostDescription: string;
  readonly runtimeDescription: string;
  readonly cameraDescription: string;
  browser: Record<string, unknown>;
  camera: CameraEvidence | null;
  readonly budgets: {
    readonly captureFrameRateFpsMin: 30;
    readonly capturePresentedFrameGapPercentMax: 1;
    readonly firstUsableFrameMsMax: 500;
    readonly cropFrameRateFpsMin: 30;
    readonly cropSourceToPreviewP95MsMax: 50;
    readonly warmEffectSetupMsMax: 1000;
    readonly retainedHeapGrowthPercentMax: 10;
    readonly retainedHeapGrowthBytesFloor: number;
  };
  firstUsableFrameMs: number | null;
  stages: StageMetric[];
  effectCycles: EffectCycle[];
  sessionCycles: SessionCycle[];
  sessionStartCalls: number;
  profileSessionStartCalls: number | null;
  heapBeforeEffectCyclesBytes: number | null;
  heapAfterEffectCyclesBytes: number | null;
  heapEffectGrowthWithinBudget: boolean | null;
  heapBeforeSessionCyclesBytes: number | null;
  heapAfterSessionCyclesBytes: number | null;
  heapMeasurementMethod: "approximate-uncollected-used-js-heap" | "controlled-post-gc-used-js-heap";
  heapGrowthWithinBudget: boolean | null;
  retainedHeapGrowthWithinBudget: boolean | null;
  getUserMediaRequestToStreamMs: number | null;
  cleanup: Record<string, unknown> | null;
  summary: Record<string, unknown> | null;
  issues: string[];
}

declare global {
  interface Window {
    videoCropBenchmarkRecord?: BenchmarkRecord;
    /** Automation hook: collect garbage and return the isolated renderer's used heap. */
    videoCropBenchmarkCollectGarbage?: () => Promise<number>;
  }
}

const TEST_MODE = new URLSearchParams(window.location.search).get("test") === "1";
const WARMUP_MS = TEST_MODE ? 50 : 1000;
const MEASURE_MS = TEST_MODE ? 250 : 2000;
const LATENCY_MEASURE_MS = TEST_MODE ? 500 : 6000;
const RUN_DOM_COMPARISON = new URLSearchParams(window.location.search).get("dom") === "1";
const MEASUREMENT_FRAME_TIMEOUT_MS = TEST_MODE ? 1500 : 10_000;
const SETTLE_MS = TEST_MODE ? 25 : 500;
const EFFECT_REGION: CropOptions["region"] = { x: 0.125, y: 0, width: 0.75, height: 1 };
const UPDATED_REGION: CropOptions["region"] = { x: 0.25, y: 0, width: 0.5, height: 1 };

const startButton = document.querySelector<HTMLButtonElement>("#start-camera")!;
const runButton = document.querySelector<HTMLButtonElement>("#run-measurements")!;
const stopButton = document.querySelector<HTMLButtonElement>("#stop-camera")!;
const downloadButton = document.querySelector<HTMLButtonElement>("#download-results")!;
const statusElement = document.querySelector<HTMLParagraphElement>("#status")!;
const preview = document.querySelector<VideoWithFrameCallbacks>("#preview")!;
const processorInputVideoSlot = document.querySelector<HTMLDivElement>(
  "#processor-input-video-slot",
)!;
const resultsElement = document.querySelector<HTMLPreElement>("#results-json")!;
const verdictBanner = document.querySelector<HTMLDivElement>("#verdict-banner")!;
const verdictOverall = document.querySelector<HTMLElement>("#verdict-overall")!;
const verdictMessage = document.querySelector<HTMLParagraphElement>("#verdict-message")!;
const verdictChecks = document.querySelector<HTMLUListElement>("#verdict-checks")!;
const trialResultsBody = document.querySelector<HTMLTableSectionElement>("#trial-results-body")!;
const commitInput = document.querySelector<HTMLInputElement>("#commit-sha")!;
const hostInput = document.querySelector<HTMLInputElement>("#host-description")!;
const runtimeInput = document.querySelector<HTMLInputElement>("#runtime-description")!;
const cameraInput = document.querySelector<HTMLInputElement>("#camera-description")!;
const physicalCameraInput = document.querySelector<HTMLInputElement>("#physical-camera-confirm")!;
physicalCameraInput.required = !TEST_MODE;
const markerCanvas = document.querySelector<HTMLCanvasElement>("#latency-marker")!;
const markerContext = markerCanvas.getContext("2d", { alpha: false })!;
const sampleCanvas = document.createElement("canvas");
sampleCanvas.width = 4;
sampleCanvas.height = 4;
const sampleContext = sampleCanvas.getContext("2d", { willReadFrequently: true })!;
sampleContext.imageSmoothingEnabled = false;

// Static source fixture; processing latency no longer requires photographing a display.
markerContext.fillStyle = "#ffffff";
markerContext.fillRect(0, 0, 4, 4);
sampleCanvas.width = 6;
sampleCanvas.height = 4;
sampleContext.imageSmoothingEnabled = false;
interface ProcessingLatencyProbe {
  sequence: number;
  readonly startedAt: Map<number, number>;
}
let activeLatencyProbe: ProcessingLatencyProbe | null = null;
let processorCallbackStartedAt: number | null = null;
const checksum = (sequence: number): number => (sequence ^ (sequence >> 8) ^ 0xa7) & 0xff;
const paintTimingToken = (context: CanvasRenderingContext2D, startedAt: number): void => {
  const probe = activeLatencyProbe;
  if (probe === null) return;
  probe.sequence = (probe.sequence + 1) & 0xffff;
  if (probe.sequence === 0) probe.sequence = 1;
  probe.startedAt.set(probe.sequence, startedAt);
  const token = probe.sequence | (checksum(probe.sequence) << 16);
  const fill = context.fillStyle;
  for (let bit = 0; bit < 24; bit += 1) {
    context.fillStyle = ((token >> bit) & 1) === 1 ? "#ffffff" : "#000000";
    context.fillRect((bit % 6) * 4, Math.floor(bit / 6) * 4, 4, 4);
  }
  context.fillStyle = fill;
};

const setStatus = (message: string): void => {
  statusElement.textContent = message;
};

type VerdictState = "ok" | "ng" | "pending" | "excluded";

interface VerdictCheck {
  readonly label: string;
  readonly detail: string;
  readonly state: VerdictState;
}

const verdictLabel = (state: VerdictState): string =>
  ({ ok: "OK", ng: "NG", pending: "未完了", excluded: "対象外" })[state];

const cameraSourceCheck = (record: BenchmarkRecord): VerdictCheck => {
  if (record.browser.toolMode === "synthetic Playwright timing") {
    return {
      label: "実機と入力解像度",
      detail: "疑似カメラ入力です。実機結果には使えません。",
      state: "excluded",
    };
  }
  const camera = record.camera;
  if (camera === null) {
    return {
      label: "実機と入力解像度",
      detail: "カメラを開始して設定を取得してください。",
      state: "pending",
    };
  }
  if (camera.physicalDeviceResult !== "user-confirmed physical reference camera") {
    return {
      label: "実機と入力解像度",
      detail: "実カメラの確認がありません。チェック欄を確認して新しい計測を開始してください。",
      state: "pending",
    };
  }
  const { width, height, frameRate } = camera.settings;
  if (typeof width !== "number" || typeof height !== "number" || typeof frameRate !== "number") {
    return {
      label: "実機と入力解像度",
      detail: "カメラの幅・高さ・fps設定を取得できませんでした。",
      state: "pending",
    };
  }
  const matchesTarget = width === 1280 && height === 720 && Math.abs(frameRate - 30) <= 0.5;
  const deviceName = camera.cameraLabel?.trim() || record.cameraDescription.trim();
  const hasVersionDetails =
    record.hostDescription.trim().length > 0 &&
    record.runtimeDescription.trim().length > 0 &&
    deviceName.trim().length > 0 &&
    typeof record.browser.userAgent === "string";
  const state: VerdictState = matchesTarget ? (hasVersionDetails ? "ok" : "pending") : "ng";
  const detail = `${deviceName || "カメラ名なし"}: ${width}×${height} @ ${frameRate.toFixed(2)} fps; ${
    hasVersionDetails ? "OS・機種・ブラウザ情報あり" : "OS・機種・ブラウザ情報が不足"
  }`;
  return { label: "実機と入力解像度", detail, state };
};

const profileStages = (record: BenchmarkRecord, profile: Profile): StageMetric[] =>
  record.stages.filter((stage) => stage.profile === profile);

const averageFrameRate = (stages: readonly StageMetric[]): string =>
  stages.length === 0
    ? "—"
    : `${(stages.reduce((sum, stage) => sum + stage.frameRateFps, 0) / stages.length).toFixed(
        1,
      )} fps`;

const runCoverageCheck = (record: BenchmarkRecord): VerdictCheck => {
  if (record.browser.toolMode === "synthetic Playwright timing") {
    return {
      label: "3モード×3回と反復操作",
      detail: "疑似入力の自動試験結果であり、実機の受け入れ判定には含めません。",
      state: "excluded",
    };
  }
  const profiles: Profile[] = ["capture-only", "pass-through", "fixed-crop"];
  const enoughTrials = profiles.every((profile) => profileStages(record, profile).length >= 3);
  const effectCyclesComplete =
    record.effectCycles.length >= 5 &&
    record.effectCycles
      .slice(0, 5)
      .every(
        (cycle) =>
          cycle.addStatus === "success" &&
          cycle.updateStatus === "success" &&
          cycle.bypassStatus === "success" &&
          cycle.removeStatus === "success" &&
          cycle.bypassRestoredInput &&
          cycle.removeRestoredInput &&
          cycle.oldTracksEnded,
      );
  const sessionCyclesComplete =
    record.sessionCycles.length >= 5 &&
    record.sessionCycles
      .slice(0, 5)
      .every((cycle) => cycle.startStatus === "success" && cycle.trackEndedAfterStop);
  const state =
    enoughTrials && effectCyclesComplete && sessionCyclesComplete
      ? "ok"
      : record.status === "completed"
        ? "ng"
        : "pending";
  return {
    label: "3モード×3回と反復操作",
    detail: `${profiles
      .map((profile) => `${profile}: ${profileStages(record, profile).length}/3`)
      .join(
        " · ",
      )}; エフェクト ${record.effectCycles.length}/5; 再起動 ${record.sessionCycles.length}/5`,
    state,
  };
};

const performanceCheck = (record: BenchmarkRecord): VerdictCheck => {
  if (record.browser.toolMode === "synthetic Playwright timing") {
    return {
      label: "計測予算",
      detail: "合成入力の数値は参考表示のみで、実機判定には使いません。",
      state: "excluded",
    };
  }
  const captures = profileStages(record, "capture-only");
  const passThrough = profileStages(record, "pass-through");
  const crops = profileStages(record, "fixed-crop");
  const allStages = [...captures, ...passThrough, ...crops];
  const latencyDataComplete = allStages.every((stage) => stage.sourceToPreviewP95Ms !== null);
  const checks: (boolean | null | undefined)[] = [
    record.firstUsableFrameMs === null ? null : record.firstUsableFrameMs <= 500,
    ...captures.map((stage) => stage.budgetChecks.frameRateAtLeast30),
    ...captures.map((stage) => stage.budgetChecks.presentedFrameGapAtMost1Percent),
    ...passThrough.map((stage) => stage.budgetChecks.frameRateAtLeast30),
    ...passThrough.map((stage) => stage.budgetChecks.presentedFrameGapAtMost1Percent),
    ...crops.map((stage) => stage.budgetChecks.frameRateAtLeast30),
    ...crops.map((stage) => stage.budgetChecks.presentedFrameGapAtMost1Percent),
    ...crops.map((stage) => stage.budgetChecks.sourceToPreviewP95AtMost50Ms),
    ...crops.map((stage) => stage.budgetChecks.cropSetupWithin1Second),
  ];
  const enoughData =
    record.firstUsableFrameMs !== null &&
    captures.length >= 3 &&
    passThrough.length >= 3 &&
    crops.length >= 3 &&
    latencyDataComplete &&
    checks.every((value) => value !== null && value !== undefined);
  const knownFailure = checks.some((value) => value === false);
  const heapCheck = record.retainedHeapGrowthWithinBudget;
  const heapUnavailable =
    heapCheck === null &&
    record.sessionCycles.length >= 5 &&
    record.heapBeforeSessionCyclesBytes === null &&
    record.heapAfterSessionCyclesBytes === null;
  const failedHeap = heapCheck === false;
  const state: VerdictState =
    knownFailure || failedHeap ? "ng" : enoughData && heapCheck === true ? "ok" : "pending";
  const heapText =
    heapCheck === null
      ? heapUnavailable
        ? "heap: N/A"
        : "heap: GC後の計測が必要"
      : `heap: ${heapCheck ? "OK" : "NG"}`;
  const firstFrame =
    record.firstUsableFrameMs === null
      ? "—"
      : `${record.firstUsableFrameMs.toFixed(0)}/500 ms ${record.firstUsableFrameMs <= 500 ? "OK" : "NG"}`;
  const detail = `初回 ${firstFrame} · capture-only ${averageFrameRate(captures)} · pass-through ${averageFrameRate(
    passThrough,
  )} · fixed-crop ${averageFrameRate(crops)} · ${heapText}`;
  return { label: "計測予算", detail, state };
};

const cleanupCheck = (record: BenchmarkRecord): VerdictCheck => {
  if (record.browser.toolMode === "synthetic Playwright timing") {
    return {
      label: "トラック解放",
      detail: "合成入力テストでは解放確認済みですが、実機判定には含めません。",
      state: "excluded",
    };
  }
  const cleanup = record.cleanup;
  if (cleanup === null) {
    return {
      label: "トラック解放",
      detail: "測定完了後のカメラ・エフェクト・セッショントラック解放を待っています。",
      state: "pending",
    };
  }
  const values = [
    cleanup.cameraStopped,
    cleanup.effectTracksReleased,
    cleanup.sessionTracksReleased,
  ];
  const state: VerdictState = values.every((value) => value === true)
    ? "ok"
    : values.some((value) => value === false)
      ? "ng"
      : "pending";
  return {
    label: "トラック解放",
    detail: `camera ${cleanup.cameraStopped === true ? "ended" : "未確認"} · effect ${
      cleanup.effectTracksReleased === true ? "released" : "未確認"
    } · session ${cleanup.sessionTracksReleased === true ? "released" : "未確認"}`,
    state,
  };
};

const stateForMetric = (passed: boolean | null | undefined): VerdictState =>
  passed === true ? "ok" : passed === false ? "ng" : "pending";

const formatMetric = (value: number | null, unit: string, digits = 1): string =>
  value === null ? "—" : `${value.toFixed(digits)} ${unit}`;

const renderTrialResults = (record: BenchmarkRecord): void => {
  trialResultsBody.replaceChildren();
  if (record.stages.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 12;
    cell.className = "empty-row";
    cell.textContent = "計測結果はまだありません。";
    row.append(cell);
    trialResultsBody.append(row);
    return;
  }
  for (const stage of record.stages) {
    const row = document.createElement("tr");
    const mode = document.createElement("th");
    mode.scope = "row";
    mode.textContent = stage.profile;
    row.append(mode);
    const runCell = document.createElement("td");
    runCell.textContent = String(stage.run);
    row.append(runCell);
    const fpsCell = document.createElement("td");
    fpsCell.textContent = formatMetric(stage.frameRateFps, "fps");
    fpsCell.dataset.state = stateForMetric(stage.budgetChecks.frameRateAtLeast30);
    row.append(fpsCell);
    const gapsCell = document.createElement("td");
    gapsCell.textContent = formatMetric(stage.presentedFrameGapPercent, "%", 2);
    gapsCell.dataset.state = stateForMetric(stage.budgetChecks.presentedFrameGapAtMost1Percent);
    row.append(gapsCell);
    const inputCell = document.createElement("td");
    inputCell.textContent =
      stage.processorInputVideoFrameRateFps === null
        ? "—"
        : `${formatMetric(stage.processorInputVideoFrameRateFps, "fps")} / ${stage.processorInputPresentedFrameGaps ?? "—"}`;
    row.append(inputCell);
    const drawCell = document.createElement("td");
    drawCell.textContent =
      stage.cropDrawImageRateFps === null
        ? "—"
        : `${formatMetric(stage.cropDrawImageRateFps, "fps")} / ${stage.cropDrawImageFailures ?? "—"}`;
    row.append(drawCell);
    const drawP95Cell = document.createElement("td");
    drawP95Cell.textContent = formatMetric(stage.cropDrawImageDurationP95Ms, "ms");
    row.append(drawP95Cell);
    const callbackP95Cell = document.createElement("td");
    callbackP95Cell.textContent = formatMetric(stage.cropCallbackDurationP95Ms, "ms");
    row.append(callbackP95Cell);
    const sourceVideoCell = document.createElement("td");
    sourceVideoCell.textContent =
      stage.processorInputVideoConnected === null
        ? "—"
        : stage.processorInputVideoConnected
          ? "connected"
          : "detached";
    row.append(sourceVideoCell);
    const latencyCell = document.createElement("td");
    latencyCell.textContent = formatMetric(stage.sourceToPreviewP95Ms, "ms");
    if (stage.profile === "fixed-crop") {
      latencyCell.dataset.state = stateForMetric(stage.budgetChecks.sourceToPreviewP95AtMost50Ms);
    }
    row.append(latencyCell);
    const markerCell = document.createElement("td");
    markerCell.textContent = `${stage.latencySamples} / ${stage.staleMarkerSamples}`;
    row.append(markerCell);
    const setupCell = document.createElement("td");
    setupCell.textContent = formatMetric(stage.cropSetupMs, "ms");
    if (stage.profile === "fixed-crop") {
      setupCell.dataset.state = stateForMetric(stage.budgetChecks.cropSetupWithin1Second);
    }
    row.append(setupCell);
    trialResultsBody.append(row);
  }
};

const renderVerdict = (record: BenchmarkRecord): void => {
  const checks = [
    cameraSourceCheck(record),
    runCoverageCheck(record),
    performanceCheck(record),
    cleanupCheck(record),
  ];
  const isSynthetic = record.browser.toolMode === "synthetic Playwright timing";
  const hasFailure = checks.some((check) => check.state === "ng") || record.status === "failed";
  const isReady = checks.every((check) => check.state === "ok" || check.state === "excluded");
  const overallState: VerdictState = isSynthetic
    ? "excluded"
    : hasFailure
      ? "ng"
      : isReady && record.status === "completed" && record.issues.length === 0
        ? "ok"
        : "pending";

  verdictBanner.dataset.state = overallState;
  verdictOverall.textContent = verdictLabel(overallState);
  verdictMessage.textContent =
    overallState === "ok"
      ? "必須の実機計測とリソース解放を確認し、すべての判定可能な予算を満たしました。"
      : overallState === "ng"
        ? "予算未達または計測エラーがあります。赤い項目とJSONのissuesを確認してください。"
        : overallState === "excluded"
          ? "これは疑似入力の結果です。実機のOK/NG判定には使えません。"
          : "計測または必須情報が不足しています。未完了の項目を確認してください。";

  verdictChecks.replaceChildren();
  for (const check of checks) {
    const item = document.createElement("li");
    item.dataset.state = check.state;
    const label = document.createElement("span");
    label.textContent = `${check.label} — ${check.detail}`;
    const status = document.createElement("strong");
    status.textContent = verdictLabel(check.state);
    item.append(label, status);
    verdictChecks.append(item);
  }
  renderTrialResults(record);
};

const showRecord = (record: BenchmarkRecord): void => {
  window.videoCropBenchmarkRecord = record;
  resultsElement.textContent = JSON.stringify(record, null, 2);
  renderVerdict(record);
  downloadButton.disabled = false;
};

const abortError = (): Error => {
  const error = new Error("The benchmark run was stopped.");
  error.name = "AbortError";
  return error;
};

class PreviewFrameTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PreviewFrameTimeoutError";
  }
}

const assertNotAborted = (signal: AbortSignal): void => {
  if (signal.aborted) throw abortError();
};

const wait = (durationMs: number, signal: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(abortError());
      return;
    }
    const timeout = window.setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, durationMs);
    const onAbort = (): void => {
      window.clearTimeout(timeout);
      signal.removeEventListener("abort", onAbort);
      reject(abortError());
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });

const waitForNextFrame = (video: VideoWithFrameCallbacks, signal: AbortSignal): Promise<number> =>
  new Promise((resolve, reject) => {
    if (video.requestVideoFrameCallback === undefined) {
      reject(new Error("This browser does not provide requestVideoFrameCallback()."));
      return;
    }
    let handle: number | null = null;
    let timeout = 0;
    const finish = (error?: Error, now?: number): void => {
      window.clearTimeout(timeout);
      signal.removeEventListener("abort", onAbort);
      if (handle !== null) video.cancelVideoFrameCallback?.(handle);
      if (error !== undefined) reject(error);
      else resolve(now ?? performance.now());
    };
    const onAbort = (): void => finish(abortError());
    timeout = window.setTimeout(
      () => finish(new Error("No video frame arrived within 10 seconds.")),
      10_000,
    );
    signal.addEventListener("abort", onAbort, { once: true });
    handle = video.requestVideoFrameCallback((now) => finish(undefined, now));
  });

const quantile = (values: readonly number[], percentile: number): number | null => {
  if (values.length === 0) return null;
  const rank = Math.max(1, Math.ceil(values.length * percentile));
  return values.reduce<number | null>((selected, value) => {
    const atOrBelowRank = values.reduce(
      (count, candidate) => count + Number(candidate <= value),
      0,
    );
    return atOrBelowRank >= rank && (selected === null || value < selected) ? value : selected;
  }, null);
};

const decodeTimingToken = (video: VideoWithFrameCallbacks): number | null => {
  if (video.videoWidth < 24 || video.videoHeight < 16) return null;
  sampleContext.drawImage(video, 0, 0, 24, 16, 0, 0, 6, 4);
  const pixels = sampleContext.getImageData(0, 0, 6, 4).data;
  let token = 0;
  for (let bit = 0; bit < 24; bit += 1) {
    const pixelOffset = bit * 4;
    const red = pixels[pixelOffset] ?? 0;
    const green = pixels[pixelOffset + 1] ?? 0;
    const blue = pixels[pixelOffset + 2] ?? 0;
    if (red * 0.2126 + green * 0.7152 + blue * 0.0722 >= 128) {
      token |= 1 << bit;
    }
  }
  const sequence = token & 0xffff;
  return sequence > 0 && token >> 16 === checksum(sequence) ? sequence : null;
};

const safeTrackSettings = (
  track: MediaStreamTrack | null,
): Record<string, number | string | boolean> => {
  if (track === null) return {};
  const settings = track.getSettings();
  const allowedKeys = ["width", "height", "frameRate", "aspectRatio", "facingMode"] as const;
  return Object.fromEntries(
    allowedKeys.flatMap((key) => {
      const value = settings[key];
      return typeof value === "number" || typeof value === "string" || typeof value === "boolean"
        ? [[key, value]]
        : [];
    }),
  );
};

const heapUsedBytes = (): number | null =>
  (performance as ExtendedPerformance).memory?.usedJSHeapSize ?? null;

const getBrowserMetadata = async (): Promise<Record<string, unknown>> => {
  const extendedNavigator = navigator as NavigatorWithUserAgentData;
  const data = extendedNavigator.userAgentData;
  let highEntropy: Record<string, unknown> | null = null;
  if (data?.getHighEntropyValues !== undefined) {
    try {
      highEntropy = await data.getHighEntropyValues([
        "fullVersionList",
        "platformVersion",
        "model",
      ]);
    } catch {
      highEntropy = null;
    }
  }
  let packageVersion = "unknown";
  try {
    const packageResponse = await fetch("/package.json");
    if (packageResponse.ok) {
      const packageInfo: unknown = await packageResponse.json();
      if (
        typeof packageInfo === "object" &&
        packageInfo !== null &&
        "version" in packageInfo &&
        typeof packageInfo.version === "string"
      ) {
        packageVersion = packageInfo.version;
      }
    }
  } catch {
    packageVersion = "unknown";
  }
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    userAgentBrands: data?.brands ?? null,
    userAgentPlatform: data?.platform ?? null,
    userAgentMobile: data?.mobile ?? null,
    userAgentHighEntropy: highEntropy,
    libraryPackageVersion: packageVersion,
    consumerRuntime: "direct browser page; no React application is mounted",
    nodeAndPackageManager: runtimeInput.value.trim(),
    toolMode: TEST_MODE ? "synthetic Playwright timing" : "local reference-device page",
    latencyFixture: "processor-sideband-id-v1; 24x16 output patch in a separate timing window",
    latencyMeasurementDomain: "processor input callback to matching output preview callback",
    latencySamplingHz: TEST_MODE ? "every delivered frame" : 5,
    domComparisonEnabled: RUN_DOM_COMPARISON,
    hardwareConcurrency: navigator.hardwareConcurrency,
    devicePixelRatio: window.devicePixelRatio,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    screen: { width: window.screen.width, height: window.screen.height },
    secureContext: window.isSecureContext,
  };
};

const getCameraLabel = async (deviceId: string | undefined): Promise<string | null> => {
  if (deviceId === undefined || navigator.mediaDevices.enumerateDevices === undefined) return null;
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return (
      devices.find((device) => device.kind === "videoinput" && device.deviceId === deviceId)
        ?.label ?? null
    );
  } catch {
    return null;
  }
};

const makeRecord = (): BenchmarkRecord => ({
  schemaVersion: 1,
  taskId: "TASK-1.25",
  decisionId: "decision-7",
  status: "running",
  startedAt: new Date().toISOString(),
  finishedAt: null,
  commitSha: commitInput.value.trim(),
  hostDescription: hostInput.value.trim(),
  runtimeDescription: runtimeInput.value.trim(),
  cameraDescription: cameraInput.value.trim(),
  browser: {},
  camera: null,
  budgets: {
    captureFrameRateFpsMin: 30,
    capturePresentedFrameGapPercentMax: 1,
    firstUsableFrameMsMax: 500,
    cropFrameRateFpsMin: 30,
    cropSourceToPreviewP95MsMax: 50,
    warmEffectSetupMsMax: 1000,
    retainedHeapGrowthPercentMax: 10,
    retainedHeapGrowthBytesFloor: 5 * 1024 * 1024,
  },
  firstUsableFrameMs: null,
  stages: [],
  effectCycles: [],
  sessionCycles: [],
  sessionStartCalls: 0,
  profileSessionStartCalls: null,
  heapBeforeEffectCyclesBytes: null,
  heapAfterEffectCyclesBytes: null,
  heapEffectGrowthWithinBudget: null,
  heapBeforeSessionCyclesBytes: null,
  heapAfterSessionCyclesBytes: null,
  heapMeasurementMethod: "approximate-uncollected-used-js-heap",
  heapGrowthWithinBudget: null,
  retainedHeapGrowthWithinBudget: null,
  getUserMediaRequestToStreamMs: null,
  cleanup: null,
  summary: null,
  issues: [],
});

let session: MediaSession | null = null;
let record: BenchmarkRecord | null = null;
let startupController: AbortController | null = null;
let runController: AbortController | null = null;
let running = false;
let sourceVideoTrack: MediaStreamTrack | null = null;
const knownTracks = new Set<MediaStreamTrack>();

interface PipelineCounters {
  processorInputVideoFrameCallbacks: number;
  processorInputPresentedFrameGaps: number;
  previousPresentedFrames: number | null;
  processorInputVideoConnected: boolean | null;
  cropDrawImageCalls: number;
  cropDrawImageFailures: number;
  cropDrawImageDurationsMs: number[];
  cropCallbackDurationsMs: number[];
}

interface PipelineInstrumentation {
  readonly getProcessorInputVideo: () => HTMLVideoElement | null;
  readonly restore: () => void;
}

let activePipelineCounters: PipelineCounters | null = null;

const installPipelineInstrumentation = (): PipelineInstrumentation => {
  const videoPrototype = HTMLVideoElement.prototype;
  let processorInputVideo: HTMLVideoElement | null = null;
  const rememberProcessorInputVideo = (video: HTMLVideoElement): void => {
    if (video !== preview) processorInputVideo = video;
  };
  const originalRequestVideoFrameCallback = Reflect.get(
    videoPrototype,
    "requestVideoFrameCallback",
  );
  const wrappedRequestVideoFrameCallback =
    typeof originalRequestVideoFrameCallback === "function"
      ? function (this: HTMLVideoElement, callback: VideoFrameRequestCallback): number {
          rememberProcessorInputVideo(this);
          const handle: unknown = Reflect.apply(originalRequestVideoFrameCallback, this, [
            (now: number, metadata: VideoFrameCallbackMetadata) => {
              if (this === preview) {
                callback(now, metadata);
                return;
              }

              const counters = activePipelineCounters;
              if (counters === null) {
                processorCallbackStartedAt = activeLatencyProbe === null ? null : performance.now();
                try {
                  callback(now, metadata);
                } finally {
                  processorCallbackStartedAt = null;
                }
                return;
              }

              counters.processorInputVideoFrameCallbacks += 1;
              counters.processorInputVideoConnected ??= this.isConnected;
              if (
                counters.previousPresentedFrames !== null &&
                metadata.presentedFrames > counters.previousPresentedFrames + 1
              ) {
                counters.processorInputPresentedFrameGaps +=
                  metadata.presentedFrames - counters.previousPresentedFrames - 1;
              }
              counters.previousPresentedFrames = metadata.presentedFrames;

              const callbackStartedAt = performance.now();
              try {
                callback(now, metadata);
              } finally {
                counters.cropCallbackDurationsMs.push(performance.now() - callbackStartedAt);
              }
            },
          ]);
          if (typeof handle !== "number") {
            throw new Error("requestVideoFrameCallback returned a non-numeric handle.");
          }
          return handle;
        }
      : undefined;

  const contextPrototype = CanvasRenderingContext2D.prototype;
  const originalDrawImage = Reflect.get(contextPrototype, "drawImage");
  if (typeof originalDrawImage !== "function") {
    throw new Error("CanvasRenderingContext2D.drawImage is unavailable.");
  }
  const wrappedDrawImage = function (
    this: CanvasRenderingContext2D,
    source: CanvasImageSource,
    ...args: number[]
  ): void {
    const counters = activePipelineCounters;
    if (source === preview || !(source instanceof HTMLVideoElement)) {
      Reflect.apply(originalDrawImage, this, [source, ...args]);
      return;
    }

    if (counters !== null) counters.cropDrawImageCalls += 1;
    const drawStartedAt = performance.now();
    try {
      Reflect.apply(originalDrawImage, this, [source, ...args]);
      paintTimingToken(this, processorCallbackStartedAt ?? drawStartedAt);
    } catch (error) {
      if (counters !== null) counters.cropDrawImageFailures += 1;
      throw error;
    } finally {
      counters?.cropDrawImageDurationsMs.push(performance.now() - drawStartedAt);
    }
  };
  const videoWrapperInstalled =
    wrappedRequestVideoFrameCallback !== undefined &&
    Reflect.set(videoPrototype, "requestVideoFrameCallback", wrappedRequestVideoFrameCallback);
  if (wrappedRequestVideoFrameCallback !== undefined && !videoWrapperInstalled) {
    throw new Error("Could not install video-frame callback diagnostics.");
  }
  if (!Reflect.set(contextPrototype, "drawImage", wrappedDrawImage)) {
    if (videoWrapperInstalled) {
      Reflect.set(videoPrototype, "requestVideoFrameCallback", originalRequestVideoFrameCallback);
    }
    throw new Error("Could not install canvas draw diagnostics.");
  }

  const restore = (): void => {
    activePipelineCounters = null;
    if (
      videoWrapperInstalled &&
      Reflect.get(videoPrototype, "requestVideoFrameCallback") === wrappedRequestVideoFrameCallback
    ) {
      Reflect.set(videoPrototype, "requestVideoFrameCallback", originalRequestVideoFrameCallback);
    }
    if (Reflect.get(contextPrototype, "drawImage") === wrappedDrawImage) {
      Reflect.set(contextPrototype, "drawImage", originalDrawImage);
    }
  };
  return { getProcessorInputVideo: () => processorInputVideo, restore };
};

const addOutputTrack = (activeSession: MediaSession): MediaStreamTrack | null => {
  const outputTrack = activeSession.getOutput("video")?.track ?? null;
  if (outputTrack !== null) knownTracks.add(outputTrack);
  return outputTrack;
};

const attachOutput = async (activeSession: MediaSession): Promise<MediaStreamTrack> => {
  const output = activeSession.getOutput("video");
  if (output === null) throw new Error("The active capture session has no video output.");
  knownTracks.add(output.track);
  if (preview.srcObject !== output.stream) preview.srcObject = output.stream;
  await preview.play();
  return output.track;
};

const collectStage = async (
  activeSession: MediaSession,
  stage: {
    readonly run: number;
    readonly profile: Profile;
    readonly label: string;
    readonly operationStatus: OperationStatus | "not-applied";
    readonly warmupMs: number;
    readonly cropSetupMs: number | null;
  },
  signal: AbortSignal,
): Promise<StageMetric> => {
  setStatus(`${stage.label}: warming for ${stage.warmupMs} ms.`);
  await wait(stage.warmupMs, signal);
  assertNotAborted(signal);
  const activeTrack = addOutputTrack(activeSession);
  const outputSettings = safeTrackSettings(activeTrack);
  const start = performance.now();
  const endAt = start + MEASURE_MS;
  setStatus(`${stage.label}: measuring for ${MEASURE_MS} ms.`);
  let frames = 0;
  let presentedFrameGaps = 0;
  let previousPresentedFrames: number | null = null;
  const latencySamples: number[] = [];
  const staleMarkerSamples = 0;
  const pipelineCounters: PipelineCounters | null = isCropProfile(stage.profile)
    ? {
        processorInputVideoFrameCallbacks: 0,
        processorInputPresentedFrameGaps: 0,
        previousPresentedFrames: null,
        processorInputVideoConnected: null,
        cropDrawImageCalls: 0,
        cropDrawImageFailures: 0,
        cropDrawImageDurationsMs: [],
        cropCallbackDurationsMs: [],
      }
    : null;
  activePipelineCounters = pipelineCounters;

  let measuredMs: number;
  try {
    measuredMs = await new Promise<number>((resolve, reject) => {
      let handle: number | null = null;
      let timeout: number | null = null;
      let lastProgressAt = start;
      const finish = (error?: Error): void => {
        if (timeout !== null) window.clearTimeout(timeout);
        signal.removeEventListener("abort", onAbort);
        if (handle !== null) preview.cancelVideoFrameCallback?.(handle);
        if (error !== undefined) reject(error);
        else resolve(performance.now() - start);
      };
      const onAbort = (): void => finish(abortError());
      const onFrame = (now: number, metadata: FrameMetadataLike): void => {
        if (signal.aborted) {
          finish(abortError());
          return;
        }
        frames += 1;
        if (now - lastProgressAt >= 500) {
          lastProgressAt = now;
          setStatus(
            `${stage.label}: measuring (${frames} frames; ${Math.max(0, endAt - now).toFixed(0)} ms left).`,
          );
        }
        if (typeof metadata.presentedFrames === "number") {
          if (
            previousPresentedFrames !== null &&
            metadata.presentedFrames > previousPresentedFrames + 1
          ) {
            presentedFrameGaps += metadata.presentedFrames - previousPresentedFrames - 1;
          }
          previousPresentedFrames = metadata.presentedFrames;
        }
        if (now >= endAt) finish();
        else handle = preview.requestVideoFrameCallback?.(onFrame) ?? null;
      };

      if (preview.requestVideoFrameCallback === undefined) {
        reject(new Error("This browser does not provide requestVideoFrameCallback()."));
        return;
      }
      timeout = window.setTimeout(
        () =>
          finish(
            new PreviewFrameTimeoutError(
              `The preview did not deliver a frame callback within ${MEASUREMENT_FRAME_TIMEOUT_MS} ms during ${stage.label}; no complete measurement was collected.`,
            ),
          ),
        MEASUREMENT_FRAME_TIMEOUT_MS,
      );
      signal.addEventListener("abort", onAbort, { once: true });
      handle = preview.requestVideoFrameCallback(onFrame);
    });
  } finally {
    if (activePipelineCounters === pipelineCounters) activePipelineCounters = null;
  }

  const totalObserved = frames + presentedFrameGaps;
  const processorStatus = activeSession.getSnapshot().processors.video.status;
  const processorInputFrameRateFps =
    pipelineCounters === null
      ? null
      : (pipelineCounters.processorInputVideoFrameCallbacks * 1000) / measuredMs;
  const cropDrawImageRateFps =
    pipelineCounters === null ? null : (pipelineCounters.cropDrawImageCalls * 1000) / measuredMs;
  return {
    run: stage.run,
    profile: stage.profile,
    operationStatus: stage.operationStatus,
    processorStatus,
    sourceSettings: record?.camera?.settings ?? {},
    outputSettings,
    warmupMs: stage.warmupMs,
    measuredMs,
    frames,
    frameRateFps: (frames * 1000) / measuredMs,
    presentedFrameGaps,
    presentedFrameGapPercent: totalObserved === 0 ? 0 : (presentedFrameGaps / totalObserved) * 100,
    sourceToPreviewP50Ms: quantile(latencySamples, 0.5),
    sourceToPreviewP95Ms: quantile(latencySamples, 0.95),
    sourceToPreviewMaxMs: latencySamples.length === 0 ? null : Math.max(...latencySamples),
    latencySamples: latencySamples.length,
    latencyMeasuredMs: null,
    staleMarkerSamples,
    processorInputVideoFrameCallbacks: pipelineCounters?.processorInputVideoFrameCallbacks ?? null,
    processorInputVideoFrameRateFps: processorInputFrameRateFps,
    processorInputPresentedFrameGaps: pipelineCounters?.processorInputPresentedFrameGaps ?? null,
    processorInputVideoConnected: pipelineCounters?.processorInputVideoConnected ?? null,
    cropDrawImageCalls: pipelineCounters?.cropDrawImageCalls ?? null,
    cropDrawImageFailures: pipelineCounters?.cropDrawImageFailures ?? null,
    cropDrawImageRateFps,
    cropDrawImageDurationP95Ms:
      pipelineCounters === null ? null : quantile(pipelineCounters.cropDrawImageDurationsMs, 0.95),
    cropCallbackDurationP95Ms:
      pipelineCounters === null ? null : quantile(pipelineCounters.cropCallbackDurationsMs, 0.95),
    latencyMethod: "processor-sideband-id-v1",
    cropSetupMs: stage.cropSetupMs,
    budgetChecks: {
      frameRateAtLeast30: (frames * 1000) / measuredMs >= 30,
      presentedFrameGapAtMost1Percent:
        totalObserved === 0 || presentedFrameGaps / totalObserved <= 0.01,
      sourceToPreviewP95AtMost50Ms:
        stage.profile !== "fixed-crop" || quantile(latencySamples, 0.95) === null
          ? null
          : (quantile(latencySamples, 0.95) ?? Number.POSITIVE_INFINITY) <= 50,
      cropSetupWithin1Second: stage.cropSetupMs === null ? null : stage.cropSetupMs <= 1000,
    },
  };
};

const applyEffects = async (
  activeSession: MediaSession,
  effects: VideoEffectConfig,
  signal: AbortSignal,
): Promise<OperationResult> => activeSession.setVideoEffects(effects, { signal });

type CoreLibrary = typeof import("../../src/core/index.js");
type VideoEffectsModule = typeof import("../../src/effects/video/index.js");

const isCoreLibrary = (value: unknown): value is CoreLibrary =>
  typeof value === "object" &&
  value !== null &&
  "createMediaSession" in value &&
  typeof value.createMediaSession === "function";

const isVideoEffectsModule = (value: unknown): value is VideoEffectsModule =>
  typeof value === "object" &&
  value !== null &&
  "crop" in value &&
  typeof value.crop === "function";

const domComparisonValues = (stage: StageMetric | undefined) =>
  stage === undefined
    ? null
    : {
        previewFrameRateFps: stage.frameRateFps,
        inputFrameRateFps: stage.processorInputVideoFrameRateFps,
        inputPresentedFrameGaps: stage.processorInputPresentedFrameGaps,
        drawImageRateFps: stage.cropDrawImageRateFps,
        drawImageDurationP95Ms: stage.cropDrawImageDurationP95Ms,
        processorCallbackDurationP95Ms: stage.cropCallbackDurationP95Ms,
        processorInputVideoConnected: stage.processorInputVideoConnected,
      };

const updateRecord = (): void => {
  if (record === null) return;
  const rowsByProfile = (profile: Profile): StageMetric[] =>
    record?.stages.filter((stage) => stage.profile === profile) ?? [];
  const captures = rowsByProfile("capture-only");
  const passThrough = rowsByProfile("pass-through");
  const crops = rowsByProfile("fixed-crop");
  const domDetachedCrops = rowsByProfile("crop-dom-detached");
  const domConnectedCrops = rowsByProfile("crop-dom-connected");
  const captureFpsByRun = new Map(captures.map((stage) => [stage.run, stage.frameRateFps]));
  const cropFpsByRun = new Map(crops.map((stage) => [stage.run, stage.frameRateFps]));
  record.summary = {
    captureOnlyFrameRateFps: captures.map((stage) => stage.frameRateFps),
    passThroughFrameRateFps: passThrough.map((stage) => stage.frameRateFps),
    fixedCropFrameRateFps: crops.map((stage) => stage.frameRateFps),
    captureMinusCropFrameRateFpsByRun: [...captureFpsByRun].flatMap(([run, fps]) => {
      const cropFps = cropFpsByRun.get(run);
      return cropFps === undefined ? [] : [{ run, fps: fps - cropFps }];
    }),
    capturePresentedFrameGapPercent: captures.map((stage) => stage.presentedFrameGapPercent),
    fixedCropPresentedFrameGapPercent: crops.map((stage) => stage.presentedFrameGapPercent),
    cropSourceToPreviewP95MsByRun: crops.map((stage) => ({
      run: stage.run,
      value: stage.sourceToPreviewP95Ms,
    })),
    processorInputFrameRateFpsByRun: crops.map((stage) => ({
      run: stage.run,
      value: stage.processorInputVideoFrameRateFps,
    })),
    processorInputPresentedFrameGapsByRun: crops.map((stage) => ({
      run: stage.run,
      value: stage.processorInputPresentedFrameGaps,
    })),
    cropDrawImageRateFpsByRun: crops.map((stage) => ({
      run: stage.run,
      value: stage.cropDrawImageRateFps,
    })),
    cropDrawImageDurationP95MsByRun: crops.map((stage) => ({
      run: stage.run,
      value: stage.cropDrawImageDurationP95Ms,
    })),
    cropDomAttachmentComparisonByRun: [1, 2, 3].map((run) => {
      const detached = domDetachedCrops.find((stage) => stage.run === run);
      const connected = domConnectedCrops.find((stage) => stage.run === run);
      return {
        run,
        detached: domComparisonValues(detached),
        connected: domComparisonValues(connected),
        connectedMinusDetachedPreviewFps:
          detached === undefined || connected === undefined
            ? null
            : connected.frameRateFps - detached.frameRateFps,
        connectedMinusDetachedInputFps:
          detached?.processorInputVideoFrameRateFps === null ||
          detached?.processorInputVideoFrameRateFps === undefined ||
          connected?.processorInputVideoFrameRateFps === null ||
          connected?.processorInputVideoFrameRateFps === undefined
            ? null
            : connected.processorInputVideoFrameRateFps - detached.processorInputVideoFrameRateFps,
      };
    }),
    firstUsableFrameMs: record.firstUsableFrameMs,
    firstUsableFrameWithin500Ms:
      record.firstUsableFrameMs === null ? null : record.firstUsableFrameMs <= 500,
    captureFrameRateAtLeast30Fps:
      captures.length === 0
        ? null
        : captures.every((stage) => stage.budgetChecks.frameRateAtLeast30),
    capturePresentedFrameGapsAtMost1Percent:
      captures.length === 0
        ? null
        : captures.every((stage) => stage.budgetChecks.presentedFrameGapAtMost1Percent),
    cropFrameRateAtLeast30Fps:
      crops.length === 0 ? null : crops.every((stage) => stage.budgetChecks.frameRateAtLeast30),
    cropP95AtMost50Ms:
      crops.length === 0 ||
      crops.some((stage) => stage.budgetChecks.sourceToPreviewP95AtMost50Ms === null)
        ? null
        : crops.every((stage) => stage.budgetChecks.sourceToPreviewP95AtMost50Ms === true),
    retainedHeapGrowthWithinBudget: record.retainedHeapGrowthWithinBudget,
    heapMeasurementMethod: record.heapMeasurementMethod,
    heapGrowthWithinBudget: record.heapGrowthWithinBudget,
    heapEffectGrowthWithinBudget: record.heapEffectGrowthWithinBudget,
    exactUndeliveredSourceFrameCount:
      "unknown: the browser exposes presented-frame callback gaps, not camera frames never delivered",
    exactMarkerLatencyUnavailableRuns: crops
      .filter((stage) => stage.sourceToPreviewP95Ms === null)
      .map((stage) => stage.run),
  };
  showRecord(record);
};

const recordIssue = (message: string): void => {
  if (record === null) return;
  record.issues.push(message);
  updateRecord();
};

const collectProcessingLatency = async (
  label: string,
  signal: AbortSignal,
): Promise<
  Pick<
    StageMetric,
    | "sourceToPreviewP50Ms"
    | "sourceToPreviewP95Ms"
    | "sourceToPreviewMaxMs"
    | "latencySamples"
    | "latencyMeasuredMs"
    | "staleMarkerSamples"
  >
> => {
  const probe: ProcessingLatencyProbe = { sequence: 0, startedAt: new Map() };
  const samples: number[] = [];
  let measuredMs = 0;
  activeLatencyProbe = probe;
  let handle: number | null = null;
  try {
    setStatus(`${label}: processing-latency warm-up; no camera marker alignment is needed.`);
    await wait(TEST_MODE ? 50 : 1000, signal);
    setStatus(`${label}: measuring processing latency separately from FPS.`);
    const start = performance.now();
    let lastSampleAt = -Infinity;
    await new Promise<void>((resolve, reject) => {
      const finish = (error?: Error): void => {
        window.clearTimeout(timer);
        signal.removeEventListener("abort", abort);
        if (handle !== null) preview.cancelVideoFrameCallback(handle);
        if (error !== undefined) reject(error);
        else resolve();
      };
      const abort = (): void => finish(abortError());
      const timer = window.setTimeout(
        () =>
          finish(
            new PreviewFrameTimeoutError(
              "No complete processing-latency measurement was collected.",
            ),
          ),
        LATENCY_MEASURE_MS + MEASUREMENT_FRAME_TIMEOUT_MS,
      );
      const onFrame = (): void => {
        const observedAt = performance.now(); // Record receipt before pixel readback.
        if (signal.aborted) {
          abort();
          return;
        }
        if (TEST_MODE || observedAt - lastSampleAt >= 200) {
          lastSampleAt = observedAt;
          const token = decodeTimingToken(preview);
          const sourceAt = token === null ? undefined : probe.startedAt.get(token);
          if (sourceAt !== undefined && observedAt >= sourceAt) {
            samples.push(observedAt - sourceAt);
            if (token !== null) probe.startedAt.delete(token);
          }
        }
        if (observedAt - start >= LATENCY_MEASURE_MS) {
          measuredMs = observedAt - start;
          finish();
        } else handle = preview.requestVideoFrameCallback(onFrame);
      };
      signal.addEventListener("abort", abort, { once: true });
      if (signal.aborted) abort();
      else handle = preview.requestVideoFrameCallback(onFrame);
    });
  } finally {
    activeLatencyProbe = null;
    processorCallbackStartedAt = null;
    if (handle !== null) preview.cancelVideoFrameCallback(handle);
  }
  const enough = samples.length >= (TEST_MODE ? 1 : 20);
  return {
    sourceToPreviewP50Ms: enough ? quantile(samples, 0.5) : null,
    sourceToPreviewP95Ms: enough ? quantile(samples, 0.95) : null,
    sourceToPreviewMaxMs: enough ? Math.max(...samples) : null,
    latencySamples: samples.length,
    latencyMeasuredMs: measuredMs,
    staleMarkerSamples: 0,
  };
};

const runProfiles = async (
  activeSession: MediaSession,
  videoEffects: typeof import("../../src/effects/video/index.js"),
  signal: AbortSignal,
): Promise<void> => {
  if (record === null) throw new Error("The benchmark record is unavailable.");
  const firstSessionStartCount = record.sessionStartCalls;
  const cropEffect = videoEffects.crop({ region: EFFECT_REGION });
  const instrumentation = installPipelineInstrumentation();

  try {
    for (let run = 1; run <= 3; run += 1) {
      assertNotAborted(signal);
      const priorProcessor = activeSession.getSnapshot().processors.video.status;
      if (priorProcessor !== "off") {
        const removed = await applyEffects(activeSession, { effects: [] }, signal);
        if (removed.status === "cancelled" || removed.status === "superseded") throw abortError();
        await attachOutput(activeSession);
      }

      setStatus(`Trial ${run} of 3: preparing capture-only output.`);
      const captureOnlyTrack = await attachOutput(activeSession);
      const captureOnly = await collectStage(
        activeSession,
        {
          run,
          profile: "capture-only",
          label: `Trial ${run} of 3: capture-only`,
          operationStatus: "not-applied",
          warmupMs: WARMUP_MS,
          cropSetupMs: null,
        },
        signal,
      );
      record.stages.push({ ...captureOnly, outputSettings: safeTrackSettings(captureOnlyTrack) });
      updateRecord();

      setStatus(`Trial ${run} of 3: applying pass-through.`);
      const passThroughResult = await applyEffects(activeSession, { effects: [] }, signal);
      if (passThroughResult.status === "cancelled" || passThroughResult.status === "superseded") {
        throw abortError();
      }
      await attachOutput(activeSession);
      const passThrough = await collectStage(
        activeSession,
        {
          run,
          profile: "pass-through",
          label: `Trial ${run} of 3: pass-through`,
          operationStatus: passThroughResult.status,
          warmupMs: WARMUP_MS,
          cropSetupMs: null,
        },
        signal,
      );
      record.stages.push(passThrough);
      updateRecord();

      setStatus(`Trial ${run} of 3: applying the fixed crop.`);
      const cropStartedAt = performance.now();
      const cropResult = await applyEffects(activeSession, { effects: [cropEffect] }, signal);
      if (cropResult.status === "cancelled" || cropResult.status === "superseded")
        throw abortError();
      const cropSetupMs = performance.now() - cropStartedAt;
      await attachOutput(activeSession);
      const crop = await collectStage(
        activeSession,
        {
          run,
          profile: "fixed-crop",
          label: `Trial ${run} of 3: fixed-crop`,
          operationStatus: cropResult.status,
          warmupMs: WARMUP_MS,
          cropSetupMs,
        },
        signal,
      );
      const latency = await collectProcessingLatency(`Trial ${run} of 3`, signal);
      record.stages.push({
        ...crop,
        ...latency,
        budgetChecks: {
          ...crop.budgetChecks,
          sourceToPreviewP95AtMost50Ms:
            latency.sourceToPreviewP95Ms === null ? null : latency.sourceToPreviewP95Ms <= 50,
        },
      });
      updateRecord();
    }

    const processorInputVideo = instrumentation.getProcessorInputVideo();
    if (!RUN_DOM_COMPARISON) {
      // Internal video attachment experiments are not part of the consumer API acceptance flow.
    } else if (processorInputVideo === null) {
      recordIssue(
        "The processor input video could not be captured for the DOM connection comparison.",
      );
    } else {
      for (let run = 1; run <= 3; run += 1) {
        const conditions: readonly ("detached" | "connected")[] =
          run % 2 === 0 ? ["connected", "detached"] : ["detached", "connected"];
        for (const condition of conditions) {
          const connected = condition === "connected";
          if (connected) {
            processorInputVideoSlot.hidden = false;
            if (processorInputVideo.parentElement !== processorInputVideoSlot) {
              processorInputVideoSlot.append(processorInputVideo);
            }
          } else {
            processorInputVideo.remove();
            processorInputVideoSlot.hidden = true;
          }

          setStatus(`DOM comparison ${run} of 3: preparing ${condition} input output.`);
          await attachOutput(activeSession);
          const label = `DOM comparison ${run} of 3: processor input ${condition}`;
          let comparison: StageMetric;
          try {
            comparison = await collectStage(
              activeSession,
              {
                run,
                profile: connected ? "crop-dom-connected" : "crop-dom-detached",
                label,
                operationStatus: "not-applied",
                warmupMs: WARMUP_MS,
                cropSetupMs: null,
              },
              signal,
            );
          } catch (error) {
            if (signal.aborted) throw abortError();
            if (!(error instanceof PreviewFrameTimeoutError)) throw error;
            recordIssue(error.message);
            setStatus(`${label}: no measurement; continuing with the next DOM comparison.`);
            continue;
          }
          record.stages.push(comparison);
          updateRecord();
        }
      }
    }

    record.profileSessionStartCalls = record.sessionStartCalls - firstSessionStartCount;
    if (record.profileSessionStartCalls !== 0) {
      recordIssue("Capture was reacquired during profile or DOM comparison measurements.");
    }
    updateRecord();
  } finally {
    instrumentation.getProcessorInputVideo()?.remove();
    processorInputVideoSlot.hidden = true;
    instrumentation.restore();
  }
};

const runEffectCycles = async (
  activeSession: MediaSession,
  videoEffects: typeof import("../../src/effects/video/index.js"),
  signal: AbortSignal,
): Promise<void> => {
  if (record === null) throw new Error("The benchmark record is unavailable.");
  const inputTrack = sourceVideoTrack;
  if (inputTrack === null) throw new Error("The original camera track is unavailable.");
  const initialCrop = videoEffects.crop({ region: EFFECT_REGION });
  const updatedCrop = videoEffects.crop({ region: UPDATED_REGION });
  const clearedForBaseline = await applyEffects(activeSession, { effects: [] }, signal);
  if (clearedForBaseline.status !== "success") {
    throw new Error(
      `Could not restore original input before the heap baseline: ${clearedForBaseline.status}.`,
    );
  }
  await attachOutput(activeSession);
  const collectHeap = window.videoCropBenchmarkCollectGarbage;
  record.heapMeasurementMethod =
    collectHeap === undefined
      ? "approximate-uncollected-used-js-heap"
      : "controlled-post-gc-used-js-heap";
  await wait(SETTLE_MS, signal);
  record.heapBeforeEffectCyclesBytes =
    collectHeap === undefined ? heapUsedBytes() : await collectHeap();

  for (let cycle = 1; cycle <= 5; cycle += 1) {
    assertNotAborted(signal);
    setStatus(`Warm crop lifecycle cycle ${cycle} of 5.`);
    const cleared = await applyEffects(activeSession, { effects: [] }, signal);
    if (cleared.status === "cancelled" || cleared.status === "superseded") throw abortError();
    const baseTrack = addOutputTrack(activeSession);
    const added = await applyEffects(activeSession, { effects: [initialCrop] }, signal);
    if (added.status === "cancelled" || added.status === "superseded") throw abortError();
    const addedTrack = addOutputTrack(activeSession);
    const updated = await applyEffects(activeSession, { effects: [updatedCrop] }, signal);
    if (updated.status === "cancelled" || updated.status === "superseded") throw abortError();
    const updatedTrack = addOutputTrack(activeSession);
    const bypassed = await applyEffects(
      activeSession,
      { effects: [updatedCrop], bypass: true },
      signal,
    );
    if (bypassed.status === "cancelled" || bypassed.status === "superseded") throw abortError();
    const bypassTrack = addOutputTrack(activeSession);
    const removed = await applyEffects(activeSession, { effects: [] }, signal);
    if (removed.status === "cancelled" || removed.status === "superseded") throw abortError();
    const removeTrack = addOutputTrack(activeSession);
    record.effectCycles.push({
      cycle,
      addStatus: added.status,
      updateStatus: updated.status,
      bypassStatus: bypassed.status,
      removeStatus: removed.status,
      bypassRestoredInput: baseTrack !== null && bypassTrack === baseTrack,
      removeRestoredInput: removeTrack === inputTrack,
      oldTracksEnded:
        addedTrack !== null &&
        updatedTrack !== null &&
        addedTrack.readyState === "ended" &&
        updatedTrack.readyState === "ended",
    });
    updateRecord();
  }
  await wait(SETTLE_MS, signal);
  record.heapAfterEffectCyclesBytes =
    collectHeap === undefined ? heapUsedBytes() : await collectHeap();
  const before = record.heapBeforeEffectCyclesBytes;
  const after = record.heapAfterEffectCyclesBytes;
  record.heapEffectGrowthWithinBudget =
    before === null || after === null
      ? null
      : after - before <= Math.max(before * 0.1, 5 * 1024 * 1024);
};

const runSessionCycles = async (
  activeSession: MediaSession,
  signal: AbortSignal,
): Promise<void> => {
  if (record === null) throw new Error("The benchmark record is unavailable.");
  await activeSession.stop();
  preview.srcObject = null;
  await wait(SETTLE_MS, signal);
  const collectHeap = window.videoCropBenchmarkCollectGarbage;
  record.heapMeasurementMethod =
    collectHeap === undefined
      ? "approximate-uncollected-used-js-heap"
      : "controlled-post-gc-used-js-heap";
  record.heapBeforeSessionCyclesBytes =
    collectHeap === undefined ? heapUsedBytes() : await collectHeap();

  for (let cycle = 1; cycle <= 5; cycle += 1) {
    assertNotAborted(signal);
    setStatus(`Camera retention cycle ${cycle} of 5. Capture briefly stops and restarts.`);
    record.sessionStartCalls += 1;
    const started = await activeSession.start({ signal });
    const track = addOutputTrack(activeSession);
    if (started.status !== "success") {
      record.sessionCycles.push({ cycle, startStatus: started.status, trackEndedAfterStop: false });
      recordIssue(`Session retention cycle ${cycle} did not start: ${started.status}.`);
      break;
    }
    await activeSession.stop();
    record.sessionCycles.push({
      cycle,
      startStatus: started.status,
      trackEndedAfterStop: track?.readyState === "ended",
    });
    updateRecord();
    await wait(SETTLE_MS, signal);
  }

  record.heapAfterSessionCyclesBytes =
    collectHeap === undefined ? heapUsedBytes() : await collectHeap();
  const heapBefore = record.heapBeforeSessionCyclesBytes;
  const heapAfter = record.heapAfterSessionCyclesBytes;
  record.heapGrowthWithinBudget =
    heapBefore === null || heapAfter === null
      ? null
      : heapAfter - heapBefore <= Math.max(heapBefore * 0.1, 5 * 1024 * 1024);
  // Uncollected allocations and page rendering are not evidence of retained heap.
  record.retainedHeapGrowthWithinBudget =
    collectHeap === undefined
      ? null
      : record.heapGrowthWithinBudget === false || record.heapEffectGrowthWithinBudget === false
        ? false
        : record.heapGrowthWithinBudget === true && record.heapEffectGrowthWithinBudget === true
          ? true
          : null;
  await activeSession.dispose();
  const tracks = [...knownTracks];
  record.cleanup = {
    cameraStopped: tracks.every((track) => track.readyState === "ended"),
    tracksObserved: tracks.length,
    liveTracksAfterDispose: tracks.filter((track) => track.readyState !== "ended").length,
    effectCyclesCompleted: record.effectCycles.length,
    effectTracksReleased: record.effectCycles.every((cycle) => cycle.oldTracksEnded),
    sessionCyclesCompleted: record.sessionCycles.length,
    sessionTracksReleased: record.sessionCycles.every((cycle) => cycle.trackEndedAfterStop),
  };
  session = null;
  sourceVideoTrack = null;
  preview.srcObject = null;
  updateRecord();
};

const startCamera = async (): Promise<void> => {
  const setupForm = document.querySelector<HTMLFormElement>("#setup-form");
  if (setupForm === null || !setupForm.reportValidity()) return;
  if (!window.isSecureContext || navigator.mediaDevices?.getUserMedia === undefined) {
    setStatus("Camera capture requires a secure localhost or HTTPS page in a supported browser.");
    return;
  }
  if (preview.requestVideoFrameCallback === undefined) {
    setStatus(
      "This browser does not provide requestVideoFrameCallback(); no camera was requested.",
    );
    return;
  }
  if (session !== null || startupController !== null) return;

  knownTracks.clear();
  record = makeRecord();
  record.browser = await getBrowserMetadata();
  if (TEST_MODE)
    record.issues.push("Automated synthetic-input timing mode; not physical-device evidence.");
  showRecord(record);
  // Bypass both Vite's ignored-outDir transform cache and the browser's ESM cache.
  // A query on the root barrel alone would still import its cached stable core URL.
  const coreUrl = new URL("/dist/core/index.js", window.location.origin);
  coreUrl.searchParams.set("benchmark", `${record.commitSha}-${crypto.randomUUID()}`);
  try {
    const response = await fetch(coreUrl.href, { cache: "no-store" });
    if (!response.ok) throw new Error(`Built core unavailable: ${response.status}`);
    const source = await response.text();
    record.browser.coreModuleUrl = coreUrl.href;
    record.browser.processingRuntimeModule = source.match(/runtime-[\w-]+\.js/u)?.[0] ?? null;
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(source));
    record.browser.coreModuleSha256 = Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
    const importedCore: unknown = await import(/* @vite-ignore */ coreUrl.href);
    if (!isCoreLibrary(importedCore)) throw new Error("The built media-session entry is invalid.");
    const core = importedCore;
    session = core.createMediaSession({
      capture: {
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30, max: 30 },
        },
        audio: false,
      },
    });
  } catch (error) {
    record.status = "failed";
    record.issues.push(error instanceof Error ? error.message : String(error));
    record.finishedAt = new Date().toISOString();
    showRecord(record);
    setStatus("The library build is unavailable. Run pnpm build and reload this page.");
    return;
  }

  const activeSession = session;
  startupController = new AbortController();
  startButton.disabled = true;
  stopButton.disabled = false;
  physicalCameraInput.disabled = true;
  setStatus("Requesting the default camera after your explicit start.");
  record.sessionStartCalls += 1;
  sourceVideoTrack = null;
  const mediaDevices = navigator.mediaDevices;
  const originalGetUserMedia = mediaDevices.getUserMedia.bind(mediaDevices);
  const originalGetUserMediaDescriptor = Object.getOwnPropertyDescriptor(
    mediaDevices,
    "getUserMedia",
  );
  let getUserMediaRequestedAt: number | null = null;
  let mediaStreamResolvedAt: number | null = null;
  let captureTimingInstrumented = false;
  let getUserMediaRestored = false;
  const restoreGetUserMedia = (): void => {
    if (!captureTimingInstrumented || getUserMediaRestored) return;
    getUserMediaRestored = true;
    if (originalGetUserMediaDescriptor === undefined) {
      Reflect.deleteProperty(mediaDevices, "getUserMedia");
    } else {
      Object.defineProperty(mediaDevices, "getUserMedia", originalGetUserMediaDescriptor);
    }
  };
  try {
    const timedGetUserMedia: typeof mediaDevices.getUserMedia = function (
      this: MediaDevices,
      constraints: MediaStreamConstraints,
    ): Promise<MediaStream> {
      getUserMediaRequestedAt ??= performance.now();
      return originalGetUserMedia(constraints).then((stream) => {
        mediaStreamResolvedAt ??= performance.now();
        return stream;
      });
    };
    Object.defineProperty(mediaDevices, "getUserMedia", {
      configurable: true,
      writable: true,
      value: timedGetUserMedia,
    });
    captureTimingInstrumented = true;
  } catch {
    record.issues.push("getUserMedia timing is unavailable in this browser.");
  }
  try {
    const started = await activeSession.start({
      signal: startupController.signal,
    });
    restoreGetUserMedia();
    if (started.status !== "success") {
      record.status = "failed";
      record.issues.push(
        started.status === "failed" || started.status === "unsupported"
          ? started.error.message
          : `Camera start ${started.status}.`,
      );
      await activeSession.dispose();
      session = null;
      sourceVideoTrack = null;
      record.finishedAt = new Date().toISOString();
      showRecord(record);
      setStatus(`Camera start ${started.status}. Review the result and retry if appropriate.`);
      return;
    }
    const inputTrack = addOutputTrack(activeSession);
    sourceVideoTrack = inputTrack;
    if (inputTrack === null) throw new Error("The camera session has no video output track.");
    const settings = safeTrackSettings(inputTrack);
    const trackSettings = inputTrack?.getSettings();
    const label = await getCameraLabel(trackSettings?.deviceId);
    record.camera = {
      requested: { width: 1280, height: 720, frameRate: 30 },
      settings,
      cameraLabel: label,
      mediaTrackState: inputTrack?.readyState ?? "unavailable",
      physicalDeviceResult: TEST_MODE
        ? "synthetic Playwright input; physical device not confirmed"
        : physicalCameraInput.checked
          ? "user-confirmed physical reference camera"
          : "physical reference camera not confirmed",
    };
    await attachOutput(activeSession);
    const firstFrameAt = await waitForNextFrame(preview, startupController.signal);
    record.getUserMediaRequestToStreamMs =
      getUserMediaRequestedAt === null || mediaStreamResolvedAt === null
        ? null
        : mediaStreamResolvedAt - getUserMediaRequestedAt;
    record.firstUsableFrameMs =
      mediaStreamResolvedAt === null ? null : firstFrameAt - mediaStreamResolvedAt;
    if (captureTimingInstrumented && mediaStreamResolvedAt === null) {
      record.issues.push("getUserMedia completed without a measurable stream-resolution time.");
    }
    updateRecord();
    runButton.disabled = false;
    setStatus("Camera is active. Run the three measurements; no marker alignment is needed.");
  } catch (error) {
    restoreGetUserMedia();
    record.status = startupController.signal.aborted ? "stopped" : "failed";
    record.issues.push(error instanceof Error ? error.message : String(error));
    record.finishedAt = new Date().toISOString();
    try {
      await activeSession.stop();
      await activeSession.dispose();
    } catch {
      record.issues.push("Camera cleanup could not be confirmed after startup failure.");
    }
    session = null;
    sourceVideoTrack = null;
    preview.srcObject = null;
    showRecord(record);
    setStatus("Camera startup did not complete; review the report or retry.");
  } finally {
    startupController = null;
    startButton.disabled = false;
    stopButton.disabled = session === null;
    physicalCameraInput.disabled = session !== null;
  }
};

const runMeasurements = async (): Promise<void> => {
  if (session === null || record === null || running) return;
  const activeSession = session;
  const currentRecord = record;
  running = true;
  runButton.disabled = true;
  startButton.disabled = true;
  stopButton.disabled = false;
  runController = new AbortController();
  setStatus("Loading the built crop processor.");
  try {
    const effectsUrl = new URL("/dist/effects/video/index.js", window.location.origin);
    effectsUrl.searchParams.set("benchmark", `${currentRecord.commitSha}-${crypto.randomUUID()}`);
    currentRecord.browser.effectsModuleUrl = effectsUrl.href;
    const importedEffects: unknown = await import(/* @vite-ignore */ effectsUrl.href);
    if (!isVideoEffectsModule(importedEffects)) {
      throw new Error("The built video-effects entry is invalid.");
    }
    const videoEffects = importedEffects;
    await runProfiles(activeSession, videoEffects, runController.signal);
    await runEffectCycles(activeSession, videoEffects, runController.signal);
    currentRecord.profileSessionStartCalls ??= 0;
    setStatus("Running five camera stop/start retention cycles.");
    await runSessionCycles(activeSession, runController.signal);
    currentRecord.status = "completed";
    currentRecord.finishedAt = new Date().toISOString();
    updateRecord();
    setStatus(
      "Measurements complete. The camera is released; review and download the JSON report.",
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (currentRecord.status === "running") {
      currentRecord.status = runController.signal.aborted ? "stopped" : "failed";
    }
    currentRecord.finishedAt = new Date().toISOString();
    currentRecord.issues.push(errorMessage);
    if (runController.signal.aborted) {
      try {
        await activeSession.stop();
        await activeSession.dispose();
      } catch {
        currentRecord.issues.push("Camera cleanup could not be confirmed after stop.");
      }
      session = null;
      sourceVideoTrack = null;
      preview.srcObject = null;
      currentRecord.cleanup = {
        cameraStopped: [...knownTracks].every((track) => track.readyState === "ended"),
        tracksObserved: knownTracks.size,
        liveTracksAfterStop: [...knownTracks].filter((track) => track.readyState !== "ended")
          .length,
        effectCyclesCompleted: currentRecord.effectCycles.length,
        sessionCyclesCompleted: currentRecord.sessionCycles.length,
      };
    }
    updateRecord();
    setStatus(
      runController.signal.aborted
        ? "The run was stopped and the camera was released. Partial results are available."
        : `The run stopped with an error: ${errorMessage} Review the partial report; stop and release the camera before retrying.`,
    );
  } finally {
    runController = null;
    running = false;
    runButton.disabled = session === null || record?.status !== "running";
    startButton.disabled = session !== null;
    stopButton.disabled = session === null;
    physicalCameraInput.disabled = session !== null;
  }
};

const stopCamera = async (): Promise<void> => {
  runController?.abort();
  startupController?.abort();
  const activeSession = session;
  if (activeSession === null) return;
  runButton.disabled = true;
  stopButton.disabled = true;
  setStatus("Stopping and releasing camera tracks.");
  try {
    await activeSession.stop();
    await activeSession.dispose();
    session = null;
    sourceVideoTrack = null;
    preview.srcObject = null;
    if (record !== null) {
      record.status = record.status === "completed" ? "completed" : "stopped";
      record.finishedAt = new Date().toISOString();
      record.cleanup = {
        cameraStopped: [...knownTracks].every((track) => track.readyState === "ended"),
        tracksObserved: knownTracks.size,
        liveTracksAfterStop: [...knownTracks].filter((track) => track.readyState !== "ended")
          .length,
        effectCyclesCompleted: record.effectCycles.length,
        sessionCyclesCompleted: record.sessionCycles.length,
      };
      updateRecord();
    }
    setStatus("Camera stopped and session resources released.");
  } catch (error) {
    if (record !== null) {
      record.status = "failed";
      record.issues.push(error instanceof Error ? error.message : String(error));
      updateRecord();
    }
    setStatus("Camera cleanup could not be confirmed. Review the report before another run.");
  } finally {
    startButton.disabled = false;
    runButton.disabled = true;
    stopButton.disabled = true;
    physicalCameraInput.disabled = false;
  }
};

const downloadResults = (): void => {
  if (record === null) return;
  const blob = new Blob([JSON.stringify(record, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `video-crop-benchmark-${record.startedAt.replaceAll(":", "-")}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
};

startButton.addEventListener("click", () => void startCamera());
runButton.addEventListener("click", () => void runMeasurements());
stopButton.addEventListener("click", () => void stopCamera());
downloadButton.addEventListener("click", downloadResults);
