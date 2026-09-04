export type MediaKind = "video" | "audio";

export type CapturePhase = "idle" | "requesting" | "active" | "stopping" | "ended" | "disposed";

export type Availability = "unknown" | "ready" | "denied" | "unavailable" | "unsupported";

export type Activity = "live" | "muted" | "ended" | "not-requested";

export type DeviceDiscoveryStatus = "unknown" | "partial" | "ready" | "unsupported" | "failed";

export type ProcessorStatus =
  | "off"
  | "loading"
  | "active"
  | "bypassed"
  | "degraded"
  | "unsupported"
  | "failed";

export type MediaErrorCode =
  | "permission-denied"
  | "device-not-found"
  | "device-unavailable"
  | "constraint-invalid"
  | "unsupported"
  | "device-ended"
  | "asset-load-failed"
  | "processor-failed"
  | "resource-failed"
  | "aborted"
  | "superseded"
  | "disposed"
  | "unknown";

export type MediaOperation = "start" | "stop" | "switch" | "processor" | "dispose" | "discover";

export interface MediaError {
  readonly code: MediaErrorCode;
  readonly kind: MediaKind | "session";
  readonly operation: MediaOperation;
  readonly retryable: boolean;
  readonly message: string;
  readonly generation: number;
  readonly browserName?: string;
  readonly constraint?: string;
  readonly cause?: unknown;
}

export interface ProcessorSnapshot {
  readonly status: ProcessorStatus;
  readonly effects: readonly string[];
}

export interface OutputSnapshot {
  readonly id: string;
  readonly kind: MediaKind;
  readonly ownership: "session-owned" | "application-owned-clone";
}

export interface MediaDeviceSnapshot {
  readonly kind: MediaKind;
  readonly deviceId: string;
  readonly groupId: string;
  readonly label: string;
  readonly labelState: "available" | "redacted";
  readonly isDefault: boolean;
}

export interface TransitionRecord {
  readonly id: number;
  readonly operation: MediaOperation;
  readonly reason?: string;
}

export interface MediaSnapshot {
  readonly phase: CapturePhase;
  readonly availability: Availability;
  readonly deviceDiscovery: DeviceDiscoveryStatus;
  readonly activity: Readonly<Record<MediaKind, Activity>>;
  readonly devices: Readonly<Record<MediaKind, readonly MediaDeviceSnapshot[]>>;
  readonly selectedDevices: Readonly<Record<MediaKind, string | null>>;
  readonly processors: Readonly<Record<MediaKind, ProcessorSnapshot>>;
  readonly outputs: Readonly<Record<MediaKind, OutputSnapshot | null>>;
  readonly operation: OperationSnapshot | null;
  readonly error: MediaError | null;
  readonly lastTransition: TransitionRecord;
}

export interface OperationSnapshot {
  readonly id: number;
  readonly kind: MediaKind | "session";
  readonly operation: MediaOperation;
}

export interface OperationOptions {
  readonly signal?: AbortSignal;
}

export interface StartOptions extends OperationOptions {
  readonly constraints?: MediaCaptureOptions;
}

export interface StopOptions extends OperationOptions {}

export interface RetryOptions extends OperationOptions {}

export interface DeviceSelection {
  readonly deviceId?: string;
}

export interface MediaCaptureOptions {
  readonly video?: MediaTrackConstraints | boolean;
  readonly audio?: MediaTrackConstraints | boolean;
}

export interface MediaSessionOptions {
  readonly capture?: MediaCaptureOptions;
  readonly video?: VideoEffectConfig;
  readonly audio?: AudioEffectConfig;
}

export interface VideoEffectConfig {
  readonly effects?: readonly VideoEffect[];
}

export interface AudioEffectConfig {
  readonly effects?: readonly AudioEffect[];
}

export interface VideoEffect {
  readonly kind: string;
  readonly options: Readonly<Record<string, unknown>>;
}

export interface AudioEffect {
  readonly kind: string;
  readonly options: Readonly<Record<string, unknown>>;
}

export interface MediaOutput {
  readonly kind: MediaKind;
  readonly track: MediaStreamTrack;
  readonly stream: MediaStream;
  readonly id: string;
  readonly ownership: "session-owned" | "application-owned-clone";
  clone(): MediaOutput;
}

export type OperationResult =
  | { readonly status: "success"; readonly generation: number }
  | { readonly status: "cancelled" | "superseded"; readonly generation: number }
  | {
      readonly status: "failed" | "unsupported";
      readonly generation: number;
      readonly error: MediaError;
    };

export interface DeviceDiscoveryResult {
  readonly status: "success" | "failed" | "unsupported" | "superseded";
  readonly devices: Readonly<Record<MediaKind, readonly MediaDeviceSnapshot[]>>;
  readonly partial: boolean;
  readonly error?: MediaError;
}

export interface MediaSession {
  getSnapshot(): MediaSnapshot;
  getServerSnapshot(): MediaSnapshot;
  subscribe(listener: () => void): () => void;
  start(options?: StartOptions): Promise<OperationResult>;
  stop(options?: StopOptions): Promise<void>;
  retry(options?: RetryOptions): Promise<OperationResult>;
  refreshDevices(): Promise<DeviceDiscoveryResult>;
  getDevices(kind: MediaKind): readonly MediaDeviceSnapshot[];
  switchDevice(
    kind: MediaKind,
    device: DeviceSelection,
    options?: OperationOptions,
  ): Promise<OperationResult>;
  setVideoEffects(effects: VideoEffectConfig, options?: OperationOptions): Promise<OperationResult>;
  setAudioEffects(effects: AudioEffectConfig, options?: OperationOptions): Promise<OperationResult>;
  getOutput(kind: MediaKind): MediaOutput | null;
  dispose(): Promise<void>;
}

type ActiveTracks = Record<MediaKind, MediaStreamTrack | null>;
type OutputMap = Record<MediaKind, MediaOutput | null>;
type ActivityMap = Record<MediaKind, Activity>;
type DeviceMap = Record<MediaKind, readonly MediaDeviceSnapshot[]>;
type SelectedDeviceMap = Record<MediaKind, string | null>;

const idleProcessor = (): ProcessorSnapshot => ({ status: "off", effects: [] });

const emptyDevices = (): DeviceMap => ({ video: [], audio: [] });

const emptySelectedDevices = (): SelectedDeviceMap => ({ video: null, audio: null });

const freezeSnapshot = (snapshot: MediaSnapshot): MediaSnapshot => {
  const devices: DeviceMap = {
    video: Object.freeze([...snapshot.devices.video]),
    audio: Object.freeze([...snapshot.devices.audio]),
  };
  const processors = {
    video: Object.freeze({
      ...snapshot.processors.video,
      effects: Object.freeze([...snapshot.processors.video.effects]),
    }),
    audio: Object.freeze({
      ...snapshot.processors.audio,
      effects: Object.freeze([...snapshot.processors.audio.effects]),
    }),
  };
  return Object.freeze({
    ...snapshot,
    activity: Object.freeze({ ...snapshot.activity }),
    devices: Object.freeze(devices),
    selectedDevices: Object.freeze({ ...snapshot.selectedDevices }),
    processors: Object.freeze(processors),
    outputs: Object.freeze({ ...snapshot.outputs }),
    operation: snapshot.operation === null ? null : Object.freeze({ ...snapshot.operation }),
    lastTransition: Object.freeze({ ...snapshot.lastTransition }),
  });
};

const createSnapshot = (
  phase: CapturePhase = "idle",
  availability: Availability = typeof window === "undefined" || typeof document === "undefined"
    ? "unavailable"
    : "unknown",
): MediaSnapshot =>
  freezeSnapshot({
    phase,
    availability,
    deviceDiscovery: "unknown",
    activity: { video: "not-requested", audio: "not-requested" },
    devices: emptyDevices(),
    selectedDevices: emptySelectedDevices(),
    processors: { video: idleProcessor(), audio: idleProcessor() },
    outputs: { video: null, audio: null },
    operation: null,
    error: null,
    lastTransition: { id: 0, operation: "start", reason: "created" },
  });

const SERVER_SNAPSHOT = createSnapshot("idle", "unavailable");

const getBrowserMediaDevices = (): MediaDevices | null => {
  if (typeof navigator === "undefined") return null;
  return navigator.mediaDevices ?? null;
};

const hasCaptureSupport = (): boolean => {
  if (typeof window !== "undefined" && !window.isSecureContext) return false;
  const mediaDevices = getBrowserMediaDevices();
  return mediaDevices !== null && typeof mediaDevices.getUserMedia === "function";
};

const hasEnumerationSupport = (): boolean => {
  if (!hasCaptureSupport()) return false;
  const mediaDevices = getBrowserMediaDevices();
  return mediaDevices !== null && typeof mediaDevices.enumerateDevices === "function";
};

const requestedKinds = (capture: MediaCaptureOptions): MediaKind[] => {
  const kinds: MediaKind[] = [];
  if (capture.video !== undefined && capture.video !== false) kinds.push("video");
  if (capture.audio !== undefined && capture.audio !== false) kinds.push("audio");
  return kinds.length > 0 ? kinds : ["video"];
};

const toBrowserConstraints = (capture: MediaCaptureOptions): MediaStreamConstraints => {
  const constraints: MediaStreamConstraints = {};
  if (capture.video !== undefined) constraints.video = capture.video;
  if (capture.audio !== undefined) constraints.audio = capture.audio;
  if (constraints.video === undefined && constraints.audio === undefined) constraints.video = true;
  return constraints;
};

const getDeviceId = (constraints: MediaTrackConstraints | boolean | undefined): string | null => {
  if (constraints === undefined || constraints === false || constraints === true) return null;
  const { deviceId } = constraints;
  if (typeof deviceId === "string") return deviceId;
  if (typeof deviceId === "object" && deviceId !== null && "ideal" in deviceId) {
    return typeof deviceId.ideal === "string" ? deviceId.ideal : null;
  }
  return null;
};

const hasRememberedPreference = (capture: MediaCaptureOptions): boolean =>
  getDeviceId(capture.video) !== null || getDeviceId(capture.audio) !== null;

const stripDevicePreference = (
  value: MediaTrackConstraints | boolean | undefined,
): MediaTrackConstraints | boolean | undefined => {
  if (value === undefined || typeof value === "boolean") return value;
  const { deviceId: _deviceId, ...rest } = value;
  return rest;
};

const stripDevicePreferences = (capture: MediaCaptureOptions): MediaCaptureOptions => {
  const video = stripDevicePreference(capture.video);
  const audio = stripDevicePreference(capture.audio);
  return {
    ...(video === undefined ? {} : { video }),
    ...(audio === undefined ? {} : { audio }),
  };
};

const errorCodeFor = (name: string | undefined): MediaErrorCode => {
  switch (name) {
    case "NotAllowedError":
      return "permission-denied";
    case "NotFoundError":
      return "device-not-found";
    case "NotReadableError":
      return "device-unavailable";
    case "OverconstrainedError":
      return "constraint-invalid";
    case "AbortError":
      return "aborted";
    case "SecurityError":
      return "unsupported";
    case "TypeError":
      return "constraint-invalid";
    default:
      return "unknown";
  }
};

const isPreferenceFailure = (error: MediaError): boolean =>
  error.code === "device-not-found" || error.code === "constraint-invalid";

const availabilityFor = (error: MediaError): Availability => {
  switch (error.code) {
    case "permission-denied":
      return "denied";
    case "device-not-found":
    case "device-unavailable":
    case "device-ended":
      return "unavailable";
    case "unsupported":
      return "unsupported";
    default:
      return "unknown";
  }
};

const createError = (
  cause: unknown,
  kind: MediaKind | "session",
  operation: MediaOperation,
  generation: number,
): MediaError => {
  const browserName =
    typeof cause === "object" && cause !== null && "name" in cause && typeof cause.name === "string"
      ? cause.name
      : undefined;
  const message = cause instanceof Error ? cause.message : "The media operation failed.";
  const code = errorCodeFor(browserName);
  const retryable =
    code === "device-not-found" || code === "device-unavailable" || code === "aborted";
  const constraint =
    typeof cause === "object" &&
    cause !== null &&
    "constraint" in cause &&
    typeof cause.constraint === "string"
      ? cause.constraint
      : undefined;
  const error: MediaError = {
    code,
    kind,
    operation,
    retryable,
    message,
    generation,
    cause,
  };
  if (browserName !== undefined)
    return { ...error, browserName, ...(constraint ? { constraint } : {}) };
  return constraint === undefined ? error : { ...error, constraint };
};

const createUnsupportedError = (
  kind: MediaKind | "session",
  operation: MediaOperation,
  generation: number,
  message = "Media capture is not available in this execution context.",
): MediaError => ({
  code: "unsupported",
  kind,
  operation,
  retryable: false,
  message,
  generation,
});

const deviceMapFromEntries = (
  entries: MediaDeviceInfo[],
): { devices: DeviceMap; partial: boolean } => {
  const devices: DeviceMap = { video: [], audio: [] };
  const counts: Record<MediaKind, number> = { video: 0, audio: 0 };
  let partial = false;
  for (const entry of entries) {
    if (entry.kind !== "videoinput" && entry.kind !== "audioinput") continue;
    const kind: MediaKind = entry.kind === "videoinput" ? "video" : "audio";
    const index = counts[kind];
    counts[kind] += 1;
    const redacted = entry.label.length === 0 || entry.deviceId.length === 0;
    if (redacted) partial = true;
    const fallbackLabel = kind === "video" ? `Camera ${index + 1}` : `Microphone ${index + 1}`;
    const device: MediaDeviceSnapshot = {
      kind,
      deviceId: entry.deviceId,
      groupId: entry.groupId,
      label: redacted ? fallbackLabel : entry.label,
      labelState: redacted ? "redacted" : "available",
      isDefault: entry.deviceId === "" || entry.deviceId === "default",
    };
    devices[kind] = [...devices[kind], device];
  }
  return { devices, partial };
};

type AcquireResult =
  | { readonly status: "success"; readonly stream: MediaStream }
  | { readonly status: "failed"; readonly error: MediaError }
  | { readonly status: "unsupported"; readonly error: MediaError }
  | { readonly status: "cancelled" | "superseded" };

class BrowserMediaSession implements MediaSession {
  private captureConfig: MediaCaptureOptions;
  private snapshot: MediaSnapshot;
  private generation = 0;
  private operationId = 0;
  private transitionId = 0;
  private outputId = 0;
  private deviceGeneration = 0;
  private readonly listeners = new Set<() => void>();
  private readonly activeTracks: ActiveTracks = { video: null, audio: null };
  private readonly outputs: OutputMap = { video: null, audio: null };
  private readonly stoppedTracks = new Set<MediaStreamTrack>();
  private readonly trackHandlers = new Map<
    MediaKind,
    { track: MediaStreamTrack; mute: () => void; ended: () => void }
  >();
  private deviceListenerAttached = false;
  private disposed = false;
  private readonly onDeviceChange = (): void => {
    void this.refreshDevices();
  };

  constructor(options: MediaSessionOptions) {
    this.captureConfig = options.capture ?? {};
    this.snapshot = createSnapshot();
  }

  getSnapshot(): MediaSnapshot {
    return this.snapshot;
  }

  getServerSnapshot(): MediaSnapshot {
    return SERVER_SNAPSHOT;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getDevices(kind: MediaKind): readonly MediaDeviceSnapshot[] {
    return this.snapshot.devices[kind];
  }

  async refreshDevices(): Promise<DeviceDiscoveryResult> {
    const requestGeneration = ++this.deviceGeneration;
    const currentDevices = this.snapshot.devices;
    if (this.disposed) {
      const error = createUnsupportedError(
        "session",
        "discover",
        this.generation,
        "The media session is disposed.",
      );
      return { status: "failed", devices: currentDevices, partial: false, error };
    }
    if (!hasEnumerationSupport()) {
      const error = createUnsupportedError("session", "discover", this.generation);
      this.publish(
        { availability: "unsupported", deviceDiscovery: "unsupported", error },
        "discover",
        "unsupported",
      );
      return { status: "unsupported", devices: currentDevices, partial: false, error };
    }
    const mediaDevices = getBrowserMediaDevices();
    if (mediaDevices === null) {
      const error = createUnsupportedError("session", "discover", this.generation);
      return { status: "unsupported", devices: currentDevices, partial: false, error };
    }
    try {
      const entries = await mediaDevices.enumerateDevices();
      if (requestGeneration !== this.deviceGeneration || this.disposed) {
        return { status: "superseded", devices: this.snapshot.devices, partial: false };
      }
      const result = deviceMapFromEntries(entries);
      const deviceDiscovery: DeviceDiscoveryStatus = result.partial ? "partial" : "ready";
      const error = this.snapshot.error?.operation === "discover" ? null : this.snapshot.error;
      this.publish(
        { devices: result.devices, deviceDiscovery, availability: "ready", error },
        "discover",
        result.partial ? "partial" : "ready",
      );
      return { status: "success", devices: result.devices, partial: result.partial };
    } catch (cause) {
      const error = createError(cause, "session", "discover", this.generation);
      if (requestGeneration !== this.deviceGeneration || this.disposed) {
        return { status: "superseded", devices: this.snapshot.devices, partial: false };
      }
      this.publish(
        { deviceDiscovery: "failed", availability: availabilityFor(error), error },
        "discover",
        "failed",
      );
      return { status: "failed", devices: this.snapshot.devices, partial: false, error };
    }
  }

  async start(options: StartOptions = {}): Promise<OperationResult> {
    const generation = ++this.generation;
    if (this.disposed) return this.disposedResult(generation, "start");
    if (options.signal?.aborted) return { status: "cancelled", generation };
    const capture = options.constraints ?? this.captureConfig;
    const kinds = requestedKinds(capture);
    const requestKind: MediaKind | "session" = kinds.length === 1 ? kinds[0]! : "session";
    const operation = this.beginOperation(requestKind, "start", generation);
    this.attachDeviceListener();
    const abort = this.addAbortCancellation(options.signal, generation, operation);
    let result: AcquireResult;
    try {
      result = await this.acquire(
        toBrowserConstraints(capture),
        requestKind,
        generation,
        options.signal,
      );
      if (
        result.status === "failed" &&
        hasRememberedPreference(capture) &&
        isPreferenceFailure(result.error)
      ) {
        result = await this.acquire(
          toBrowserConstraints(stripDevicePreferences(capture)),
          requestKind,
          generation,
          options.signal,
        );
      }
    } finally {
      abort?.();
    }
    if (result.status !== "success") {
      if (result.status === "failed" || result.status === "unsupported") {
        if (this.isCurrent(generation)) {
          const hasActive = this.hasActiveTrack();
          this.publish(
            {
              phase: hasActive ? "active" : "idle",
              availability:
                result.status === "unsupported" ? "unsupported" : availabilityFor(result.error),
              activity: hasActive
                ? this.snapshot.activity
                : { video: "not-requested", audio: "not-requested" },
              operation: null,
              error: result.error,
            },
            "start",
            "failed",
          );
        }
        return {
          status: result.status,
          generation,
          error: result.error,
        };
      }
      return { status: result.status, generation };
    }
    if (!this.isCurrent(generation) || options.signal?.aborted) {
      this.stopStreamTracks(result.stream);
      return { status: options.signal?.aborted ? "cancelled" : "superseded", generation };
    }
    const attachResult = this.attachStream(result.stream, kinds, generation, "start");
    if (attachResult !== null) return attachResult;
    this.captureConfig = capture;
    this.publish(
      {
        phase: "active",
        availability: "ready",
        operation: null,
        error: null,
      },
      "start",
      "active",
    );
    void this.refreshDevices();
    return { status: "success", generation };
  }

  async stop(_options?: StopOptions): Promise<void> {
    if (this.disposed) return;
    this.generation += 1;
    this.publish({ phase: "stopping", operation: null }, "stop", "requested");
    this.detachDeviceListener();
    this.clearActiveTracks(true);
    this.publish(
      {
        phase: "idle",
        availability: this.snapshot.availability === "unsupported" ? "unsupported" : "unknown",
        activity: { video: "not-requested", audio: "not-requested" },
        operation: null,
        error: null,
      },
      "stop",
      "complete",
    );
  }

  async retry(options: RetryOptions = {}): Promise<OperationResult> {
    if (this.disposed) return this.disposedResult(++this.generation, "start");
    if (this.snapshot.error !== null && !this.snapshot.error.retryable) {
      return { status: "failed", generation: this.generation, error: this.snapshot.error };
    }
    return this.start(options);
  }

  async switchDevice(
    kind: MediaKind,
    device: DeviceSelection,
    options: OperationOptions = {},
  ): Promise<OperationResult> {
    const generation = ++this.generation;
    if (this.disposed) return this.disposedResult(generation, "switch");
    const deviceId = device.deviceId;
    if (deviceId === undefined || deviceId.length === 0) {
      const error: MediaError = {
        code: "constraint-invalid",
        kind,
        operation: "switch",
        retryable: false,
        message: "A deviceId is required for an explicit device switch.",
        generation,
      };
      this.publish({ operation: null, error }, "switch", "invalid-device");
      return { status: "failed", generation, error };
    }
    if (options.signal?.aborted) return { status: "cancelled", generation };
    const oldTrack = this.activeTracks[kind];
    const base = this.captureConfig[kind] ?? true;
    const selectedConstraints: MediaTrackConstraints =
      typeof base === "object" && base !== null
        ? { ...base, deviceId: { exact: deviceId } }
        : { deviceId: { exact: deviceId } };
    const capture: MediaCaptureOptions =
      kind === "video"
        ? { video: selectedConstraints, audio: false }
        : { video: false, audio: selectedConstraints };
    const operation = this.beginOperation(kind, "switch", generation);
    this.attachDeviceListener();
    const abort = this.addAbortCancellation(options.signal, generation, operation);
    let result: AcquireResult;
    try {
      result = await this.acquire(toBrowserConstraints(capture), kind, generation, options.signal);
    } finally {
      abort?.();
    }
    if (result.status !== "success") {
      if (result.status === "failed" || result.status === "unsupported") {
        if (this.isCurrent(generation)) {
          this.publish(
            {
              phase: oldTrack === null ? "idle" : "active",
              availability:
                result.status === "unsupported" ? "unsupported" : availabilityFor(result.error),
              operation: null,
              error: result.error,
            },
            "switch",
            "failed",
          );
        }
        return { status: result.status, generation, error: result.error };
      }
      return { status: result.status, generation };
    }
    if (!this.isCurrent(generation) || options.signal?.aborted) {
      this.stopStreamTracks(result.stream);
      return { status: options.signal?.aborted ? "cancelled" : "superseded", generation };
    }
    const attachResult = this.attachStream(result.stream, [kind], generation, "switch");
    if (attachResult !== null) return attachResult;
    this.publish(
      { phase: "active", availability: "ready", operation: null, error: null },
      "switch",
      "active-device-changed",
    );
    void this.refreshDevices();
    return { status: "success", generation };
  }

  async setVideoEffects(
    _effects: VideoEffectConfig,
    options?: OperationOptions,
  ): Promise<OperationResult> {
    return this.unsupported("processor", options?.signal);
  }

  async setAudioEffects(
    _effects: AudioEffectConfig,
    options?: OperationOptions,
  ): Promise<OperationResult> {
    return this.unsupported("processor", options?.signal);
  }

  getOutput(kind: MediaKind): MediaOutput | null {
    return this.outputs[kind];
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    this.generation += 1;
    this.deviceGeneration += 1;
    this.detachDeviceListener();
    this.clearActiveTracks(true);
    this.publish(
      {
        phase: "disposed",
        availability: "unsupported",
        operation: null,
        error: null,
        activity: { video: "ended", audio: "ended" },
      },
      "dispose",
      "complete",
    );
    this.listeners.clear();
  }

  private beginOperation(
    kind: MediaKind | "session",
    operation: MediaOperation,
    _generation: number,
  ): OperationSnapshot {
    const current: OperationSnapshot = { id: ++this.operationId, kind, operation };
    this.publish(
      {
        phase: operation === "switch" && this.hasActiveTrack() ? "active" : "requesting",
        operation: current,
        error: null,
      },
      operation,
      "requested",
    );
    return current;
  }

  private addAbortCancellation(
    signal: AbortSignal | undefined,
    generation: number,
    _operation: OperationSnapshot,
  ): (() => void) | null {
    if (signal === undefined) return null;
    const onAbort = (): void => {
      if (this.generation !== generation || this.disposed) return;
      this.generation += 1;
      this.publish(
        { phase: this.hasActiveTrack() ? "active" : "idle", operation: null },
        "stop",
        "cancelled",
      );
    };
    signal.addEventListener("abort", onAbort, { once: true });
    return () => signal.removeEventListener("abort", onAbort);
  }

  private async acquire(
    constraints: MediaStreamConstraints,
    kind: MediaKind | "session",
    generation: number,
    signal: AbortSignal | undefined,
  ): Promise<AcquireResult> {
    if (signal?.aborted) return { status: "cancelled" };
    if (!hasCaptureSupport()) {
      return { status: "unsupported", error: createUnsupportedError(kind, "start", generation) };
    }
    const mediaDevices = getBrowserMediaDevices();
    if (mediaDevices === null) {
      return { status: "unsupported", error: createUnsupportedError(kind, "start", generation) };
    }
    try {
      const stream = await mediaDevices.getUserMedia(constraints);
      if (!this.isCurrent(generation) || signal?.aborted) {
        this.stopStreamTracks(stream);
        return { status: signal?.aborted ? "cancelled" : "superseded" };
      }
      return { status: "success", stream };
    } catch (cause) {
      if (!this.isCurrent(generation)) return { status: "superseded" };
      if (signal?.aborted) return { status: "cancelled" };
      return { status: "failed", error: createError(cause, kind, "start", generation) };
    }
  }

  private attachStream(
    stream: MediaStream,
    kinds: readonly MediaKind[],
    generation: number,
    operation: "start" | "switch",
  ): OperationResult | null {
    const tracks = new Map<MediaKind, MediaStreamTrack>();
    for (const kind of kinds) {
      const track = stream.getTracks().find((candidate) => candidate.kind === kind);
      if (track === undefined) {
        this.stopStreamTracks(stream);
        const error: MediaError = {
          code: "resource-failed",
          kind,
          operation,
          retryable: true,
          message: `The capture stream did not contain a ${kind} track.`,
          generation,
        };
        if (this.isCurrent(generation)) {
          this.publish(
            { phase: this.hasActiveTrack() ? "active" : "idle", operation: null, error },
            operation,
            "missing-track",
          );
        }
        return { status: "failed", generation, error };
      }
      tracks.set(kind, track);
    }
    for (const track of stream.getTracks()) {
      if (![...tracks.values()].includes(track)) this.stopOwnedTrack(track);
    }
    const oldTracks: MediaStreamTrack[] = [];
    if (operation === "start") {
      for (const kind of ["video", "audio"] as const) {
        const oldTrack = this.activeTracks[kind];
        if (oldTrack !== null && !tracks.has(kind)) oldTracks.push(oldTrack);
      }
    }
    for (const kind of kinds) {
      const oldTrack = this.activeTracks[kind];
      if (oldTrack !== null && oldTrack !== tracks.get(kind)) oldTracks.push(oldTrack);
      this.detachTrack(kind);
      const track = tracks.get(kind);
      if (track === undefined) continue;
      this.activeTracks[kind] = track;
      this.outputs[kind] = this.createOutput(kind, track, stream);
    }
    for (const kind of ["video", "audio"] as const) {
      if (operation === "start" && !kinds.includes(kind)) {
        this.detachTrack(kind);
        this.activeTracks[kind] = null;
        this.outputs[kind] = null;
      }
    }
    const activity: ActivityMap = {
      video: this.activeTracks.video === null ? "not-requested" : "live",
      audio: this.activeTracks.audio === null ? "not-requested" : "live",
    };
    const selectedDevices: SelectedDeviceMap = { ...this.snapshot.selectedDevices };
    if (operation === "start") {
      for (const kind of ["video", "audio"] as const) {
        if (!kinds.includes(kind)) selectedDevices[kind] = null;
      }
    }
    for (const kind of kinds) selectedDevices[kind] = this.readTrackDeviceId(tracks.get(kind));
    this.publish(
      { activity, selectedDevices, outputs: { ...this.outputs } },
      operation,
      "output-replaced",
    );
    for (const track of oldTracks) this.stopOwnedTrack(track);
    for (const kind of kinds) {
      const track = this.activeTracks[kind];
      if (track !== null) this.attachTrack(kind, track);
    }
    return null;
  }

  private createOutput(
    kind: MediaKind,
    track: MediaStreamTrack,
    fallbackStream: MediaStream,
  ): MediaOutput {
    const create = (
      currentTrack: MediaStreamTrack,
      ownership: "session-owned" | "application-owned-clone",
    ): MediaOutput => ({
      kind,
      track: currentTrack,
      stream: this.createSingleTrackStream(currentTrack, fallbackStream),
      id: `${kind}-${++this.outputId}`,
      ownership,
      clone: () => create(currentTrack.clone(), "application-owned-clone"),
    });
    return create(track, "session-owned");
  }

  private createSingleTrackStream(
    track: MediaStreamTrack,
    fallbackStream: MediaStream,
  ): MediaStream {
    if (typeof MediaStream === "undefined") return fallbackStream;
    try {
      return new MediaStream([track]);
    } catch {
      return fallbackStream;
    }
  }

  private readTrackDeviceId(track: MediaStreamTrack | undefined): string | null {
    if (track === undefined || typeof track.getSettings !== "function") return null;
    try {
      const deviceId = track.getSettings().deviceId;
      return typeof deviceId === "string" && deviceId.length > 0 ? deviceId : null;
    } catch {
      return null;
    }
  }

  private attachTrack(kind: MediaKind, track: MediaStreamTrack): void {
    const mute = (): void => {
      if (this.activeTracks[kind] !== track || this.disposed) return;
      const activity: ActivityMap = { ...this.snapshot.activity, [kind]: "muted" };
      this.publish({ activity }, "start", "track-muted");
    };
    const ended = (): void => {
      if (this.activeTracks[kind] !== track || this.disposed) return;
      this.detachTrack(kind);
      this.activeTracks[kind] = null;
      this.outputs[kind] = null;
      const activity: ActivityMap = { ...this.snapshot.activity, [kind]: "ended" };
      const error: MediaError = {
        code: "device-ended",
        kind,
        operation: "start",
        retryable: true,
        message: `The ${kind} device ended unexpectedly.`,
        generation: this.generation,
      };
      this.publish(
        {
          phase: this.hasActiveTrack() ? "active" : "ended",
          availability: "unavailable",
          activity,
          outputs: { ...this.outputs },
          operation: null,
          error,
        },
        "start",
        "track-ended",
      );
    };
    this.trackHandlers.set(kind, { track, mute, ended });
    track.addEventListener("mute", mute);
    track.addEventListener("ended", ended);
  }

  private detachTrack(kind: MediaKind): void {
    const handler = this.trackHandlers.get(kind);
    if (handler === undefined) return;
    handler.track.removeEventListener("mute", handler.mute);
    handler.track.removeEventListener("ended", handler.ended);
    this.trackHandlers.delete(kind);
  }

  private clearActiveTracks(stop: boolean): void {
    for (const kind of ["video", "audio"] as const) {
      const track = this.activeTracks[kind];
      this.detachTrack(kind);
      this.activeTracks[kind] = null;
      this.outputs[kind] = null;
      if (stop && track !== null) this.stopOwnedTrack(track);
    }
    this.publish({ outputs: { ...this.outputs } }, "stop", "resources-released");
  }

  private stopStreamTracks(stream: MediaStream): void {
    for (const track of stream.getTracks()) this.stopOwnedTrack(track);
  }

  private stopOwnedTrack(track: MediaStreamTrack): void {
    if (this.stoppedTracks.has(track)) return;
    this.stoppedTracks.add(track);
    track.stop();
  }

  private hasActiveTrack(): boolean {
    return this.activeTracks.video !== null || this.activeTracks.audio !== null;
  }

  private attachDeviceListener(): void {
    if (this.deviceListenerAttached) return;
    const mediaDevices = getBrowserMediaDevices();
    if (mediaDevices === null || typeof mediaDevices.addEventListener !== "function") return;
    mediaDevices.addEventListener("devicechange", this.onDeviceChange);
    this.deviceListenerAttached = true;
  }

  private detachDeviceListener(): void {
    if (!this.deviceListenerAttached) return;
    const mediaDevices = getBrowserMediaDevices();
    mediaDevices?.removeEventListener("devicechange", this.onDeviceChange);
    this.deviceListenerAttached = false;
  }

  private isCurrent(generation: number): boolean {
    return !this.disposed && generation === this.generation;
  }

  private publish(patch: Partial<MediaSnapshot>, operation: MediaOperation, reason: string): void {
    this.snapshot = freezeSnapshot({
      ...this.snapshot,
      ...patch,
      lastTransition: { id: ++this.transitionId, operation, reason },
    });
    this.notify();
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }

  private unsupported(operation: MediaOperation, signal?: AbortSignal): OperationResult {
    const generation = ++this.generation;
    if (signal?.aborted) return { status: "cancelled", generation };
    const error = this.disposed
      ? this.disposedError(generation, operation)
      : createUnsupportedError("session", operation, generation);
    this.publish({ availability: "unsupported", error, operation: null }, operation, "unsupported");
    return { status: "unsupported", generation, error };
  }

  private disposedError(generation: number, operation: MediaOperation): MediaError {
    return {
      code: "disposed",
      kind: "session",
      operation,
      retryable: false,
      message: "The media session has been disposed.",
      generation,
    };
  }

  private disposedResult(generation: number, operation: MediaOperation): OperationResult {
    return { status: "failed", generation, error: this.disposedError(generation, operation) };
  }
}

export const createMediaSession = (options: MediaSessionOptions = {}): MediaSession =>
  new BrowserMediaSession(options);
