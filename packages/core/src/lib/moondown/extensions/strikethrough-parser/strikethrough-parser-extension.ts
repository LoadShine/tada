
/**
 * Strikethrough markdown parser extension
 *
 * This extension adds support for strikethrough text formatting using double tilde syntax (~~text~~).
 * It integrates with the Lezer markdown parser to recognize and parse strikrough markers.
 */

import {InlineContext, type MarkdownExtension} from "@lezer/markdown";

/**
 * Delimiter configuration for strikethrough parsing
 * Defines how the parser should handle strikethrough markers
 */
export const StrikethroughDelim = { resolve: "Strikethrough", mark: "StrikethroughMarker" };

/**
 * Markdown extension for strikethrough text formatting
 *
 * Adds support for ~~text~~ syntax by:
 * - Defining AST nodes for strikethrough elements and their markers
 * - Parsing inline text for double tilde (~~) patterns
 * - Creating proper delimiter pairs for text styling
 */
export const StrikethroughExtension: MarkdownExtension = {
    defineNodes: ["Strikethrough", "StrikethroughMarker"],
    parseInline: [
        {
            name: "Strikethrough",
            parse(cx: InlineContext, next: number, pos: number) {
                // Check for double tilde (~~) at current position
                // 126 is the ASCII code for '~'
                if (next != 126 /* '~' */ || cx.char(pos + 1) != 126) return -1;

                // Add delimiter pair for strikethrough formatting
                // The delimiter spans 2 characters (~~) starting at pos
                return cx.addDelimiter(StrikethroughDelim, pos, pos + 2, true, true);
            },
        },
    ],
};