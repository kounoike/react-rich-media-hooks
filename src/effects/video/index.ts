import type { VideoEffect } from "../../core/index.js";

export interface CropOptions {
  readonly aspectRatio?: number;
}

export interface BackgroundBlurOptions {
  readonly strength?: "light" | "medium" | "strong";
}

export interface BackgroundReplacementOptions {
  readonly image: string | ImageBitmap | HTMLImageElement;
}

export interface AutoFrameOptions {
  readonly margin?: number;
}

const effect = (kind: string, options: object): VideoEffect => ({
  kind,
  options: Object.fromEntries(Object.entries(options)),
});

export const crop = (options: CropOptions = {}): VideoEffect => effect("crop", options);

export const backgroundBlur = (options: BackgroundBlurOptions = {}): VideoEffect =>
  effect("background-blur", options);

export const backgroundReplacement = (options: BackgroundReplacementOptions): VideoEffect =>
  effect("background-replacement", options);

export const autoFrame = (options: AutoFrameOptions = {}): VideoEffect =>
  effect("auto-frame", options);

export type { VideoEffect };
