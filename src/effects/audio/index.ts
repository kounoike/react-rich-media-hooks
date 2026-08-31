import type { AudioEffect } from "../../core/index.js";

export interface NoiseReductionOptions {
  readonly level?: "light" | "standard" | "strong";
}

const effect = (kind: string, options: object): AudioEffect => ({
  kind,
  options: options as Readonly<Record<string, unknown>>,
});

export const noiseReduction = (options: NoiseReductionOptions = {}): AudioEffect =>
  effect("noise-reduction", options);

export type { AudioEffect };
