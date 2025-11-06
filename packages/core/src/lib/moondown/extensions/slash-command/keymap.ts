import {EditorView, keymap} from "@codemirror/view";
import {slashCommandState, toggleSlashCommand, updateSelectedIndex} from "./fields.ts";
import {slashCommandPlugin} from "./slash-command.ts";
import {slashCommands} from "./commands.ts";
import {translationsState} from "../default-extensions.ts";

export function handleKeyDown(view: EditorView, event: KeyboardEvent): boolean {
    const state = view.state.field(slashCommandState)
    const translations = view.state.field(translationsState);
    const plugin = view.plugin(slashCommandPlugin)
    if (event.key === "Escape") {
        if (state.active) {
            view.dispatch({
                effects: toggleSlashCommand.of(false)
            })
        }
        if (plugin) {
            plugin.abortAIContinuation()
        }
        return true
    }

    if (!state.active) return false

    const filteredCommands = slashCommands.filter(cmd => {
            const title = translations[cmd.titleKey] || cmd.titleKey;
            return title.toLowerCase().includes(state.filterText.toLowerCase())
        }
    );

    switch (event.key) {
        case "ArrowDown":
            // Skip divider commands and select the next available command
        { let nextIndex = (state.selectedIndex + 1) % filteredCommands.length
            while (filteredCommands[nextIndex].titleKey === "divider") {
                nextIndex = (nextIndex + 1) % filteredCommands.length
            }
            view.dispatch({
                effects: updateSelectedIndex.of(nextIndex)
            })
            return true }
        case "ArrowUp":
            // Skip divider commands and select the previous available command
        { let prevIndex = (state.selectedIndex - 1 + filteredCommands.length) % filteredCommands.length
            while (filteredCommands[prevIndex].titleKey === "divider") {
                prevIndex = (prevIndex - 1 + filteredCommands.length) % filteredCommands.length
            }
            view.dispatch({
                effects: updateSelectedIndex.of(prevIndex)
            })
            return true }
        case "Enter":
            if (filteredCommands.length > 0) {
                const selectedCommand = filteredCommands[state.selectedIndex]
                view.dispatch({
                    changes: {from: state.pos, to: view.state.selection.main.from, insert: ""},
                    effects: toggleSlashCommand.of(false)
                })
                selectedCommand.execute(view)
                view.focus()
            }
            return true
        case "Escape":
            view.dispatch({
                effects: toggleSlashCommand.of(false)
            })
            return true
    }

    return false
}
export const slashCommandKeymap = keymap.of([
    {
        key: "ArrowDown",
        run: (view) => {
            return handleKeyDown(view, {key: "ArrowDown"} as KeyboardEvent)
        },
        preventDefault: true
    },
    {
        key: "ArrowUp",
        run: (view) => {
            return handleKeyDown(view, {key: "ArrowUp"} as KeyboardEvent)
        },
        preventDefault: true
    },
    {
        key: "Enter",
        run: (view) => {
            return handleKeyDown(view, {key: "Enter"} as KeyboardEvent)
        },
        preventDefault: true
    },
    {
        key: "Escape",
        run: (view) => {
            return handleKeyDown(view, {key: "Escape"} as KeyboardEvent)
        },
        preventDefault: true
    }
])