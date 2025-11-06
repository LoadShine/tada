
/**
 * Mark (highlight) markdown parser extension
 *
 * This extension adds support for highlighted text formatting using double equals syntax (==text==).
 * It integrates with the Lezer markdown parser to recognize and parse highlight markers.
 * This is commonly used for text highlighting or marking important content.
 */

import {InlineContext, type MarkdownExtension} from "@lezer/markdown";

/**
 * Delimiter configuration for mark (highlight) parsing
 * Defines how the parser should handle highlight markers
 */
export const MarkDelim = { resolve: "Mark", mark: "MarkMarker" };

/**
 * Markdown extension for mark (highlight) text formatting
 *
 * Adds support for ==text== syntax by:
 * - Defining AST nodes for mark elements and their markers
 * - Parsing inline text for double equals (==) patterns
 * - Creating proper delimiter pairs for text styling
 */
export const MarkExtension: MarkdownExtension = {
    defineNodes: ["Mark", "MarkMarker"],
    parseInline: [
        {
            name: "Mark",
            parse(cx: InlineContext, next: number, pos: number) {
                // Check for double equals (==) at current position
                // 61 is the ASCII code for '='
                if (next != 61 /* '=' */ || cx.char(pos + 1) != 61) return -1;

                // Add delimiter pair for mark (highlight) formatting
                // The delimiter spans 2 characters (==) starting at pos
                return cx.addDelimiter(MarkDelim, pos, pos + 2, true, true);
            },
        },
    ],
};