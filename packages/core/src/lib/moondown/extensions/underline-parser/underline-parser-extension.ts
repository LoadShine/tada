
/**
 * Underline markdown parser extension
 *
 * This extension adds support for underlined text formatting using single tilde syntax (~text~).
 * It integrates with the Lezer markdown parser to recognize and parse underline markers.
 * Note: This uses single tilde to distinguish from strikethrough which uses double tilde.
 */

import {InlineContext, type MarkdownExtension} from "@lezer/markdown";

/**
 * Delimiter configuration for underline parsing
 * Defines how the parser should handle underline markers
 */
export const UnderlineDelim = {resolve: "Underline", mark: "UnderlineMarker"};

/**
 * Markdown extension for underline text formatting
 *
 * Adds support for ~text~ syntax by:
 * - Defining AST nodes for underline elements and their markers
 * - Parsing inline text for single tilde (~) patterns
 * - Creating proper delimiter pairs for text styling
 */
export const UnderlineExtension: MarkdownExtension = {
    defineNodes: ["Underline", "UnderlineMarker"],
    parseInline: [
        {
            name: "Underline",
            parse(cx: InlineContext, next: number, pos: number) {
                // Check for single tilde (~) at current position
                // 126 is the ASCII code for '~'
                if (next != 126 /* '~' */) return -1;

                // Add delimiter pair for underline formatting
                // The delimiter spans 1 character (~) starting at pos
                return cx.addDelimiter(UnderlineDelim, pos, pos + 1, true, true);
            },
        },
    ],
};
