/**
 * Utility functions for string manipulation
 */

/**
 * Escapes special regex characters in a string
 * @param str - String to escape
 * @returns Escaped string safe for use in RegExp
 */
export function escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Checks if a string matches Markdown image syntax
 * @param text - Text to check
 * @returns True if text is an image markdown
 */
export function isMarkdownImage(text: string): boolean {
    return /^!\[.*?\]\(.*?\)$/.test(text.trim());
}

/**
 * Creates a heading prefix with the specified level
 * @param level - Heading level (1-6)
 * @returns Heading prefix string (e.g., "# ", "## ")
 */
export function createHeadingPrefix(level: number): string {
    if (level < 1 || level > 6) {
        throw new Error('Heading level must be between 1 and 6');
    }
    return '#'.repeat(level) + ' ';
}

/**
 * Extracts heading level from a line of text
 * @param text - Line text to check
 * @returns Heading level (1-6) or null if not a heading
 */
export function getHeadingLevel(text: string): number | null {
    const match = text.match(/^(#{1,6})\s/);
    return match ? match[1].length : null;
}

/**
 * Checks if a line is an ordered list item
 * @param text - Line text to check
 * @returns True if the line is an ordered list item
 */
export function isOrderedListItem(text: string): boolean {
    return /^\d+\.\s/.test(text);
}

/**
 * Checks if a line is an unordered list item
 * @param text - Line text to check
 * @returns True if the line is an unordered list item
 */
export function isUnorderedListItem(text: string): boolean {
    return /^-\s/.test(text);
}

/**
 * Extracts the number from an ordered list item
 * @param text - Ordered list item text
 * @returns The list number or null if not an ordered list item
 */
export function extractListNumber(text: string): number | null {
    const match = text.match(/^(\d+)\.\s/);
    return match ? parseInt(match[1], 10) : null;
}

/**
 * Strips Base64 image data from markdown text to save tokens for AI processing.
 * Replaces `![Alt](data:image/...)` with `[Image: Alt]`.
 * @param text - The raw markdown text
 * @returns The sanitized text with Base64 data removed
 */
export function stripBase64Images(text: string): string {
    if (!text) return '';
    // Matches markdown images where the URL starts with "data:"
    // Captures the Alt text ($1) and replaces the whole thing with a placeholder
    return text.replace(/!\[([^\]]*)\]\((data:[^)]+)\)/g, (_match, alt) => {
        return `[Image${alt ? ': ' + alt : ''}]`;
    });
}