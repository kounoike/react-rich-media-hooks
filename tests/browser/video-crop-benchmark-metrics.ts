export interface FrameEndpoint {
  readonly callbackAtMs: number;
  readonly presentedFrames: number | null;
}

/** Steady presentation cadence; excludes subscription wait and window-tail overhead. */
export const endpointFrameRate = (
  first: FrameEndpoint | null,
  last: FrameEndpoint | null,
): number | null => {
  if (
    first === null ||
    last === null ||
    first.presentedFrames === null ||
    last.presentedFrames === null
  )
    return null;
  const elapsed = last.callbackAtMs - first.callbackAtMs;
  const intervals = last.presentedFrames - first.presentedFrames;
  if (
    !Number.isFinite(elapsed) ||
    elapsed <= 0 ||
    !Number.isSafeInteger(intervals) ||
    intervals < 0
  )
    return null;
  return (intervals * 1000) / elapsed;
};

export const callbackEndpointRate = (
  firstAt: number | null,
  lastAt: number | null,
  calls: number,
): number | null => {
  if (firstAt === null || lastAt === null || calls < 2 || !Number.isSafeInteger(calls)) return null;
  const elapsed = lastAt - firstAt;
  return Number.isFinite(elapsed) && elapsed > 0 ? ((calls - 1) * 1000) / elapsed : null;
};
