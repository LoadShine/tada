// src/components/common/CodeMirrorEditor.tsx
// @ts-expect-error - Explicit React import sometimes needed
import React, { useRef, useEffect, useImperativeHandle, forwardRef, memo } from 'react';
import { EditorState, StateEffect, Annotation } from '@codemirror/state';
import { EditorView, keymap, drawSelection, dropCursor, rectangularSelection, placeholder as viewPlaceholder } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { bracketMatching, indentOnInput, foldKeymap } from '@codemirror/language';
import { autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { lintKeymap } from '@codemirror/lint';
import { cn } from '@/lib/utils';

// Consistent Editor Theme definition using CSS Variables for better theming
const editorTheme = EditorView.theme({
    '&': {
        height: '100%',
        fontSize: '13.5px', // Slightly smaller font size
        backgroundColor: 'transparent',
        borderRadius: 'inherit',
        fontFamily: 'var(--font-sans)', // Use theme font
    },
    '.cm-scroller': {
        fontFamily: 'var(--font-mono)', // Use theme mono font for code-like feel
        lineHeight: '1.65',
        overflow: 'auto',
        position: 'relative',
        backgroundColor: 'transparent !important',
        height: '100%',
        outline: 'none',
    },
    '.cm-content': {
        padding: '14px 16px',
        caretColor: 'hsl(var(--primary))', // Use theme primary
        backgroundColor: 'transparent !important',
        outline: 'none',
        color: 'hsl(var(--foreground))', // Use theme foreground
        '& ::selection': { // Improve selection visibility
            backgroundColor: 'hsl(var(--primary) / 0.25) !important',
        },
    },
    // Gutters are optional, can be removed if line numbers aren't needed
    // '.cm-gutters': {
    //     backgroundColor: 'hsl(var(--muted) / 0.3)', // Muted bg
    //     borderRight: '1px solid hsl(var(--border) / 0.5)', // Theme border
    //     color: 'hsl(var(--muted-foreground))',
    //     backdropFilter: 'blur(4px)',
    //     userSelect: 'none',
    // },
    // '.cm-lineNumbers .cm-gutterElement': { minWidth: '24px', textAlign: 'right' },
    '.cm-line': { padding: '0 4px' }, // Keep line padding minimal
    '.cm-activeLine': { backgroundColor: 'hsl(var(--primary) / 0.08)' }, // Subtle active line
    // '.cm-activeLineGutter': { backgroundColor: 'hsl(var(--primary) / 0.12)' },
    '.cm-placeholder': {
        color: 'hsl(var(--muted-foreground))', // Theme placeholder
        fontStyle: 'italic',
        pointerEvents: 'none',
        padding: '14px 16px', // Match content padding
        position: 'absolute',
        top: 0,
        left: 0,
    },
    '.cm-searchMatch': {
        backgroundColor: 'hsl(var(--primary) / 0.2)',
        outline: '1px solid hsl(var(--primary) / 0.3)',
        borderRadius: '2px',
    },
    '.cm-searchMatch-selected': {
        backgroundColor: 'hsl(var(--primary) / 0.3)',
        outline: '1px solid hsl(var(--primary) / 0.5)'
    },
    '.cm-selectionBackground': {
        backgroundColor: 'hsl(var(--primary) / 0.25) !important', // Ensure override if needed
    },
    '.cm-focused': { outline: 'none !important' },
    // Markdown specific styles (enhance defaults)
    ".cm-content .cm-header": { color: "hsl(var(--primary))", fontWeight: "600" },
    ".cm-content .cm-strong": { fontWeight: "600" },
    ".cm-content .cm-emphasis": { fontStyle: "italic" },
    ".cm-content .cm-link": { color: "hsl(var(--primary) / 0.9)", textDecoration: "underline", cursor: "pointer" },
    ".cm-content .cm-quote": { borderLeft: "3px solid hsl(var(--border))", paddingLeft: "8px", color: "hsl(var(--muted-foreground))", fontStyle: "italic" },
    ".cm-content .cm-comment": { color: "hsl(var(--muted-foreground))" },
    ".cm-content .cm-list-marker": { color: "hsl(var(--primary))" }, // Style list markers
    ".cm-content .cm-hr": { borderTop: "1px solid hsl(var(--border))", margin: "1em 0" }, // Horizontal rule
    // Inline code
    ".cm-content .cm-inline-code": {
        backgroundColor: "hsl(var(--muted) / 0.5)",
        color: "hsl(var(--foreground) / 0.8)",
        padding: "0.1em 0.3em",
        borderRadius: "3px",
        fontFamily: "var(--font-mono)",
        fontSize: "90%",
    },
    // Code blocks (if using ```)
    ".cm-content .cm-code-block": {
        backgroundColor: "hsl(var(--muted) / 0.4)",
        fontFamily: "var(--font-mono)",
        padding: "1em",
        borderRadius: "4px",
        overflowX: "auto",
        fontSize: "90%",
        lineHeight: "1.5",
    },
});

const externalChangeEvent = Annotation.define<boolean>();

interface CodeMirrorEditorProps {
    value: string;
    onChange: (newValue: string) => void;
    className?: string;
    placeholder?: string;
    readOnly?: boolean;
    onBlur?: () => void;
}

export interface CodeMirrorEditorRef {
    focus: () => void;
    getView: () => EditorView | null;
}

const CodeMirrorEditor = forwardRef<CodeMirrorEditorRef, CodeMirrorEditorProps>(
    ({ value, onChange, className, placeholder, readOnly = false, onBlur }, ref) => {
        const editorRef = useRef<HTMLDivElement>(null);
        const viewRef = useRef<EditorView | null>(null);
        const onChangeRef = useRef(onChange);
        const onBlurRef = useRef(onBlur);
        const prevReadOnlyRef = useRef(readOnly);
        const prevPlaceholderRef = useRef(placeholder);

        useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
        useEffect(() => { onBlurRef.current = onBlur; }, [onBlur]);

        useImperativeHandle(ref, () => ({
            focus: () => { viewRef.current?.focus(); },
            getView: () => viewRef.current,
        }), []);

        useEffect(() => {
            if (!editorRef.current) return;

            const createExtensions = (currentPlaceholder?: string, currentReadOnly?: boolean) => [
                history(), drawSelection(), dropCursor(), EditorState.allowMultipleSelections.of(true), indentOnInput(),
                bracketMatching(), closeBrackets(), autocompletion(), rectangularSelection(), highlightSelectionMatches(),
                keymap.of([ ...closeBracketsKeymap, ...defaultKeymap, ...searchKeymap, ...historyKeymap, ...foldKeymap, ...completionKeymap, ...lintKeymap, indentWithTab, ]),
                markdown({ base: markdownLanguage, codeLanguages: languages, addKeymap: true }),
                EditorView.lineWrapping, EditorView.contentAttributes.of({ 'aria-label': 'Markdown editor content' }),
                EditorView.updateListener.of((update) => {
                    const isExternal = update.transactions.some(tr => tr.annotation(externalChangeEvent));
                    if (update.docChanged && !isExternal) {
                        onChangeRef.current(update.state.doc.toString());
                    }
                    if (update.focusChanged && !update.view.hasFocus) {
                        onBlurRef.current?.();
                    }
                }),
                EditorState.readOnly.of(currentReadOnly ?? false),
                ...(currentPlaceholder ? [viewPlaceholder(currentPlaceholder)] : []),
                editorTheme, // Apply custom theme
            ];

            const startState = EditorState.create({
                doc: value,
                extensions: createExtensions(placeholder, readOnly)
            });

            const view = new EditorView({ state: startState, parent: editorRef.current });
            viewRef.current = view;
            prevReadOnlyRef.current = readOnly;
            prevPlaceholderRef.current = placeholder;

            return () => {
                view.destroy();
                viewRef.current = null;
            };
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, []); // Mount only

        useEffect(() => {
            const view = viewRef.current;
            if (view && value !== view.state.doc.toString()) {
                view.dispatch({
                    changes: { from: 0, to: view.state.doc.length, insert: value || '' },
                    annotations: externalChangeEvent.of(true)
                });
            }
        }, [value]);

        useEffect(() => {
            const view = viewRef.current;
            if (!view) return;
            const effects: StateEffect<unknown>[] = [];
            if (readOnly !== prevReadOnlyRef.current) {
                effects.push(StateEffect.reconfigure.of(EditorState.readOnly.of(readOnly)));
                prevReadOnlyRef.current = readOnly;
            }
            if (placeholder !== prevPlaceholderRef.current) {
                effects.push(StateEffect.reconfigure.of(placeholder ? [viewPlaceholder(placeholder)] : []));
                prevPlaceholderRef.current = placeholder;
            }
            if (effects.length > 0) {
                view.dispatch({ effects });
            }
        }, [readOnly, placeholder]);

        return (
            <div
                ref={editorRef}
                className={cn(
                    'cm-editor-container relative h-full w-full overflow-hidden rounded-md',
                    // Use theme variables for background/border
                    'bg-background/50 border border-border/50',
                    // Refined focus state
                    'focus-within:ring-1 focus-within:ring-ring focus-within:border-primary/80',
                    className
                )}
            />
        );
    }
);

CodeMirrorEditor.displayName = 'CodeMirrorEditor';
export default memo(CodeMirrorEditor);