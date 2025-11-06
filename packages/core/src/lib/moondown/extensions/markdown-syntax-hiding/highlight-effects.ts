import { StateEffect, StateField } from '@codemirror/state';
import { Decoration, EditorView } from '@codemirror/view';

/**
 * State effect to trigger highlight
 */
export const addHighlightEffect = StateEffect.define<{from: number, to: number, timestamp: number}>();

/**
 * Highlight info interface
 */
interface HighlightInfo {
    from: number;
    to: number;
    timestamp: number;
}

/**
 * State field to manage temporary highlights from reference jumps
 */
export const referenceHighlightField = StateField.define<HighlightInfo | null>({
    create() {
        return null;
    },

    update(highlight, tr) {
        // Check for new highlight effects
        for (const effect of tr.effects) {
            if (effect.is(addHighlightEffect)) {
                return effect.value;
            }
        }

        // If we have an active highlight, check if it should expire
        if (highlight) {
            const elapsed = Date.now() - highlight.timestamp;
            if (elapsed >= 2000) {
                return null; // Clear expired highlight
            }
        }

        // Map position through changes
        if (highlight && tr.docChanged) {
            return {
                from: tr.changes.mapPos(highlight.from),
                to: tr.changes.mapPos(highlight.to),
                timestamp: highlight.timestamp
            };
        }

        return highlight;
    },

    provide: f => EditorView.decorations.from(f, highlight => {
        if (!highlight) return Decoration.none;

        // Check if highlight should still be visible
        const elapsed = Date.now() - highlight.timestamp;
        if (elapsed >= 2000) {
            return Decoration.none;
        }

        const deco = Decoration.mark({
            class: "cm-reference-highlight"
        }).range(highlight.from, highlight.to);

        return Decoration.set([deco]);
    })
});

/**
 * View plugin to periodically check and clear expired highlights
 */
export const highlightCleanupPlugin = EditorView.updateListener.of((update) => {
    const highlight = update.state.field(referenceHighlightField, false);

    if (highlight) {
        const elapsed = Date.now() - highlight.timestamp;

        // If highlight is about to expire, schedule a view update to clear it
        if (elapsed >= 2000 && elapsed < 2100) {
            setTimeout(() => {
                // Force a re-render by dispatching an empty transaction
                if (update.view.state.field(referenceHighlightField, false)) {
                    update.view.dispatch({});
                }
            }, 100);
        }
    }
});