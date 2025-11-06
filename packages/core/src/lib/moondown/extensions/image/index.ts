import {EditorSelection, type Extension} from "@codemirror/state";
import {EditorView, ViewUpdate} from "@codemirror/view";
import {imageSizeField, placeholderField} from "./fields.ts";
import {imageWidgetPlugin} from "./image-renderer.ts";
import {imageDragAndDropPlugin} from "./image-drag-n-drop.ts";

export function imageExtension(): Extension {
    return [
        imageSizeField,
        placeholderField,
        imageWidgetPlugin,
        imageDragAndDropPlugin,
        EditorView.updateListener.of((update: ViewUpdate) => {
            if (update.selectionSet || update.viewportChanged) {
                const {from, to} = update.state.selection.main
                update.view.dom.querySelectorAll(".cm-image-widget").forEach((el: Element) => {
                    const pos = update.view.posAtDOM(el as HTMLElement)
                    if (pos !== null && pos >= from && pos < to) {
                        el.classList.add("selected")
                    } else {
                        el.classList.remove("selected")
                    }
                })
            }
        }),
        EditorView.inputHandler.of((view, from, _to, text) => {
            const doc = view.state.doc;
            const line = doc.lineAt(from);
            const lineContent = line.text;
            let isImageLine = false;

            // Check if lineContent.trim() is image markdown syntax, using complete regex matching
            const imageReg = /^!\[([^\]]*)\]\(([^)]+)\)$/;
            if (imageReg.test(lineContent.trim())) {
                isImageLine = true;
            }

            // Check if input is at the beginning of image line
            if (from === line.from && isImageLine) {
                // Insert new line before image
                view.dispatch({
                    changes: [{from: line.from, insert: '\n'}],
                    selection: EditorSelection.cursor(line.from),
                    scrollIntoView: true
                });

                // Insert text in new line
                view.dispatch({
                    changes: [{from: line.from, insert: text}],
                    selection: EditorSelection.cursor(line.from + text.length),
                    scrollIntoView: true
                });

                return true; // Indicate we have handled this input
            }

            return false; // Let CodeMirror handle other cases
        })
    ]
}
