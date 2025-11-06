import {StateEffect, StateField} from "@codemirror/state";

export const toggleSlashCommand = StateEffect.define<boolean>()

export const updateSelectedIndex = StateEffect.define<number>()

export const slashCommandState = StateField.define<{
    active: boolean,
    filterText: string,
    pos: number,
    selectedIndex: number
}>({
    create: () => ({active: false, filterText: "", pos: 0, selectedIndex: 0}),
    update(value, tr) {
        for (let e of tr.effects) {
            if (e.is(toggleSlashCommand)) {
                return {active: e.value, filterText: "", pos: tr.selection?.main.from ?? 0, selectedIndex: 0}
            }
            // Add handling for selected index updates
            if (e.is(updateSelectedIndex)) {
                return {...value, selectedIndex: e.value}
            }
        }
        if (tr.selection) {
            const line = tr.state.doc.lineAt(tr.selection.main.from)
            const lineText = line.text.slice(0, tr.selection.main.from - line.from)
            const match = /\/(\w*)$/.exec(lineText)
            const cursorPos = tr.selection.main.from - line.from

            if (match && (cursorPos === line.text.length || (cursorPos === 0 && lineText.trim() === ""))) {
                return {
                    active: true,
                    filterText: match[1],
                    pos: tr.selection.main.from - match[0].length,
                    selectedIndex: value.selectedIndex
                }
            } else {
                return {active: false, filterText: "", pos: 0, selectedIndex: 0}
            }
        }
        return value
    },
})
