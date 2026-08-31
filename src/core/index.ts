export type MediaKind = "video" | "audio";

export type CapturePhase = "idle" | "requesting" | "active" | "stopping" | "ended" | "disposed";

export type Availability = "unknown" | "ready" | "denied" | "unavailable" | "unsupported";

export type Activity = "live" | "muted" | "ended" | "not-requested";

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

export interface MediaError {
  readonly code: MediaErrorCode;
  readonly kind: MediaKind | "session";
  readonly operation: "start" | "stop" | "switch" | "processor" | "dispose";
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

export interface MediaSnapshot {
  readonly phase: CapturePhase;
  readonly availability: Availability;
  readonly activity: Readonly<Record<MediaKind, Activity>>;
  readonly processors: Readonly<Record<MediaKind, ProcessorSnapshot>>;
  readonly outputs: Readonly<Record<MediaKind, OutputSnapshot | null>>;
  readonly operation: OperationSnapshot | null;
  readonly error: MediaError | null;
}

export interface OperationSnapshot {
  readonly id: number;
  readonly kind: MediaKind | "session";
  readonly operation: "start" | "stop" | "switch" | "processor" | "dispose";
}

export interface OperationOptions {
  readonly signal?: AbortSignal;
}

export interface StartOptions extends OperationOptions {}

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

export interface MediaSession {
  getSnapshot(): MediaSnapshot;
  getServerSnapshot(): MediaSnapshot;
  subscribe(listener: () => void): () => void;
  start(options?: StartOptions): Promise<OperationResult>;
  stop(options?: StopOptions): Promise<void>;
  retry(options?: RetryOptions): Promise<OperationResult>;
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

const idleProcessor = (): ProcessorSnapshot => ({ status: "off", effects: [] });

const createSnapshot = (
  phase: CapturePhase = "idle",
  availability: Availability = typeof window === "undefined" || typeof document === "undefined"
    ? "unavailable"
    : "unknown",
): MediaSnapshot => ({
  phase,
  availability,
  activity: { video: "not-requested", audio: "not-requested" },
  processors: { video: idleProcessor(), audio: idleProcessor() },
  outputs: { video: null, audio: null },
  operation: null,
  error: null,
});

const SERVER_SNAPSHOT = createSnapshot("idle", "unavailable");

class InertMediaSession implements MediaSession {
  private snapshot: MediaSnapshot = SERVER_SNAPSHOT;
  private generation = 0;
  private readonly listeners = new Set<() => void>();

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

  async start(options?: StartOptions): Promise<OperationResult> {
    return this.unsupported("start", options?.signal);
  }

  async stop(_options?: StopOptions): Promise<void> {
    if (this.snapshot.phase === "disposed") return;
    this.generation += 1;
    this.snapshot = createSnapshot("idle");
    this.notify();
  }

  async retry(options?: RetryOptions): Promise<OperationResult> {
    return this.unsupported("start", options?.signal);
  }

  async switchDevice(
    _kind: MediaKind,
    _device: DeviceSelection,
    options?: OperationOptions,
  ): Promise<OperationResult> {
    return this.unsupported("switch", options?.signal);
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

  getOutput(_kind: MediaKind): MediaOutput | null {
    return null;
  }

  async dispose(): Promise<void> {
    if (this.snapshot.phase === "disposed") return;
    this.generation += 1;
    this.snapshot = createSnapshot("disposed");
    this.notify();
    this.listeners.clear();
  }

  private unsupported(operation: MediaError["operation"], signal?: AbortSignal): OperationResult {
    this.generation += 1;
    const generation = this.generation;
    if (signal?.aborted) return { status: "cancelled", generation };
    const error: MediaError = {
      code: "unsupported",
      kind: "session",
      operation,
      retryable: false,
      message: "Media processing is not available in this package foundation.",
      generation,
    };
    this.snapshot = { ...this.snapshot, availability: "unsupported", error };
    this.notify();
    return { status: "unsupported", generation, error };
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }
}

export const createMediaSession = (_options: MediaSessionOptions = {}): MediaSession =>
  new InertMediaSession();
