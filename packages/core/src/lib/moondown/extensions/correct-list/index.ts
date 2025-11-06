import type {Extension} from "@codemirror/state";
import { keymap } from "@codemirror/view";
import { listKeymap } from "./list-keymap.ts";
import { bulletListPlugin, updateListPlugin } from "./list-plugins";

export function correctList(): Extension {
    return [
        keymap.of(listKeymap),
        updateListPlugin,
        bulletListPlugin,
    ];
}