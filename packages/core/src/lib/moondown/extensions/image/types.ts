import {StateEffect} from "@codemirror/state";
import {ImageWidget} from "./image-widgets.ts";

// Type definitions
export interface ImageLoadedEffect {
    from: number;
    to: number;
    lines: number;
}

export interface ImagePlaceholderEffect {
    pos: number;
}

export interface ImageSizes {
    [key: number]: number;
}

// State effect definitions
export const imageLoadedEffect = StateEffect.define<ImageLoadedEffect>()
export const updateImagePlaceholder = StateEffect.define<ImagePlaceholderEffect | null>()

// Image widget cache
export const imageWidgetCache = new Map<string, ImageWidget>()
