/** Private structural types: the deployed Chromium audio extension is not a portable DOM API. */
export interface RawAudioData {
  readonly sampleRate: number;
  readonly numberOfFrames: number;
  readonly numberOfChannels: number;
  readonly timestamp: number;
  copyTo(destination: Float32Array, options: { planeIndex: number; format: "f32-planar" }): void;
  close(): void;
}
export interface RawAudioGlobals {
  readonly MediaStreamTrackProcessor?: new (options: {
    track: MediaStreamTrack;
    maxBufferSize: number;
  }) => { readonly readable: ReadableStream<RawAudioData> };
  readonly MediaStreamTrackGenerator?: new (options: { kind: "audio" }) => MediaStreamTrack & {
    readonly writable: WritableStream<RawAudioData>;
  };
  readonly AudioData?: new (options: {
    format: "f32-planar";
    sampleRate: number;
    numberOfFrames: number;
    numberOfChannels: number;
    timestamp: number;
    data: Float32Array;
  }) => RawAudioData;
}
