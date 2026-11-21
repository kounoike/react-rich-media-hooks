/* eslint-disable unicorn/require-post-message-target-origin -- Dedicated Worker messages have no targetOrigin. */
import { RnnoiseKernel } from "./backends/rnnoise-kernel.js";
import { pumpRawAudio, RawAudioFault } from "./raw-audio-pump.js";
import type { RawAudioData, RawAudioGlobals } from "./raw-audio-types.js";
import type { NoiseReductionLevel } from "./runtime.js";

// eslint-disable-next-line typescript/no-unsafe-type-assertion -- Optional vendor audio globals are capability checked before use.
const scope = globalThis as typeof globalThis & RawAudioGlobals;
let control: AbortController | undefined;
let kernel: RnnoiseKernel | undefined;
let level: NoiseReductionLevel = "standard";
const send = (message: Record<string, unknown>): void => globalThis.postMessage(message);
globalThis.addEventListener(
  "message",
  (
    event: MessageEvent<{
      type: string;
      level: NoiseReductionLevel;
      module: WebAssembly.Module;
      readable: ReadableStream<RawAudioData>;
      writable: WritableStream<RawAudioData>;
    }>,
  ): void => {
    const data = event.data;
    if (data.type === "stop") {
      if (control !== undefined) control.abort();
      else {
        kernel?.destroy();
        kernel = undefined;
        send({ type: "stopped" });
      }
      return;
    }
    if (data.level === "light" || data.level === "standard" || data.level === "strong")
      level = data.level;
    if (data.type === "prepare" && kernel === undefined && control === undefined) {
      try {
        if (typeof scope.AudioData !== "function")
          throw new RawAudioFault("unsupported", "Worker AudioData is unavailable.");
        kernel = new RnnoiseKernel(data.module);
        send({ type: "prepared" });
      } catch (cause) {
        send({
          type: "fault",
          faultKind: cause instanceof RawAudioFault ? cause.faultKind : "failed",
          message: cause instanceof Error ? cause.message : "Raw Worker preparation failed.",
        });
      }
      return;
    }
    if (data.type !== "start" || control !== undefined) return;
    if (kernel === undefined || scope.AudioData === undefined) {
      send({ type: "fault", faultKind: "failed", message: "Raw audio Worker was not prepared." });
      return;
    }
    control = new AbortController();
    void pumpRawAudio({
      ...data,
      kernel,
      AudioData: scope.AudioData,
      signal: control.signal,
      level: () => level,
      notify: send,
    })
      .catch((cause: unknown) => {
        if (!control?.signal.aborted)
          send({
            type: "fault",
            faultKind: cause instanceof RawAudioFault ? cause.faultKind : "failed",
            message: cause instanceof Error ? cause.message : "Raw audio Worker failed.",
          });
      })
      .finally(() => send({ type: "stopped" }));
  },
);
