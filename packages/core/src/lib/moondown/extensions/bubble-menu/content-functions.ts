import { EditorView } from "@codemirror/view";
import { EditorState, type ChangeSpec } from "@codemirror/state";
import {
    getLinesInRange,
    applyChanges,
    getTextWithContext,
    SELECTION
} from "../../core";
import {
    escapeRegExp,
    createHeadingPrefix,
    extractListNumber, isUnorderedListItem
} from "../../core";

/**
 * Functions for manipulating markdown content in the editor
 * These functions handle inline styles, headings, and lists
 */

/**
 * Sets or toggles heading level for selected lines
 * @param view - Editor view
 * @param level - Heading level (1-6)
 * @returns True if operation succeeded
 */
export function setHeader(view: EditorView, level: number): boolean {
    const { state } = view;
    const { from, to } = state.selection.main;
    const headerPrefix = createHeadingPrefix(level);
    const lines = getLinesInRange(state, from, to);

    const changes: ChangeSpec[] = lines.map(line => {
        // Toggle off if already this heading level
        if (line.text.startsWith(headerPrefix)) {
            return {
                from: line.from,
                to: line.from + headerPrefix.length,
                insert: ''
            };
        }

        // Replace existing heading with new level
        const existingHeaderMatch = line.text.match(/^#+\s/);
        if (existingHeaderMatch) {
            return {
                from: line.from,
                to: line.from + existingHeaderMatch[0].length,
                insert: headerPrefix
            };
        }

        // Add new heading
        return { from: line.from, insert: headerPrefix };
    });

    applyChanges(view, changes);
    return true;
}

/**
 * Toggles ordered or unordered list formatting for selected lines
 * @param view - Editor view
 * @param ordered - True for ordered list, false for unordered
 * @returns True if operation succeeded
 */
export function toggleList(view: EditorView, ordered: boolean): boolean {
    const { state } = view;
    const { from, to } = state.selection.main;
    const lines = getLinesInRange(state, from, to);

    // Determine starting number for ordered lists
    let currentNumber = 1;
    const fromLine = state.doc.lineAt(from);
    if (fromLine.number > 1 && ordered) {
        const prevLine = state.doc.line(fromLine.number - 1);
        const prevNumber = extractListNumber(prevLine.text);
        if (prevNumber !== null) {
            currentNumber = prevNumber + 1;
        }
    }

    const changes: ChangeSpec[] = lines.map(line => {
        const lineText = line.text;

        if (ordered) {
            const existingNumber = extractListNumber(lineText);
            if (existingNumber !== null) {
                // Remove ordered list marker
                const match = lineText.match(/^(\d+)\.\s/);
                return {
                    from: line.from,
                    to: line.from + match![0].length,
                    insert: ''
                };
            }
            // Add ordered list marker
            const insert = `${currentNumber}. `;
            currentNumber++;
            return { from: line.from, insert };
        } else {
            if (isUnorderedListItem(lineText)) {
                // Remove unordered list marker
                return { from: line.from, to: line.from + 2, insert: '' };
            }
            // Add unordered list marker
            return { from: line.from, insert: '- ' };
        }
    });

    applyChanges(view, changes);
    return true;
}

/**
 * Toggles inline markdown style (bold, italic, etc.) for selection
 * @param view - Editor view
 * @param mark - Markdown marker to toggle
 * @returns True if operation succeeded
 */
export function toggleInlineStyle(view: EditorView, mark: string): boolean {
    const { state } = view;
    const { from, to } = state.selection.main;

    // Get text with context around selection
    const contextLength = mark.length * SELECTION.MARKER_CONTEXT_LENGTH;
    const { text: textToCheck, start } = getTextWithContext(
        state,
        from,
        to,
        contextLength
    );

    const escapedMark = escapeRegExp(mark);
    const regex = new RegExp(`(${escapedMark}+)([\\s\\S]*?)\\1`, 'g');

    const markerLength = mark.length;

    const changes = [];
    let match;
    let found = false;

    // Check for special case of bold to italic or bold-italic to bold conversion
    if (mark === '*') {
        const boldOrBoldItalicRegex = /(\*{2,3})([^*]+)\1/g;
        while ((match = boldOrBoldItalicRegex.exec(textToCheck)) !== null) {
            const matchStart = start + match.index;
            const matchEnd = matchStart + match[0].length;
            if (matchStart <= from && to <= matchEnd) {
                const existingMarkers = match[1];
                if (existingMarkers === '**') {
                    // Convert bold to bold-italic
                    changes.push(
                        {from: matchStart, to: matchStart + 2, insert: '***'},
                        {from: matchEnd - 2, to: matchEnd, insert: '***'}
                    );
                } else if (existingMarkers === '***') {
                    // Convert bold-italic to bold
                    changes.push(
                        {from: matchStart, to: matchStart + 3, insert: '**'},
                        {from: matchEnd - 3, to: matchEnd, insert: '**'}
                    );
                }
                found = true;
                break;
            }
        }
    }

    if (!found) {
        while ((match = regex.exec(textToCheck)) !== null) {
            const fullMarkerLength = match[1].length;
            if (fullMarkerLength % markerLength !== 0) {
                continue;
            }
            const matchStart = start + match.index;
            const matchEnd = matchStart + match[0].length;

            if (matchStart <= from && to <= matchEnd) {
                // Remove one layer of markers
                const removeStart = matchStart;
                const removeEnd = matchEnd;

                changes.push(
                    {from: removeStart, to: removeStart + markerLength, insert: ''},
                    {from: removeEnd - markerLength, to: removeEnd, insert: ''}
                );
                found = true;
                break;
            }
        }
    }

    if (!found) {
        // Check for combined styles
        const combinedRegex = /(\*{1,3}|_{1,3}|~~|==)([^*_~=]+)\1/g;
        while ((match = combinedRegex.exec(textToCheck)) !== null) {
            const matchStart = start + match.index;
            const matchEnd = matchStart + match[0].length;

            if (matchStart <= from && to <= matchEnd) {
                const existingMarkers = match[1];
                if (existingMarkers.includes(mark)) {
                    // Remove the mark from existing markers
                    const newMarkers = existingMarkers.replace(mark, '');
                    changes.push(
                        {from: matchStart, to: matchStart + existingMarkers.length, insert: newMarkers},
                        {from: matchEnd - existingMarkers.length, to: matchEnd, insert: newMarkers}
                    );
                } else {
                    // Add the mark to existing markers
                    changes.push(
                        {from: matchStart, to: matchStart + existingMarkers.length, insert: existingMarkers + mark},
                        {from: matchEnd - existingMarkers.length, to: matchEnd, insert: mark + existingMarkers}
                    );
                }
                found = true;
                break;
            }
        }
    }

    if (!found) {
        // Add markers
        changes.push(
            {from, insert: mark},
            {from: to, insert: mark}
        );
    }

    applyChanges(view, changes);
    return true;
}

/**
 * Checks if a specific heading level is active at cursor position
 * @param state - Editor state
 * @param level - Heading level to check
 * @returns True if the heading level is active
 */
export function isHeaderActive(state: EditorState, level: number): boolean {
    const { from } = state.selection.main;
    const line = state.doc.lineAt(from);
    const headerPrefix = createHeadingPrefix(level);
    return line.text.startsWith(headerPrefix);
}

/**
 * Checks if an inline style marker is active at selection
 * @param state - Editor state
 * @param marker - Markdown marker to check
 * @returns True if the style is active
 */
export function isInlineStyleActive(state: EditorState, marker: string): boolean {
    const { from, to } = state.selection.main;

    // Get text with context
    const contextLength = marker.length * SELECTION.MARKER_CONTEXT_LENGTH;
    const { text: textToCheck, start } = getTextWithContext(
        state,
        from,
        to,
        contextLength
    );

    const escapedMarker = escapeRegExp(marker);

    // Use more precise regex pattern to match markers
    const regex = new RegExp(`(?<!\\${marker[0]})${escapedMarker}([^${escapedMarker}]+)${escapedMarker}(?!\\${marker[0]})`, 'g');

    let match;
    while ((match = regex.exec(textToCheck)) !== null) {
        const matchStart = start + match.index;
        const matchEnd = matchStart + match[0].length;

        if (matchStart <= from && to <= matchEnd) {
            return true;
        }
    }

    // Handle bold-italic cases
    if (marker === '**' || marker === '*') {
        const boldItalicRegex = /\*{3}([^*]+)\*{3}/g;
        while ((match = boldItalicRegex.exec(textToCheck)) !== null) {
            const matchStart = start + match.index;
            const matchEnd = matchStart + match[0].length;

            if (matchStart <= from && to <= matchEnd) {
                return true;
            }
        }
    }

    return false;
}


/**
 * Checks if a list style is active at cursor position
 * @param state - Editor state
 * @param ordered - True to check for ordered list, false for unordered
 * @returns True if the list style is active
 */
export function isListActive(state: EditorState, ordered: boolean): boolean {
    const { from } = state.selection.main;
    const line = state.doc.lineAt(from);

    if (ordered) {
        return extractListNumber(line.text) !== null;
    } else {
        return isUnorderedListItem(line.text);
    }
}