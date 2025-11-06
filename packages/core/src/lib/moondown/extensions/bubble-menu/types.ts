import * as icons from "lucide";
import {EditorView} from "@codemirror/view";
import {EditorState} from "@codemirror/state";

export interface BubbleMenuItem {
    name: string;
    icon: keyof typeof icons;
    action?: (view: EditorView) => boolean;
    isActive?: (state: EditorState) => boolean;
    subItems?: BubbleMenuSubItem[];
    type?: 'dropdown' | 'button';
}

export interface BubbleMenuSubItem {
    name: string;
    icon?: keyof typeof icons;
    action: (view: EditorView) => Promise<boolean> | boolean;
    isActive?: (state: EditorState) => boolean;
}
