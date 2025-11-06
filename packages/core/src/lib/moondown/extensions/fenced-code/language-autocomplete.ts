
/**
 * Language identifier autocompletion for fenced code blocks
 *
 * This module provides intelligent autocompletion for programming language
 * identifiers in markdown fenced code blocks. When users type ``` followed
 * by a language name, it suggests matching programming languages.
 */

import {autocompletion, CompletionContext} from "@codemirror/autocomplete";

/**
 * Supported programming languages for code block syntax highlighting
 *
 * This list contains popular programming languages that are commonly
 * used in fenced code blocks. Each language is configured as a
 * keyword type completion for better visual distinction.
 */
const languageNames = [
    {label: "javascript", type: "keyword"},
    {label: "python", type: "keyword"},
    {label: "java", type: "keyword"},
    {label: "csharp", type: "keyword"},
    {label: "cpp", type: "keyword"},
    {label: "ruby", type: "keyword"},
    {label: "go", type: "keyword"},
]

/**
 * Provides language identifier autocompletion in fenced code blocks
 *
 * This function acts as a completion source for CodeMirror's autocompletion
 * system. It specifically targets the language identifier position that
 * appears immediately after triple backticks (```) in markdown code blocks.
 *
 * @param context - The completion context containing editor state and cursor position
 * @returns Completion result with matching language options, or null if not in a code block
 *
 * @example
 * When user types "```jav" and triggers completion:
 * - Returns completion options starting with "jav" (javascript, java)
 * - Completion replaces from position 3 (after ```) to cursor position
 */
function languageIdentifierCompletion(context: CompletionContext) {
    const {state, pos} = context
    const line = state.doc.lineAt(pos)
    const lineStart = line.from
    const beforeCursor = state.doc.sliceString(lineStart, pos)

    // Check if current line starts with ``` and capture input language identifier
    const tripleBacktickMatch = /^```([^\s`]*)$/.exec(beforeCursor)
    if (tripleBacktickMatch) {
        const word = tripleBacktickMatch[1]

        // Return matching language list
        return {
            from: lineStart + 3, // Cursor position after ```
            to: pos,
            options: languageNames.filter(lang => lang.label.startsWith(word)),
            validFor: /^([^\s`]*)$/ // Keep autocompletion when typing or deleting characters
        }
    }

    return null
}

/**
 * CodeMirror extension for language identifier autocompletion
 *
 * This extension integrates with CodeMirror's autocompletion system to provide
 * intelligent language suggestions when users are typing language identifiers
 * in fenced code blocks.
 *
 * @example
 * ```typescript
 * // Include in CodeMirror extensions
 * const extensions = [
 *   languageIdentifierAutocomplete,
 *   // ... other extensions
 * ]
 * ```
 */
export const languageIdentifierAutocomplete = autocompletion({
    override: [languageIdentifierCompletion]
})