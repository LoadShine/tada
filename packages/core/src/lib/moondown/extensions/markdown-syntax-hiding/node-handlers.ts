import {EditorSelection, EditorState, type SelectionRange} from '@codemirror/state';
import {Decoration, EditorView, WidgetType} from '@codemirror/view';
import { LinkWidget } from "./link-widget";
import { InlineCodeWidget, StrikethroughWidget, HighlightWidget, UnderlineWidget } from "./widgets";
import { CSS_CLASSES, escapeRegExp } from "../../core";
import { addHighlightEffect } from "./highlight-effects";

/**
 * Decoration types with explicit startSide values
 */
const hiddenMarkdown = Decoration.mark({ class: CSS_CLASSES.HIDDEN_MARKDOWN });
const visibleMarkdown = Decoration.mark({ class: CSS_CLASSES.VISIBLE_MARKDOWN });
const orderedListMarker = Decoration.mark({ class: 'cm-ordered-list-marker' });

// Line decorations with explicit startSide to avoid conflicts
const hrLine = Decoration.line({ class: 'cm-hr-line' });
const hrLineSelected = Decoration.line({ class: 'cm-hr-line-selected' });

/**
 * Decoration item interface
 */
export interface DecorationItem {
    from: number;
    to: number;
    decoration: Decoration;
}

/**
 * Node handler context
 */
export interface HandlerContext {
    state: EditorState;
    selection: SelectionRange;
    isHidingEnabled: boolean;
    isSelected: boolean;
    start: number;
    end: number;
}

/**
 * Determines decoration type based on selection and hiding state
 */
function getDecorationType(isSelected: boolean, isHidingEnabled: boolean): Decoration {
    return (isSelected || !isHidingEnabled) ? visibleMarkdown : hiddenMarkdown;
}

/**
 * Handles FencedCode nodes
 */
export function handleFencedCode(ctx: HandlerContext): DecorationItem[] {
    const { state, isSelected, isHidingEnabled, start, end } = ctx;

    if (isSelected || !isHidingEnabled) {
        return [];
    }

    const decorations: DecorationItem[] = [];
    const fencedCodeStart = state.doc.lineAt(start);
    const fencedCodeEnd = state.doc.lineAt(end);

    if (fencedCodeStart.number === fencedCodeEnd.number) {
        return [];
    }

    const openingMatch = fencedCodeStart.text.match(/^(\s*(?:>\s*)?)(```+)(\w*)/);
    if (openingMatch) {
        const prefix = openingMatch[1] || '';
        const backticks = openingMatch[2];
        const language = openingMatch[3];

        const replaceStart = fencedCodeStart.from + prefix.length;
        const replaceEnd = replaceStart + backticks.length + language.length;

        decorations.push({
            from: replaceStart,
            to: replaceEnd,
            decoration: Decoration.replace({})
        });
    }

    const closingMatch = fencedCodeEnd.text.match(/^(\s*(?:>\s*)?)(```+)/);
    if (closingMatch) {
        const prefix = closingMatch[1] || '';
        const backticks = closingMatch[2];

        const replaceStart = fencedCodeEnd.from + prefix.length;
        const replaceEnd = replaceStart + backticks.length;

        decorations.push({
            from: replaceStart,
            to: replaceEnd,
            decoration: Decoration.replace({})
        });
    }

    return decorations;
}

/**
 * Handles Blockquote nodes
 */
export function handleBlockquote(ctx: HandlerContext): DecorationItem[] {
    const { state, start, end } = ctx;
    const decorations: DecorationItem[] = [];

    const blockquoteStartLine = state.doc.lineAt(start);
    const blockquoteEndLine = state.doc.lineAt(end);

    for (let lineNum = blockquoteStartLine.number; lineNum <= blockquoteEndLine.number; lineNum++) {
        const line = state.doc.line(lineNum);
        const lineText = line.text;

        const prefixMatch = lineText.match(/^(\s*(?:>\s*)+)/);
        if (!prefixMatch) continue;

        const prefix = prefixMatch[0];
        const level = (prefix.match(/>/g) || []).length;

        let lineClasses = 'cm-blockquote-line';
        if (lineNum === blockquoteStartLine.number) {
            lineClasses += ' cm-blockquote-first-line';
        }
        if (lineNum === blockquoteEndLine.number) {
            lineClasses += ' cm-blockquote-last-line';
        }

        decorations.push({
            from: line.from,
            to: line.from,
            decoration: Decoration.line({
                attributes: {
                    class: lineClasses,
                    'data-bq-level': String(level)
                }
            })
        });

        for (let i = 0; i < prefix.length; i++) {
            if (prefix[i] === '>') {
                const markerPos = line.from + i;
                decorations.push({
                    from: markerPos,
                    to: markerPos + 1,
                    decoration: Decoration.replace({})
                });
            }
        }
    }

    return decorations;
}

/**
 * Handles HorizontalRule nodes
 */
export function handleHorizontalRule(ctx: HandlerContext): DecorationItem[] {
    const { state, isSelected, isHidingEnabled, start, end } = ctx;
    const line = state.doc.lineAt(start);

    if (isSelected || !isHidingEnabled) {
        return [
            { from: line.from, to: line.from, decoration: hrLineSelected },
            { from: start, to: end, decoration: visibleMarkdown }
        ];
    } else {
        return [
            { from: line.from, to: line.from, decoration: hrLine },
            { from: start, to: end, decoration: hiddenMarkdown }
        ];
    }
}

/**
 * Handles ListItem nodes
 */
export function handleListItem(ctx: HandlerContext, node: any): DecorationItem[] {
    const { state } = ctx;
    const listMarkNode = node.node.getChild('ListMark');

    if (listMarkNode) {
        const markText = state.doc.sliceString(listMarkNode.from, listMarkNode.to);

        if (/\d/.test(markText)) {
            return [{
                from: listMarkNode.from,
                to: listMarkNode.to,
                decoration: orderedListMarker
            }];
        }
    }

    return [];
}

/**
 * Handles Emphasis and StrongEmphasis nodes
 */
export function handleEmphasis(ctx: HandlerContext, isStrong: boolean): DecorationItem[] {
    const { isSelected, isHidingEnabled, start, end } = ctx;
    const decorationType = getDecorationType(isSelected, isHidingEnabled);
    const markerLength = isStrong ? 2 : 1;

    return [
        { from: start, to: start + markerLength, decoration: decorationType },
        { from: end - markerLength, to: end, decoration: decorationType }
    ];
}

/**
 * Handles InlineCode nodes
 */
export function handleInlineCode(ctx: HandlerContext): DecorationItem[] {
    const { state, isSelected, start, end } = ctx;

    if (!isSelected) {
        const inlineCodeContent = state.doc.sliceString(start, end);
        const content = inlineCodeContent.slice(1, -1);

        return [{
            from: start,
            to: end,
            decoration: Decoration.replace({
                widget: new InlineCodeWidget(content, inlineCodeContent, start),
                inclusive: true
            })
        }];
    } else {
        const decorationType = visibleMarkdown;
        return [
            { from: start, to: start + 1, decoration: decorationType },
            { from: end - 1, to: end, decoration: decorationType }
        ];
    }
}

/**
 * Handles ATXHeading nodes
 */
export function handleHeading(ctx: HandlerContext, headerLevel: number): DecorationItem[] {
    const { isSelected, isHidingEnabled, start } = ctx;
    const decorationType = getDecorationType(isSelected, isHidingEnabled);

    return [{
        from: start,
        to: start + headerLevel + 1,
        decoration: decorationType
    }];
}

/**
 * Handles Link nodes
 */
export function handleLink(ctx: HandlerContext): DecorationItem[] {
    const { state, isSelected, start, end } = ctx;
    const linkText = state.doc.sliceString(start, end);

    // Check if this is a footnote reference first
    const footnoteMatch = linkText.match(/^\[\^([^\]]+)\]$/);
    if (footnoteMatch) {
        return handleFootnote(ctx);
    }

    // Try inline link first: [text](url)
    const inlineMatch = linkText.match(/\[([^\]]+)\]\(([^)]+)\)/);
    if (inlineMatch) {
        const decorationType = getDecorationType(isSelected, true);
        const displayText = inlineMatch[1] || inlineMatch[2];

        if (!isSelected) {
            return [{
                from: start,
                to: end,
                decoration: Decoration.replace({
                    widget: new LinkWidget(displayText, linkText, start),
                    inclusive: true
                })
            }];
        } else {
            const linkStart = start + linkText.indexOf('[');
            const linkEnd = start + linkText.indexOf(']') + 1;
            const urlStart = start + linkText.indexOf('(');
            const urlEnd = start + linkText.indexOf(')') + 1;

            return [
                { from: linkStart, to: linkEnd, decoration: decorationType },
                { from: urlStart, to: urlEnd, decoration: decorationType }
            ];
        }
    }

    // Try reference-style link: [text][ref-id]
    const refMatch = linkText.match(/\[([^\]]+)\]\[([^\]]+)\]/);
    if (refMatch) {
        const displayText = refMatch[1];
        const refId = refMatch[2];
        const decorationType = getDecorationType(isSelected, true);

        if (!isSelected) {
            return [{
                from: start,
                to: end,
                decoration: Decoration.replace({
                    widget: new LinkWidget(displayText, linkText, start, refId),
                    inclusive: true
                })
            }];
        } else {
            const textStart = start;
            const textEnd = start + refMatch[1].length + 2; // [text]
            const refStart = textEnd;
            const refEnd = end;

            return [
                { from: textStart, to: textEnd, decoration: decorationType },
                { from: refStart, to: refEnd, decoration: decorationType }
            ];
        }
    }

    return [];
}

/**
 * Widget for footnote references (like [^1])
 */
export class FootnoteWidget extends WidgetType {
    constructor(
        private footnoteId: string,
        private fullText: string,
        private start: number
    ) {
        super();
    }

    toDOM(view: EditorView): HTMLElement {
        const sup = document.createElement("sup");
        sup.className = "cm-footnote-widget";
        sup.textContent = this.footnoteId;

        sup.addEventListener('mousedown', (event) => {
            event.preventDefault();

            // Find the footnote definition in the document
            const docText = view.state.doc.toString();
            const defPattern = new RegExp(`^\\[\\^${escapeRegExp(this.footnoteId)}\\]:`, 'm');
            const match = defPattern.exec(docText);

            if (match) {
                const defPos = match.index;
                const line = view.state.doc.lineAt(defPos);
                const targetEnd = line.to;

                view.dispatch({
                    selection: EditorSelection.cursor(targetEnd),
                    effects: [
                        EditorView.scrollIntoView(targetEnd, { y: "center" }),
                        addHighlightEffect.of({ from: line.from, to: targetEnd, timestamp: Date.now() })
                    ]
                });
            } else {
                // Fallback: select the footnote reference
                const end = this.start + this.fullText.length;
                view.dispatch({
                    selection: EditorSelection.single(this.start, end)
                });
            }
        });

        return sup;
    }

    eq(other: FootnoteWidget): boolean {
        return (
            other.footnoteId === this.footnoteId &&
            other.fullText === this.fullText &&
            other.start === this.start
        );
    }

    ignoreEvent(event: Event): boolean {
        return event.type === 'mousedown';
    }
}

/**
 * Widget for footnote definitions (the [^id]: content part)
 */
export class FootnoteDefinitionWidget extends WidgetType {
    constructor(
        private footnoteId: string,
        private content: string,
        private fullText: string,
        private start: number
    ) {
        super();
    }

    toDOM(view: EditorView): HTMLElement {
        const container = document.createElement("span");
        container.className = "cm-footnote-definition-widget";

        // Create the footnote ID part
        const idSpan = document.createElement("span");
        idSpan.textContent = this.footnoteId;
        idSpan.style.fontWeight = "600";

        // Create the content part
        const contentSpan = document.createElement("span");
        contentSpan.style.marginLeft = "8px";
        contentSpan.textContent = this.content;

        container.appendChild(idSpan);
        container.appendChild(contentSpan);

        // Set title for hover
        container.title = `Jump to footnote reference: ${this.footnoteId}`;

        container.addEventListener('mousedown', (event) => {
            event.preventDefault();

            // Find the footnote reference in the document
            const docText = view.state.doc.toString();
            const refPattern = new RegExp(`\\[\\^${escapeRegExp(this.footnoteId)}\\]`, 'g');
            const match = refPattern.exec(docText);

            if (match) {
                const targetPos = match.index;
                const targetEnd = targetPos + match[0].length;

                view.dispatch({
                    selection: EditorSelection.cursor(targetEnd),
                    effects: [
                        EditorView.scrollIntoView(targetEnd, { y: "center" }),
                        addHighlightEffect.of({ from: targetPos, to: targetEnd, timestamp: Date.now() })
                    ]
                });
            }
        });

        // Allow double-click to select the definition itself
        container.addEventListener('click', (event) => {
            if (event.detail === 2) {
                event.preventDefault();
                const end = this.start + this.fullText.length;
                view.dispatch({
                    selection: EditorSelection.single(this.start, end)
                });
            }
        });

        return container;
    }

    eq(other: FootnoteDefinitionWidget): boolean {
        return (
            other.footnoteId === this.footnoteId &&
            other.content === this.content &&
            other.fullText === this.fullText &&
            other.start === this.start
        );
    }

    ignoreEvent(event: Event): boolean {
        return event.type === 'mousedown' || event.type === 'click';
    }
}

/**
 * Handles footnote references like [^1]
 */
export function handleFootnote(ctx: HandlerContext): DecorationItem[] {
    const { state, isSelected, start, end } = ctx;
    const footnoteText = state.doc.sliceString(start, end);
    const footnoteMatch = footnoteText.match(/^\[\^([^\]]+)\]$/);

    if (!footnoteMatch) return [];

    const footnoteId = footnoteMatch[1];
    const decorationType = getDecorationType(isSelected, true);

    if (!isSelected) {
        return [{
            from: start,
            to: end,
            decoration: Decoration.replace({
                widget: new FootnoteWidget(footnoteId, footnoteText, start),
                inclusive: true
            })
        }];
    } else {
        return [{
            from: start,
            to: end,
            decoration: decorationType
        }];
    }
}

/**
 * Handles footnote definition lines: [^id]: content
 */
export function handleFootnoteDefinition(ctx: HandlerContext): DecorationItem[] {
    const { state, isSelected, start, end } = ctx;
    const line = state.doc.lineAt(start);
    const lineText = line.text;

    // Match footnote definition: [^id]: content
    const match = lineText.match(/^\[\^([^\]]+)\]:\s*(.*)/);

    if (!match) return [];

    const footnoteId = match[1];
    const content = match[2];
    const fullText = lineText;

    const decorations: DecorationItem[] = [];

    // Add line decoration for visual distinction
    decorations.push({
        from: line.from,
        to: line.from,
        decoration: Decoration.line({
            class: 'cm-footnote-definition-line'
        })
    });

    if (!isSelected) {
        // Replace the entire line with a nicely styled widget
        return [
            ...decorations,
            {
                from: start,
                to: end,
                decoration: Decoration.replace({
                    widget: new FootnoteDefinitionWidget(footnoteId, content, fullText, start),
                    inclusive: true
                })
            }
        ];
    } else {
        // When selected, show syntax with highlighting
        const colonPos = line.from + lineText.indexOf(':');
        const contentMatch = lineText.slice(lineText.indexOf(':') + 1).match(/\s*(.*)/);

        if (contentMatch) {
            const contentStartOffset = lineText.indexOf(':', lineText.indexOf(']')) + 1;
            const contentEnd = line.to;

            decorations.push(
                // Highlight the [^id]: part
                {
                    from: line.from,
                    to: colonPos + 1,
                    decoration: Decoration.mark({
                        class: 'cm-visible-markdown'
                    })
                },
                // Style the content part
                {
                    from: line.from + contentStartOffset,
                    to: contentEnd,
                    decoration: Decoration.mark({
                        class: 'cm-footnote-definition-content'
                    })
                }
            );
        }

        return decorations;
    }
}

/**
 * Handles Strikethrough nodes
 */
export function handleStrikethrough(ctx: HandlerContext): DecorationItem[] {
    const { state, isSelected, start, end } = ctx;
    const fullText = state.doc.sliceString(start, end);

    if (fullText.length < 4) return [];

    const content = fullText.slice(2, -2);

    if (!isSelected) {
        return [{
            from: start,
            to: end,
            decoration: Decoration.replace({
                widget: new StrikethroughWidget(content, fullText, start),
                inclusive: true
            })
        }];
    } else {
        const decorationType = visibleMarkdown;
        return [
            { from: start, to: start + 2, decoration: decorationType },
            { from: end - 2, to: end, decoration: decorationType }
        ];
    }
}

/**
 * Handles Mark (highlight) nodes
 */
export function handleMark(ctx: HandlerContext): DecorationItem[] {
    const { state, isSelected, start, end } = ctx;
    const fullText = state.doc.sliceString(start, end);

    if (fullText.length < 4) return [];

    const content = fullText.slice(2, -2);

    if (!isSelected) {
        return [{
            from: start,
            to: end,
            decoration: Decoration.replace({
                widget: new HighlightWidget(content, fullText, start),
                inclusive: true
            })
        }];
    } else {
        const decorationType = visibleMarkdown;
        return [
            { from: start, to: start + 2, decoration: decorationType },
            { from: end - 2, to: end, decoration: decorationType }
        ];
    }
}

/**
 * Handles Underline nodes
 */
export function handleUnderline(ctx: HandlerContext): DecorationItem[] {
    const { state, isSelected, start, end } = ctx;
    const fullText = state.doc.sliceString(start, end);

    if (fullText.length < 2) return [];

    const content = fullText.slice(1, -1);

    if (!isSelected) {
        return [{
            from: start,
            to: end,
            decoration: Decoration.replace({
                widget: new UnderlineWidget(content, fullText, start),
                inclusive: true
            })
        }];
    } else {
        const decorationType = visibleMarkdown;
        return [
            { from: start, to: start + 1, decoration: decorationType },
            { from: end - 1, to: end, decoration: decorationType }
        ];
    }
}

/**
 * Handles Image nodes
 */
export function handleImage(ctx: HandlerContext): DecorationItem[] {
    const { state, isSelected, isHidingEnabled, start, end } = ctx;
    const imageText = state.doc.sliceString(start, end);
    const imageMatch = imageText.match(/!\[([^\]]*)\]\(([^)]+)\)/);

    if (!imageMatch) return [];

    const decorationType = getDecorationType(isSelected, isHidingEnabled);
    const alt = imageMatch[1];

    return [
        { from: start, to: start + 2, decoration: decorationType },
        { from: start + 2 + alt.length, to: end, decoration: decorationType }
    ];
}

/**
 * Widget for link definitions (the [id]: url part)
 */
export class LinkDefinitionWidget extends WidgetType {
    constructor(
        private refId: string,
        private url: string,
        private fullText: string,
        private start: number
    ) {
        super();
    }

    toDOM(view: EditorView): HTMLElement {
        const container = document.createElement("span");
        container.className = "cm-link-definition-widget";

        // Create the reference ID part
        const refSpan = document.createElement("span");
        refSpan.textContent = this.refId;
        refSpan.style.fontWeight = "600";

        // Create a small URL preview (shortened if too long)
        const urlPreview = document.createElement("span");
        urlPreview.style.fontSize = "0.85em";
        urlPreview.style.opacity = "0.6";
        urlPreview.style.marginLeft = "8px";

        // Shorten URL for display
        let displayUrl = this.url;
        if (displayUrl.length > 40) {
            displayUrl = displayUrl.substring(0, 37) + "...";
        }
        urlPreview.textContent = `(${displayUrl})`;

        container.appendChild(refSpan);
        container.appendChild(urlPreview);

        // Set title for full URL on hover
        container.title = `Jump to reference: ${this.refId}\nURL: ${this.url}`;

        container.addEventListener('mousedown', (event) => {
            event.preventDefault();

            // Find the reference usage in the document
            const docText = view.state.doc.toString();
            const refPattern = new RegExp(`\\[([^\\]]+)\\]\\[${escapeRegExp(this.refId)}\\]`, 'gi');
            const match = refPattern.exec(docText);

            if (match) {
                const targetPos = match.index;
                const targetEnd = targetPos + match[0].length;

                // Move cursor to the END of the reference (not select it)
                view.dispatch({
                    selection: EditorSelection.cursor(targetEnd),
                    effects: [
                        EditorView.scrollIntoView(targetEnd, { y: "center" }),
                        // Add a special effect to mark this as a programmatic jump
                        addHighlightEffect.of({ from: targetPos, to: targetEnd, timestamp: Date.now() })
                    ]
                });
            }
        });

        // Allow double-click to select the definition itself
        container.addEventListener('click', (event) => {
            if (event.detail === 2) {
                event.preventDefault();
                const end = this.start + this.fullText.length;
                view.dispatch({
                    selection: EditorSelection.single(this.start, end)
                });
            }
        });

        return container;
    }

    eq(other: LinkDefinitionWidget): boolean {
        return (
            other.refId === this.refId &&
            other.url === this.url &&
            other.fullText === this.fullText &&
            other.start === this.start
        );
    }

    ignoreEvent(event: Event): boolean {
        return event.type === 'mousedown' || event.type === 'click';
    }
}

/**
 * Handles link definition lines: [id]: url
 */
export function handleLinkDefinition(ctx: HandlerContext): DecorationItem[] {
    const { state, isSelected, start, end } = ctx;
    const line = state.doc.lineAt(start);
    const lineText = line.text;

    // Match link definition: [ref-id]: url (optional "title")
    const match = lineText.match(/^\[([^\]]+)\]:\s*(\S+)(?:\s+"([^"]*)")?/);

    if (!match) return [];

    const refId = match[1];
    const url = match[2];
    const fullText = lineText;

    const decorations: DecorationItem[] = [];

    // Add line decoration for visual distinction
    decorations.push({
        from: line.from,
        to: line.from,
        decoration: Decoration.line({
            class: 'cm-link-definition-line'
        })
    });

    if (!isSelected) {
        // Replace the entire line with a nicely styled widget
        return [
            ...decorations,
            {
                from: start,
                to: end,
                decoration: Decoration.replace({
                    widget: new LinkDefinitionWidget(refId, url, fullText, start),
                    inclusive: true
                })
            }
        ];
    } else {
        // When selected, show syntax with highlighting
        const colonPos = line.from + lineText.indexOf(':');
        const urlMatch = lineText.slice(lineText.indexOf(':') + 1).match(/\s*(\S+)/);

        if (urlMatch) {
            const urlStartOffset = lineText.indexOf(':', lineText.indexOf(']')) + 1 + urlMatch.index!;
            const urlEnd = line.from + urlStartOffset + urlMatch[1].length;

            decorations.push(
                // Highlight the [ref-id]: part
                {
                    from: line.from,
                    to: colonPos + 1,
                    decoration: Decoration.mark({
                        class: 'cm-visible-markdown'
                    })
                },
                // Style the URL part
                {
                    from: line.from + urlStartOffset,
                    to: urlEnd,
                    decoration: Decoration.mark({
                        class: 'cm-link-definition-url'
                    })
                }
            );
        }

        return decorations;
    }
}