import {type Extension} from "@codemirror/state";
import {EditorView} from "@codemirror/view";
import {handleKeyDown, slashCommandKeymap} from "./keymap.ts";
import {newTextState, scrollIntoView} from "./ghost-writer.ts";
import {slashCommandState, toggleSlashCommand} from "./fields.ts";
import {slashCommandPlugin} from "./slash-command.ts";

export function slashCommand(): Extension {
    return [
        slashCommandState,
        slashCommandPlugin,
        newTextState,
        slashCommandKeymap,
        EditorView.domEventHandlers({
            keydown(event, view) {
                if (event.key === "/") {
                    view.dispatch({
                        effects: toggleSlashCommand.of(true)
                    })
                }
                // Handle Escape key globally
                if (event.key === "Escape") {
                    return handleKeyDown(view, event)
                }
            }
        }),
        EditorView.updateListener.of(update => {
            if (update.transactions.length > 0) {
                for (const transaction of update.transactions) {
                    for (const effect of transaction.effects) {
                        if (effect.is(scrollIntoView)) {
                            update.view.dispatch({
                                effects: EditorView.scrollIntoView(effect.value)
                            })
                        }
                    }
                }
            }
        }),
    ]
}