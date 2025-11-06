import {StateField} from "@codemirror/state";
import {Decoration, type DecorationSet, EditorView, WidgetType} from "@codemirror/view";
import {imageLoadedEffect, type ImageSizes, updateImagePlaceholder} from "./types.ts";

// Image size state field
export const imageSizeField = StateField.define<ImageSizes>({
    create: () => ({}),
    update(sizes, tr) {
        const newSizes = {...sizes}
        for (const e of tr.effects) {
            if (e.is(imageLoadedEffect)) {
                newSizes[e.value.from] = e.value.lines
            }
        }
        return newSizes
    }
})

// Placeholder state field
export const placeholderField = StateField.define<DecorationSet>({
    create: () => Decoration.none,
    update(decorations, tr) {
        decorations = decorations.map(tr.changes);
        for (let e of tr.effects) {
            if (e.is(updateImagePlaceholder)) {
                if (e.value === null) {
                    decorations = Decoration.none;
                } else {
                    const {pos} = e.value;
                    const line = tr.state.doc.lineAt(pos);
                    const placeholderPos = line.to;
                    decorations = Decoration.set(
                        Decoration.widget({
                            widget: new class extends WidgetType {
                                toDOM() {
                                    const el = document.createElement('div');
                                    el.className = 'cm-image-placeholder';
                                    el.style.height = `1em`;
                                    return el;
                                }
                            },
                            side: 1
                        }).range(placeholderPos)
                    );
                }
            }
        }
        return decorations;
    },
    provide: f => EditorView.decorations.from(f)
});
