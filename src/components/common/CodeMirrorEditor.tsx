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
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { lintKeymap } from '@codemirror/lint';
import { twMerge } from 'tailwind-merge';

const editorTheme = EditorView.theme({
    '&': {
        height: '100%',
        fontSize: '13.5px',
        backgroundColor: 'transparent',
        borderRadius: 'inherit',
    },
    '.cm-scroller': {
        fontFamily: `var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace)`,
        lineHeight: '1.65',
        overflow: 'auto',
        position: 'relative',
        backgroundColor: 'transparent !important',
        height: '100%',
    },
    '.cm-content': {
        padding: '14px 16px',
        caretColor: 'hsl(208, 100%, 50%)',
        backgroundColor: 'transparent !important',
    },
    '.cm-gutters': {
        backgroundColor: 'hsla(220, 40%, 98%, 0.65)',
        borderRight: '1px solid hsla(210, 20%, 85%, 0.4)',
        color: 'hsl(210, 9%, 55%)',
        paddingLeft: '8px',
        paddingRight: '4px',
        fontSize: '11px',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
    },
    '.cm-lineNumbers .cm-gutterElement': {
        minWidth: '24px',
    },
    '.cm-line': {
        padding: '0 4px',
    },
    '.cm-activeLine': {
        backgroundColor: 'hsla(208, 100%, 50%, 0.10)',
    },
    '.cm-activeLineGutter': {
        backgroundColor: 'hsla(208, 100%, 50%, 0.15)',
    },
    '.cm-placeholder': {
        color: 'hsl(210, 9%, 60%)',
        fontStyle: 'italic',
        pointerEvents: 'none',
        padding: '14px 16px',
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
    '.cm-searchMatch': {
        backgroundColor: 'hsla(50, 100%, 50%, 0.35)',
        outline: '1px solid hsla(50, 100%, 50%, 0.5)',
        borderRadius: '2px',
    },
    '.cm-searchMatch-selected': {
        backgroundColor: 'hsla(50, 100%, 50%, 0.55)',
        outline: '1px solid hsla(50, 100%, 40%, 0.8)'
    },
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
                highlightSelectionMatches(),
                keymap.of([
                    ...closeBracketsKeymap,
                    ...defaultKeymap,
                    ...searchKeymap,
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
                // Optimize reconfigure: Reconfigure only if necessary properties change
                const currentReadOnly = view.state.facet(EditorState.readOnly);
                const currentPlaceholder = !!placeholder !== !!view.dom.querySelector('.cm-placeholder');
                // Simplification: Reconfigure if readOnly or placeholder itself changes (instance comparison might be tricky)
                if (currentReadOnly !== readOnly || currentPlaceholder) {
                    view.dispatch({ effects: StateEffect.reconfigure.of(createExtensions()) });
                }
                // Also update state reference
                stateRef.current = view.state;

            } else {
                const startState = EditorState.create({ doc: value, extensions: createExtensions() });
                stateRef.current = startState;
                view = new EditorView({ state: startState, parent: editorRef.current as Element });
                viewRef.current = view;
            }

            return () => {
                if (viewRef.current) {
                    viewRef.current.destroy();
                    viewRef.current = null;
                }
            };
        }, [readOnly, placeholder, onChange, onBlur, value]); // Added value to dependencies to handle external updates correctly in initial setup

        // Effect to handle external value changes more reliably
        useEffect(() => {
            const view = viewRef.current;
            if (view && value !== view.state.doc.toString()) {
                view.dispatch({
                    changes: { from: 0, to: view.state.doc.length, insert: value || '' },
                    // Preserve selection and scroll position if possible
                    selection: view.state.selection,
                    // scrollIntoView: true, // Optional: ensure cursor is visible after update
                    userEvent: "external"
                });
            }
        }, [value]);

        return (
            <div
                ref={editorRef}
                className={twMerge(
                    'cm-editor-container relative h-full w-full overflow-hidden rounded-md',
                    'bg-glass-inset-100 backdrop-blur-lg border border-black/10 shadow-inner',
                    'focus-within:ring-1 focus-within:ring-primary/50 focus-within:border-primary/80',
                    className
                )}
            />
        );
    }
);

CodeMirrorEditor.displayName = 'CodeMirrorEditor';
export default memo(CodeMirrorEditor);