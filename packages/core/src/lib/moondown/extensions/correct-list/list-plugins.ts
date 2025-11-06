import { Decoration, type DecorationSet, EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";
import { updateListEffect } from "./update-list-effect";
import { updateLists } from "./list-functions";
import { RangeSetBuilder } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";
import { BulletWidget } from "./bullet-widget";
import { LIST_INDENT, LIST_PATTERNS } from "./constants";

/**
 * Maximum number of bullet styles to cycle through
 */
const BULLET_STYLE_COUNT = 6;

/**
 * Plugin to handle automatic list number updates
 */
export const updateListPlugin = EditorView.updateListener.of((update) => {
    // Check if there's a manual update trigger
    let hasManualUpdate = false;
    for (const tr of update.transactions) {
        for (const e of tr.effects) {
            if (e.is(updateListEffect)) {
                hasManualUpdate = true;
                updateLists(update.view);
                return;
            }
        }
    }

    if (!hasManualUpdate && update.docChanged) {
        let needsUpdate = false;

        for (const tr of update.transactions) {
            tr.changes.iterChanges((fromA, toA, fromB, toB, inserted) => {
                const deletedText = update.startState.doc.sliceString(fromA, toA);
                const insertedText = inserted.toString();

                const hasListMarker = (text: string) => {
                    return LIST_PATTERNS.ANY.test(text) ||
                        new RegExp('\n' + LIST_PATTERNS.ANY.source.slice(1)).test(text);
                };

                if (hasListMarker(deletedText) || hasListMarker(insertedText)) {
                    needsUpdate = true;
                    return;
                }

                const doc = update.state.doc;
                try {
                    const fromLine = Math.max(1, doc.lineAt(Math.max(0, fromB - 1)).number - 1);
                    const toLine = Math.min(doc.lines, doc.lineAt(Math.min(toB + 1, doc.length)).number + 1);

                    for (let lineNum = fromLine; lineNum <= toLine; lineNum++) {
                        const line = doc.line(lineNum);
                        if (LIST_PATTERNS.ANY.test(line.text)) {
                            needsUpdate = true;
                            return;
                        }
                    }
                } catch (_ignore) {
                    needsUpdate = true;
                }
            });

            if (needsUpdate) break;
        }

        if (needsUpdate) {
            updateLists(update.view);
        }
    }
});

/**
 * Plugin to replace bullet markers with styled decorations
 */
export const bulletListPlugin = ViewPlugin.fromClass(class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
        this.decorations = this.buildDecorations(view);
    }

    update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged || update.selectionSet) {
            this.decorations = this.buildDecorations(update.view);
        }
    }

    buildDecorations(view: EditorView) {
        const builder = new RangeSetBuilder<Decoration>();

        for (const { from, to } of view.visibleRanges) {
            syntaxTree(view.state).iterate({
                from,
                to,
                enter: (node) => {
                    if (node.name === 'ListItem' || node.name.includes('ListItem')) {
                        const line = view.state.doc.lineAt(node.from);

                        const blockquoteMatch = line.text.match(/^((?:>\s*)*)/);
                        const blockquotePrefix = blockquoteMatch ? blockquoteMatch[1] : '';

                        const remainingText = line.text.slice(blockquotePrefix.length);
                        const unorderedMatch = remainingText.match(/^(\s*)([-*+])(\s+)/);

                        if (unorderedMatch) {
                            const indentation = unorderedMatch[1] || '';
                            const marker = unorderedMatch[2];
                            const spaceAfter = unorderedMatch[3];

                            const indentLevel = Math.floor(indentation.length / LIST_INDENT.SIZE);
                            const levelClass = `cm-bullet-list-l${indentLevel % BULLET_STYLE_COUNT}`;

                            const bulletStart = line.from + blockquotePrefix.length + indentation.length;
                            const bulletEnd = bulletStart + marker.length + spaceAfter.length;

                            builder.add(
                                bulletStart,
                                bulletEnd,
                                Decoration.replace({
                                    widget: new BulletWidget(levelClass, indentLevel, indentation),
                                })
                            );
                        }
                    }
                }
            });
        }
        return builder.finish();
    }
}, {
    decorations: v => v.decorations,
});