import { EditorView, type KeyBinding } from "@codemirror/view";
import { indentLess, indentMore, deleteCharBackward, deleteCharForward } from "@codemirror/commands";
import { updateListEffect } from "./update-list-effect";
import { getListInfo, generateListItem } from "./list-functions";
import { LIST_INDENT, LIST_UPDATE_DELAY } from "./constants";

/**
 * Keymap for list editing functionality
 * Handles Tab, Shift-Tab, Enter, and Backspace/Delete keys
 */
export const listKeymap: KeyBinding[] = [
    {
        key: 'Tab',
        run: (view: EditorView) => {
            const { state } = view;
            const { selection } = state;
            const pos = selection.main.head;
            const listInfo = getListInfo(state, pos);

            if (listInfo) {
                // Indent list item
                indentMore(view);

                // Defer list number update to ensure indent operation completes
                setTimeout(() => {
                    view.dispatch({
                        effects: updateListEffect.of({ from: 0, to: state.doc.length }),
                    });
                }, LIST_UPDATE_DELAY);

                return true;
            }
            return false;
        },
    },
    {
        key: 'Shift-Tab',
        run: (view: EditorView) => {
            const { state } = view;
            const { selection } = state;
            const pos = selection.main.head;
            const listInfo = getListInfo(state, pos);

            if (listInfo && listInfo.indent > LIST_INDENT.MIN) {
                // Decrease indentation
                indentLess(view);

                // Defer list number update
                setTimeout(() => {
                    view.dispatch({
                        effects: updateListEffect.of({ from: 0, to: state.doc.length }),
                    });
                }, LIST_UPDATE_DELAY);

                return true;
            }
            return false;
        },
    },
    {
        key: 'Enter',
        run: (view: EditorView) => {
            const { state } = view;
            const { selection } = state;
            const pos = selection.main.head;
            const listInfo = getListInfo(state, pos);

            if (listInfo) {
                const line = state.doc.lineAt(pos);

                if (listInfo.content.trim() === '') {
                    // Current list item is empty
                    if (listInfo.indent === LIST_INDENT.MIN) {
                        // Already at top level, exit list
                        const transaction = state.update({
                            changes: {
                                from: line.from,
                                to: line.to,
                                insert: '',
                            },
                            selection: { anchor: line.from }
                        });
                        view.dispatch(transaction);
                    } else {
                        // Go back one indentation level
                        const newIndent = Math.max(LIST_INDENT.MIN, listInfo.indent - LIST_INDENT.SIZE);
                        const newListItem = generateListItem(listInfo.type, newIndent);

                        const transaction = state.update({
                            changes: {
                                from: line.from,
                                to: line.to,
                                insert: newListItem,
                            },
                            selection: { anchor: line.from + newListItem.length }
                        });
                        view.dispatch(transaction);

                        // Update list numbering
                        setTimeout(() => {
                            view.dispatch({
                                effects: updateListEffect.of({ from: 0, to: state.doc.length }),
                            });
                        }, LIST_UPDATE_DELAY);
                    }
                } else {
                    // Create new list item
                    const newListItem = generateListItem(listInfo.type, listInfo.indent);
                    const insertText = `\n${newListItem}`;

                    const transaction = state.update({
                        changes: {
                            from: pos,
                            to: pos,
                            insert: insertText,
                        },
                        selection: { anchor: pos + insertText.length }
                    });
                    view.dispatch(transaction);

                    // Update list numbering
                    setTimeout(() => {
                        view.dispatch({
                            effects: updateListEffect.of({ from: 0, to: state.doc.length }),
                        });
                    }, LIST_UPDATE_DELAY);
                }

                return true;
            }

            return false;
        },
    },
    {
        key: 'Backspace',
        run: (view: EditorView) => {
            const { state } = view;
            const { selection } = state;
            const pos = selection.main.head;

            // Check if current position is in a list or delete operation may affect list
            const currentLine = state.doc.lineAt(pos);
            const currentListInfo = getListInfo(state, pos);

            // Check if previous line is a list item (for handling newline deletion)
            let previousLineListInfo = null;
            if (currentLine.number > 1) {
                const previousLine = state.doc.line(currentLine.number - 1);
                previousLineListInfo = getListInfo(state, previousLine.from);
            }

            // If current or previous line is a list item, update list numbers after deletion
            if (currentListInfo || previousLineListInfo) {
                // Execute default delete operation
                const result = deleteCharBackward(view);

                // Defer list number update to ensure delete operation completes
                setTimeout(() => {
                    view.dispatch({
                        effects: updateListEffect.of({ from: 0, to: view.state.doc.length }),
                    });
                }, LIST_UPDATE_DELAY);

                return result;
            }

            return false;
        },
    },
    {
        key: 'Delete',
        run: (view: EditorView) => {
            const { state } = view;
            const { selection } = state;
            const pos = selection.main.head;

            // Check if current position is in a list or delete operation may affect list
            const currentLine = state.doc.lineAt(pos);
            const currentListInfo = getListInfo(state, pos);

            // Check if next line is a list item (for handling newline deletion)
            let nextLineListInfo = null;
            if (currentLine.number < state.doc.lines) {
                const nextLine = state.doc.line(currentLine.number + 1);
                nextLineListInfo = getListInfo(state, nextLine.from);
            }

            // If current or next line is a list item, update list numbers after deletion
            if (currentListInfo || nextLineListInfo) {
                // Execute default delete operation
                const result = deleteCharForward(view);

                // Defer list number update to ensure delete operation completes
                setTimeout(() => {
                    view.dispatch({
                        effects: updateListEffect.of({ from: 0, to: view.state.doc.length }),
                    });
                }, LIST_UPDATE_DELAY);

                return result;
            }

            return false;
        },
    },
];