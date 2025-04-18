// src/components/common/CodeMirrorEditor.tsx
// @ts-expect-error - Explicit React import
import React, { useRef, useEffect, useImperativeHandle, forwardRef, memo } from 'react';
import { EditorState, StateEffect } from '@codemirror/state';
import { EditorView, keymap, drawSelection, dropCursor, rectangularSelection, placeholder as viewPlaceholder } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { bracketMatching, indentOnInput, foldKeymap } from '@codemirror/language';
import { autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search'; // Added highlightSelectionMatches
import { lintKeymap } from '@codemirror/lint';
import { twMerge } from 'tailwind-merge';

// Enhanced theme with strong glass effect integration for gutters
const editorTheme = EditorView.theme({
    '&': {
        height: '100%',
        fontSize: '13.5px', // Consistent font size
        backgroundColor: 'transparent', // CM background MUST be transparent
        borderRadius: 'inherit', // Inherit rounding from container
    },
    '.cm-scroller': {
        fontFamily: `var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace)`,
        lineHeight: '1.65', // Improved line spacing
        overflow: 'auto',
        position: 'relative',
        backgroundColor: 'transparent !important', // Ensure scroller is transparent
        height: '100%', // Ensure scroller takes full height
    },
    '.cm-content': {
        padding: '14px 16px', // Slightly more padding
        caretColor: 'hsl(208, 100%, 50%)',
        backgroundColor: 'transparent !important', // Ensure content area is transparent
    },
    // Gutters styled for stronger glassmorphism
    '.cm-gutters': {
        backgroundColor: 'hsla(220, 40%, 98%, 0.65)', // Match alt glass more closely, slightly less transparent
        borderRight: '1px solid hsla(210, 20%, 85%, 0.4)', // Softer, semi-transparent border
        color: 'hsl(210, 9%, 55%)',
        paddingLeft: '8px',
        paddingRight: '4px',
        fontSize: '11px',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        backdropFilter: 'blur(10px)', // Apply blur to gutters
        WebkitBackdropFilter: 'blur(10px)',
    },
    '.cm-lineNumbers .cm-gutterElement': {
        minWidth: '24px', // Adjusted width
    },
    '.cm-line': {
        padding: '0 4px', // Minimal horizontal padding per line
    },
    '.cm-activeLine': {
        backgroundColor: 'hsla(208, 100%, 50%, 0.10)', // Slightly more visible active line on glass
    },
    '.cm-activeLineGutter': {
        backgroundColor: 'hsla(208, 100%, 50%, 0.15)', // Slightly more visible gutter highlight on glass
    },
    '.cm-placeholder': {
        color: 'hsl(210, 9%, 60%)',
        fontStyle: 'italic',
        pointerEvents: 'none',
        padding: '14px 16px', // Match content padding
        position: 'absolute',
        top: 0,
        left: 0,
    },
    '.cm-foldGutter .cm-gutterElement': {
        padding: '0 4px 0 8px',
        cursor: 'pointer',
        textAlign: 'center',
    },
    '.cm-foldMarker': {
        display: 'inline-block',
        color: 'hsl(210, 10%, 70%)',
        '&:hover': {
            color: 'hsl(210, 10%, 50%)',
        },
    },
    // Search match highlighting
    '.cm-searchMatch': {
        backgroundColor: 'hsla(50, 100%, 50%, 0.35)', // Yellowish highlight
        outline: '1px solid hsla(50, 100%, 50%, 0.5)',
        borderRadius: '2px',
    },
    '.cm-searchMatch-selected': {
        backgroundColor: 'hsla(50, 100%, 50%, 0.55)', // Darker selected match
        outline: '1px solid hsla(50, 100%, 40%, 0.8)'
    },
    // Selection needs to be visible on glass
    '.cm-selectionBackground, ::selection': {
        backgroundColor: 'hsla(208, 100%, 50%, 0.25) !important',
    },
});

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
    ({
         value,
         onChange,
         className,
         placeholder,
         readOnly = false,
         onBlur,
     }, ref) => {
        const editorRef = useRef<HTMLDivElement>(null);
        const viewRef = useRef<EditorView | null>(null);
        const stateRef = useRef<EditorState | null>(null);

        useImperativeHandle(ref, () => ({
            focus: () => { viewRef.current?.focus(); },
            getView: () => viewRef.current,
        }), []);

        useEffect(() => {
            if (!editorRef.current) return;

            const createExtensions = () => [
                history(),
                drawSelection(),
                dropCursor(),
                EditorState.allowMultipleSelections.of(true),
                indentOnInput(),
                bracketMatching(),
                closeBrackets(),
                autocompletion(),
                rectangularSelection(),
                highlightSelectionMatches(), // Add search match highlighting
                keymap.of([
                    ...closeBracketsKeymap,
                    ...defaultKeymap,
                    ...searchKeymap, // Include search keys (like Ctrl/Cmd+F)
                    ...historyKeymap,
                    ...foldKeymap,
                    ...completionKeymap,
                    ...lintKeymap,
                    indentWithTab,
                ]),
                markdown({ base: markdownLanguage, codeLanguages: languages, addKeymap: true }),
                EditorView.lineWrapping,
                EditorView.contentAttributes.of({ 'aria-label': 'Markdown editor' }),
                EditorView.updateListener.of((update) => {
                    if (update.state) { stateRef.current = update.state; }
                    if (update.docChanged) { onChange(update.state.doc.toString()); }
                    if (update.focusChanged && !update.view.hasFocus && onBlur) { onBlur(); }
                }),
                EditorState.readOnly.of(readOnly),
                ...(placeholder ? [viewPlaceholder(placeholder)] : []),
                editorTheme,
            ];

            let view = viewRef.current;

            if (view) {
                // Optimize reconfigure: only reconfigure if absolutely necessary (e.g., readOnly changes)
                const currentReadOnly = view.state.facet(EditorState.readOnly);
                if (currentReadOnly !== readOnly) {
                    view.dispatch({ effects: StateEffect.reconfigure.of(createExtensions()) });
                }
                // Placeholder might also need reconfiguration if it changes
                // This simple approach reconfigures on any prop change, which is okay for this use case
                view.dispatch({ effects: StateEffect.reconfigure.of(createExtensions()) });
                stateRef.current = view.state;

            } else {
                const startState = EditorState.create({ doc: value, extensions: createExtensions() });
                stateRef.current = startState;
                view = new EditorView({ state: startState, parent: editorRef.current as Element });
                viewRef.current = view;
            }

            // Cleanup on unmount
            return () => {
                if (viewRef.current) {
                    viewRef.current.destroy();
                    viewRef.current = null;
                }
            };
            // Dependencies for extension recreation
        }, [readOnly, placeholder, onChange, onBlur]); // eslint-disable-line react-hooks/exhaustive-deps

        // Effect to handle external value changes
        useEffect(() => {
            const view = viewRef.current;
            if (view && value !== view.state.doc.toString()) {
                view.dispatch({
                    changes: { from: 0, to: view.state.doc.length, insert: value || '' },
                    selection: view.state.selection, // Preserve selection if possible
                    userEvent: "external" // Mark as external change
                });
            }
        }, [value]); // Only depends on external value

        return (
            // Container div defines the glass background and blur
            <div
                ref={editorRef}
                className={twMerge(
                    'cm-editor-container relative h-full w-full overflow-hidden rounded-md', // Base structure
                    // Apply desired glass effect to the container
                    'bg-glass-inset-100 backdrop-blur-lg border border-black/10 shadow-inner', // Default inset glass
                    'focus-within:ring-1 focus-within:ring-primary/50 focus-within:border-primary/80', // Focus state on container
                    className // Allow overrides
                )}
            />
        );
    }
);

CodeMirrorEditor.displayName = 'CodeMirrorEditor';
export default memo(CodeMirrorEditor); // Memoize for performance