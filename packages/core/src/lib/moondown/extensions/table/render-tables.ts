import {WidgetType, EditorView, Decoration, type DecorationSet} from '@codemirror/view'
import { StateField, EditorState } from '@codemirror/state'
import { syntaxTree } from '@codemirror/language'
import type {SyntaxNode, SyntaxNodeRef} from "@lezer/common";
import {tablePositions, updateTablePosition} from "./table-position.ts";
import TableEditor from "./table-editor.ts";
import {parseNode} from "./table-functions.ts";
import {type TableEditorOptions} from "./types.ts";

class TableWidget extends WidgetType {
    private static nextId = 0;
    private readonly widgetId: number;
    private domElement: HTMLElement | null = null;
    private saveInProgress = false;

    constructor(
        readonly table: string,
        readonly node: SyntaxNode,
        readonly originalFrom: number,
        readonly originalTo: number
    ) {
        super();
        this.widgetId = TableWidget.nextId++;
    }

    eq(other: TableWidget): boolean {
        return this.table === other.table;
    }

    toDOM(view: EditorView): HTMLElement {
        try {
            const tableEditor = fromSyntaxNode(this.node, view.state.sliceDoc(), {
                onBlur: (instance: TableEditor) => {
                    this.saveContent(view, instance);
                },
                saveIntent: (instance: TableEditor) => {
                    this.saveContent(view, instance);
                },
                container: view.scrollDOM,
            });

            this.domElement = tableEditor.domElement;

            this.domElement.dataset.widgetId = String(this.widgetId);
            this.domElement.dataset.originalFrom = String(this.originalFrom);
            this.domElement.dataset.originalTo = String(this.originalTo);

            return this.domElement;
        } catch (err: any) {
            console.error('Error in TableWidget.toDOM:', err);
            return document.createElement('div');
        }
    }

    private saveContent(view: EditorView, instance: TableEditor) {
        if (this.saveInProgress) {
            console.log('Save already in progress for table', this.widgetId);
            return;
        }

        this.saveInProgress = true;

        try {
            const newContent = instance.getMarkdownTable();

            const positions = view.state.field(tablePositions, false);
            let actualFrom = this.originalFrom;
            let actualTo = this.originalTo;

            if (positions) {
                const storedPos = positions.get(this.widgetId);
                if (storedPos) {
                    actualFrom = storedPos.from;
                    actualTo = storedPos.to;
                }
            }

            if (!this.isPositionValid(view.state, actualFrom, actualTo)) {
                console.log('Position invalid, trying to find by DOM for table', this.widgetId);
                const foundPos = this.findTablePositionByDOM(view);
                if (foundPos) {
                    actualFrom = foundPos.from;
                    actualTo = foundPos.to;
                } else {
                    console.error('Cannot find table position, aborting save for table', this.widgetId);
                    return;
                }
            }

            if (actualFrom < 0 || actualTo > view.state.doc.length || actualFrom >= actualTo) {
                console.error('Invalid table position:', {
                    widgetId: this.widgetId,
                    actualFrom,
                    actualTo,
                    docLength: view.state.doc.length
                });
                return;
            }

            console.log('Saving table content:', {
                widgetId: this.widgetId,
                from: actualFrom,
                to: actualTo,
                contentLength: newContent.length
            });

            view.dispatch({
                changes: {
                    from: actualFrom,
                    to: actualTo,
                    insert: newContent,
                },
                effects: updateTablePosition.of({
                    id: this.widgetId,
                    from: actualFrom,
                    to: actualFrom + newContent.length,
                }),
            });

            instance.markClean();
        } catch (error) {
            console.error('Error saving table content:', error);
        } finally {
            this.saveInProgress = false;
        }
    }

    private isPositionValid(state: EditorState, from: number, to: number): boolean {
        if (from < 0 || to > state.doc.length || from >= to) {
            return false;
        }

        const tree = syntaxTree(state);
        let isValid = false;

        tree.iterate({
            from: from,
            to: to,
            enter: (node) => {
                if (node.name === 'Table' && node.from === from && node.to === to) {
                    isValid = true;
                    return false;
                }
            }
        });

        return isValid;
    }

    private findTablePositionByDOM(view: EditorView): { from: number, to: number } | null {
        if (!this.domElement) return null;

        const tree = syntaxTree(view.state);
        const tableNodes: Array<{ from: number, to: number, node: SyntaxNode }> = [];

        tree.iterate({
            enter: (nodeRef) => {
                if (nodeRef.name === 'Table') {
                    tableNodes.push({
                        from: nodeRef.from,
                        to: nodeRef.to,
                        node: nodeRef.node
                    });
                }
            }
        });

        if (tableNodes.length === 1) {
            return { from: tableNodes[0].from, to: tableNodes[0].to };
        }

        const domRect = this.domElement.getBoundingClientRect();

        for (const tableNode of tableNodes) {
            const coords = view.coordsAtPos(tableNode.from);
            if (coords) {
                const distance = Math.abs(coords.top - domRect.top);
                if (distance < 50) {
                    return { from: tableNode.from, to: tableNode.to };
                }
            }
        }

        return null;
    }

    ignoreEvent(_: Event): boolean {
        return true;
    }
}

/**
 * Instantiates a TableEditor based on a SyntaxNode
 *
 * @param   {SyntaxNode}          tableNode  The syntax node
 * @param   {string}              markdown   The Markdown source
 * @param   {TableEditorOptions}  hooks      TableEditor options
 *
 * @return  {TableEditor}                    The instance
 */
function fromSyntaxNode (tableNode: SyntaxNode, markdown: string, hooks: TableEditorOptions = {}): TableEditor {
    const parsed = parseNode(tableNode, markdown)
    if (parsed) {
        return new TableEditor(parsed.ast, parsed.colAlignments, hooks)
    } else {
        throw new Error('Could not parse table node')
    }
}

function shouldHandleNode (node: SyntaxNodeRef): boolean {
    return node.name === 'Table';
}

function createWidget (state: EditorState, node: SyntaxNodeRef): TableWidget|undefined {
    const table = state.sliceDoc(node.from, node.to)
    try {
        return new TableWidget(table, node.node, node.from, node.to)
    } catch (err: any) {
        console.error('Could not instantiate TableEditor widget: ' + err.message)
        return undefined
    }
}

function renderBlockWidgets (
    shouldHandleNode: (node: SyntaxNodeRef) => boolean,
    createWidget: (state: EditorState, node: SyntaxNodeRef) => WidgetType|undefined
): StateField<DecorationSet> {
    return StateField.define<DecorationSet>({
        create (state: EditorState) {
            return renderWidgets(state, [], shouldHandleNode, createWidget)
        },
        update (_, transaction) {
            return renderWidgets(transaction.state, [], shouldHandleNode, createWidget)
        },
        provide: f => EditorView.decorations.from(f)
    })
}

function renderWidgets (
    state: EditorState,
    visibleRanges: ReadonlyArray<{ from: number, to: number }>,
    shouldHandleNode: (node: SyntaxNodeRef) => boolean,
    createWidget: (state: EditorState, node: SyntaxNodeRef) => WidgetType|undefined
): DecorationSet {
    const widgets: any[] = []

    if (visibleRanges.length === 0) {
        visibleRanges = [{ from: 0, to: state.doc.length }]
    }

    for (const { from, to } of visibleRanges) {
        syntaxTree(state).iterate({
            from,
            to,
            enter: (node) => {
                if (!shouldHandleNode(node)) {
                    return
                }

                const renderedWidget = createWidget(state, node)
                if (renderedWidget === undefined) {
                    return
                }
                const widget = Decoration.replace({
                    widget: renderedWidget,
                    inclusive: false
                })

                widgets.push(widget.range(node.from, node.to))
            }
        })
    }

    return Decoration.set(widgets)
}

export const renderTables = renderBlockWidgets(shouldHandleNode, createWidget)