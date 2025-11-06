import {type Extension} from "@codemirror/state";
import {EditorView, keymap} from "@codemirror/view";

export const blockquoteKeymapExtension: Extension = keymap.of([
    {
        key: 'Enter',
        run: (view: EditorView) => {
            const { state } = view;
            const line = state.doc.lineAt(state.selection.main.from);
            const lineText = line.text;

            // Match one or more blockquote markers at the start of the line
            const match = lineText.match(/^(\s*(?:>\s*)+)/);

            if (match) {
                const prefix = match[1];
                const content = lineText.slice(prefix.length);

                if (content.trim() === '') {
                    const newPrefix = prefix.replace(/(\s*>\s*)$/, '');

                    view.dispatch({
                        changes: { from: line.from, to: line.to, insert: newPrefix },
                        selection: { anchor: line.from + newPrefix.length }
                    });
                } else {
                    view.dispatch({
                        changes: { from: state.selection.main.from, to: state.selection.main.to, insert: '\n' + prefix },
                        selection: { anchor: state.selection.main.from + 1 + prefix.length }
                    });
                }
                return true;
            }
            return false;
        }
    }
]);