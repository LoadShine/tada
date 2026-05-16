/**
 * Strips Base64 image data from markdown text to save tokens for AI processing.
 * Replaces `![Alt](data:image/...)` with `[Image: Alt]`.
 */
export function stripBase64Images(text: string): string {
    if (!text) return '';
    return text.replace(/!\[([^\]]*)\]\((data:[^)]+)\)/g, (_match, alt) => {
        return `[Image${alt ? ': ' + alt : ''}]`;
    });
}
