import { StateEffect } from "@codemirror/state";

export const updateListEffect = StateEffect.define<{ from: number; to: number }>({});