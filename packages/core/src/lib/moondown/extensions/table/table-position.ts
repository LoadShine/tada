
/**
 * Table position tracking for CodeMirror state management
 *
 * This module manages the positions of tables within the editor document,
 * allowing for efficient tracking and updating of table locations as the
 * document content changes. It uses CodeMirror's state effects and fields
 * to maintain accurate position information.
 */

import {StateEffect, StateField} from "@codemirror/state";

/**
 * State effect for updating table position information
 *
 * This effect is dispatched when a table's position in the document changes,
 * carrying the table's unique ID and its new start/end positions.
 */
export const updateTablePosition = StateEffect.define<{id: number, from: number, to: number}>()

/**
 * State field that tracks all table positions in the document
 *
 * Maintains a map of table IDs to their corresponding position ranges.
 * Updates automatically when tables are added, removed, or moved within
 * the document.
 */
export const tablePositions = StateField.define<Map<number, {from: number, to: number}>>({
    /**
     * Initialize the table positions map
     * @returns Empty Map to store table positions
     */
    create: () => new Map(),

    /**
     * Update table positions based on state transaction effects
     * @param value - Current map of table positions
     * @param tr - CodeMirror transaction containing effects
     * @returns Updated map with new table positions
     */
    update(value, tr) {
        const newValue = new Map(value)

        for (const effect of tr.effects) {
            if (effect.is(updateTablePosition)) {
                newValue.set(effect.value.id, {from: effect.value.from, to: effect.value.to})
            }
        }

        if (tr.docChanged) {
            const updatedPositions = new Map<number, {from: number, to: number}>();
            newValue.forEach((pos, id) => {
                const newFrom = tr.changes.mapPos(pos.from);
                const newTo = tr.changes.mapPos(pos.to);
                updatedPositions.set(id, {from: newFrom, to: newTo});
            });
            return updatedPositions;
        }

        return newValue
    }
})