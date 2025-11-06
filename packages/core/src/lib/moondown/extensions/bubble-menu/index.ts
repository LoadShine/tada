import {ViewPlugin} from "@codemirror/view";
import {bubbleMenuField} from "./fields.ts";
import {BubbleMenu} from "./bubble-menu.ts";

const bubbleMenuPlugin = ViewPlugin.fromClass(BubbleMenu);

export function bubbleMenu() {
    return [bubbleMenuField, bubbleMenuPlugin];
}