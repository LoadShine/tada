import {type Extension, Compartment, StateEffect, StateField} from '@codemirror/state';
import { EditorView, keymap, rectangularSelection } from '@codemirror/view';
import { indentOnInput } from '@codemirror/language';
import { markdown } from '@codemirror/lang-markdown';
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { closeBracketsKeymap, completionKeymap } from "@codemirror/autocomplete";
import { languages } from "@codemirror/language-data";
import { GFM } from "@lezer/markdown";
import type {AIStreamHandler, MoondownTranslations} from "../core";

// Import extensions
import { correctList } from "./correct-list";
import { markdownSyntaxHiding } from "./markdown-syntax-hiding";
import { Mark } from "./mark-parser";
import { Underline } from "./underline-parser";
import { Strikethrough } from "./strikethrough-parser";
import { finalNewLine } from "./final-new-line";
import { tableExtension } from "./table";
import { slashCommand } from "./slash-command";
import { imageExtension } from "./image";
import { fencedCode } from "./fenced-code";
import { blockquote } from "./blockquote";
import { bubbleMenu } from "./bubble-menu";

// Import theme
import { lightTheme } from "../theme/base-theme";

/**
 * Theme compartment for dynamic theme switching
 */
export const themeCompartment = new Compartment();

/**
 * Compartment for WYSIWYG extensions that can be toggled
 */
export const wysiwygCompartment = new Compartment();

/**
 * Compartment for dynamically toggling read-only state
 */
export const readOnlyCompartment = new Compartment();

/**
 * Compartment for dynamically setting placeholder text
 */
export const placeholderCompartment = new Compartment();

/** State field to hold the AI stream handler */
export const onAIStreamState = StateField.define<AIStreamHandler | null>({
    create: () => null,
    update: (value, tr) => {
        for (const e of tr.effects) if (e.is(setOnAIStream)) return e.value;
        return value;
    }
});
export const setOnAIStream = StateEffect.define<AIStreamHandler | null>();

/** State field to hold translations */
export const translationsState = StateField.define<MoondownTranslations>({
    create: () => ({}),
    update: (value, tr) => {
        for (const e of tr.effects) if (e.is(setTranslations)) return e.value;
        return value;
    }
});
export const setTranslations = StateEffect.define<MoondownTranslations>();


/**
 * Extensions that provide the WYSIWYG experience
 * These will be toggled on/off by the "Hide Syntax" switch.
 */
export const wysiwygExtensions: Extension[] = [
    tableExtension(),
    imageExtension(),
    markdownSyntaxHiding(),
];

/**
 * Default editor extensions
 * Includes all core functionality: markdown parsing, syntax highlighting,
 * bubble menu, slash commands, table editing, image support, etc.
 */
export const defaultExtensions: Extension[] = [
    // History and undo/redo
    history(),

    // Selection and editing
    rectangularSelection(),
    indentOnInput(),

    // Core functionality extensions
    slashCommand(),
    correctList(),
    fencedCode(),
    blockquote(),
    bubbleMenu(),

    // State Fields for dynamic settings
    onAIStreamState,
    translationsState,

    // Keymaps
    keymap.of([
        indentWithTab,
        ...defaultKeymap,
        ...completionKeymap,
        ...historyKeymap,
        ...closeBracketsKeymap
    ]),

    // Editor behavior
    EditorView.lineWrapping,

    // WYSIWYG extensions, loaded into a compartment to be toggled
    wysiwygCompartment.of(wysiwygExtensions),

    // Markdown language support
    markdown({
        codeLanguages: languages,
        extensions: [GFM, Mark, Underline, Strikethrough],
        addKeymap: false,
    }),

    // Final newline
    finalNewLine,

    // Default theme (light)
    themeCompartment.of(lightTheme)
];