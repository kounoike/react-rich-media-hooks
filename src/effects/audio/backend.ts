/** Private graph configuration; native PCM formats and buffering belong to the backend's worklet. */
export interface AudioDenoiserBackend {
  readonly id: string;
  readonly label: string;
  readonly workletUrl: string;
  readonly processorName: string;
  readonly contextSampleRate: number;
  readonly channelCount: number;
  /** Runs outside the rendering thread; only structured-cloneable setup data crosses the port. */
  readonly prepare?: (signal?: AbortSignal) => Promise<Readonly<Record<string, unknown>>>;
}
