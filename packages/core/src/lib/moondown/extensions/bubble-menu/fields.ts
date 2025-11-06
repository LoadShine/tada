import {StateEffect, StateField} from "@codemirror/state";
import {type BubbleMenuItem} from "./types.ts";

export const showBubbleMenu = StateEffect.define<{ pos: number, items: BubbleMenuItem[] }>()

export const bubbleMenuField = StateField.define<{ pos: number, items: BubbleMenuItem[] } | null>({
    create: () => null,
    update(value, tr) {
        for (const effect of tr.effects) {
            if (effect.is(showBubbleMenu)) {
                return effect.value
            }
        }
        if (tr.selection) {
            return null
        }
        return value
    }
})
