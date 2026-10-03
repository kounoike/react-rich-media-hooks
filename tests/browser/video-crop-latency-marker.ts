export const markerProtocolVersion = 1;

interface MarkerMessage {
  readonly sequence: number;
  readonly timestamp: number;
}

const canvas = document.querySelector<HTMLCanvasElement>("#latency-marker")!;
const statusElement = document.querySelector<HTMLParagraphElement>("#sync-status")!;
const context = canvas.getContext("2d", { alpha: false })!;
const channelName = "task-1-25-video-crop-latency-marker-v1";
const channel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(channelName);
let sequence = 0;

const draw = (now: number): void => {
  sequence = (sequence + 1) & 0x7fff;
  if (sequence === 0) sequence = 1;
  const encodedSequence = sequence | 0x8000;
  context.fillStyle = "#000000";
  context.fillRect(0, 0, 4, 4);
  for (let bit = 0; bit < 16; bit += 1) {
    if (((encodedSequence >> bit) & 1) === 0) continue;
    context.fillStyle = "#ffffff";
    context.fillRect(bit % 4, Math.floor(bit / 4), 1, 1);
  }
  const message: MarkerMessage = {
    sequence: encodedSequence,
    timestamp: performance.timeOrigin + now,
  };
  // oxlint-disable-next-line unicorn/require-post-message-target-origin -- BroadcastChannel is same-origin and has no targetOrigin parameter.
  channel?.postMessage(message);
  window.requestAnimationFrame(draw);
};

statusElement.textContent =
  channel === null
    ? "BroadcastChannel is unavailable; marker timing cannot sync with the benchmark window."
    : "Synchronized locally with the benchmark page in this browser.";
window.requestAnimationFrame(draw);
