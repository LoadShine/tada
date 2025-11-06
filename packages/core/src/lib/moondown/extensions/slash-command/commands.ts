import { EditorView } from "@codemirror/view";
import { ghostWriterExecutor } from "./ghost-writer";
import { MARKDOWN_TEMPLATES } from "../../core/constants";
import { getCurrentLine } from "../../core/utils/editor-utils";

/**
 * Slash command option interface
 */
export interface SlashCommandOption {
    titleKey: string;
    icon: string;
    execute: (view: EditorView) => void | Promise<AbortController>;
}

/**
 * Inserts text at the beginning of the current line
 */
function insertAtLineStart(view: EditorView, text: string, cursorOffset: number = 0): void {
    const line = getCurrentLine(view.state);
    view.dispatch({
        changes: { from: line.from, to: line.from, insert: text },
        selection: { anchor: line.from + text.length + cursorOffset }
    });
}

/**
 * Inserts text at cursor position with optional selection
 */
function insertAtCursor(
    view: EditorView,
    text: string,
    selectionStart?: number,
    selectionEnd?: number
): void {
    const pos = view.state.selection.main.from;
    const changes = { from: pos, insert: text };

    if (selectionStart !== undefined && selectionEnd !== undefined) {
        view.dispatch({
            changes,
            selection: { anchor: pos + selectionStart, head: pos + selectionEnd }
        });
    } else {
        view.dispatch({
            changes,
            selection: { anchor: pos + text.length }
        });
    }
}

/**
 * Available slash commands
 */
export const slashCommands: SlashCommandOption[] = [
    {
        titleKey: "moondown.slash.aiContinue",
        icon: "bot",
        execute: async (view: EditorView) => ghostWriterExecutor(view)
    },
    {
        titleKey: "moondown.slash.heading1",
        icon: "heading-1",
        execute: (view: EditorView) => insertAtLineStart(view, "# ", 0)
    },
    {
        titleKey: "moondown.slash.heading2",
        icon: "heading-2",
        execute: (view: EditorView) => insertAtLineStart(view, "## ", 0)
    },
    {
        titleKey: "moondown.slash.heading3",
        icon: "heading-3",
        execute: (view: EditorView) => insertAtLineStart(view, "### ", 0)
    },
    {
        titleKey: "moondown.slash.heading4",
        icon: "heading-4",
        execute: (view: EditorView) => insertAtLineStart(view, "#### ", 0)
    },
    {
        titleKey: "divider",
        icon: "",
        execute: () => {} // Divider placeholder
    },
    {
        titleKey: "moondown.slash.insertTable",
        icon: "table",
        execute: (view: EditorView) => insertAtCursor(view, MARKDOWN_TEMPLATES.TABLE)
    },
    {
        titleKey: "moondown.slash.insertLink",
        icon: "link",
        execute: (view: EditorView) => insertAtCursor(view, MARKDOWN_TEMPLATES.LINK, 1, 10)
    },
    {
        titleKey: "moondown.slash.quoteBlock",
        icon: "quote",
        execute: (view: EditorView) => insertAtLineStart(view, "> ", 0)
    },
    {
        titleKey: "moondown.slash.orderedList",
        icon: "list-ordered",
        execute: (view: EditorView) => insertAtLineStart(view, "1. ", 0)
    },
    {
        titleKey: "moondown.slash.unorderedList",
        icon: "list",
        execute: (view: EditorView) => insertAtLineStart(view, "- ", 0)
    },
    {
        titleKey: "moondown.slash.codeBlock",
        icon: "code",
        execute: (view: EditorView) => insertAtCursor(view, MARKDOWN_TEMPLATES.CODE_BLOCK, 4, 4)
    },
]