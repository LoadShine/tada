// src/components/common/CodeMirrorEditor.tsx
import React, {forwardRef, memo, useEffect, useImperativeHandle, useRef} from 'react';
import {Annotation, EditorState, StateEffect} from '@codemirror/state';
import {
    drawSelection,
    dropCursor,
    EditorView,
    keymap,
    placeholder as viewPlaceholder,
    rectangularSelection
} from '@codemirror/view';
import {defaultKeymap, history, historyKeymap, indentWithTab} from '@codemirror/commands'; // Added insertNewline
import {markdown, markdownLanguage} from '@codemirror/lang-markdown';
import {languages} from '@codemirror/language-data';
import {bracketMatching, foldKeymap, indentOnInput} from '@codemirror/language';
import {autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap} from '@codemirror/autocomplete';
import {highlightSelectionMatches, searchKeymap} from '@codemirror/search';
import {lintKeymap} from '@codemirror/lint';
import {twMerge} from 'tailwind-merge';

const editorTheme = EditorView.theme({
    '&': {height: '100%', fontSize: '13.5px', backgroundColor: 'transparent', borderRadius: 'inherit',},
    '.cm-scroller': {
        fontFamily: `var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace)`,
        lineHeight: '1.65',
        overflow: 'auto !important',
        position: 'relative',
        backgroundColor: 'transparent !important',
        height: '100%',
        outline: 'none',
        boxSizing: 'border-box',
    },
    '.cm-content': {
        padding: '14px 16px',
        caretColor: 'hsl(var(--primary-h), var(--primary-s), var(--primary-l))',
        backgroundColor: 'transparent !important',
        outline: 'none',
        wordBreak: 'break-word',
        boxSizing: 'border-box',
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
    '.cm-lineNumbers .cm-gutterElement': {minWidth: '24px', textAlign: 'right'},
    '.cm-line': {padding: '0 4px'},
    '.cm-activeLine': {backgroundColor: 'hsla(var(--primary-h), var(--primary-s), 50%, 0.10)'},
    '.cm-activeLineGutter': {backgroundColor: 'hsla(var(--primary-h), var(--primary-s), 50%, 0.15)'},
    // Adjust placeholder padding to match content padding
    '.cm-placeholder': {
        color: 'hsl(210, 9%, 60%)',
        fontStyle: 'italic',
        pointerEvents: 'none',
        padding: '14px 16px',
        position: 'absolute',
        top: 0,
        left: 0,
    },
    '.cm-foldGutter .cm-gutterElement': {padding: '0 4px 0 8px', cursor: 'pointer', textAlign: 'center',},
    '.cm-foldMarker': {display: 'inline-block', color: 'hsl(210, 10%, 70%)', '&:hover': {color: 'hsl(210, 10%, 50%)'},},
    '.cm-searchMatch': {
        backgroundColor: 'hsla(50, 100%, 50%, 0.35)',
        outline: '1px solid hsla(50, 100%, 50%, 0.5)',
        borderRadius: '2px',
    },
    '.cm-searchMatch-selected': {
        backgroundColor: 'hsla(50, 100%, 50%, 0.55)',
        outline: '1px solid hsla(50, 100%, 40%, 0.8)'
    },
    '.cm-selectionBackground, ::selection': {backgroundColor: 'hsla(var(--primary-h), var(--primary-s), 50%, 0.25) !important',},
    '.cm-focused': {outline: 'none !important'},
    // Ensure the editor takes up available height within its container
    '&.cm-focused': {outline: 'none !important'},
    '.cm-editor': {height: '100%'}, // Added this line
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
    ({value, onChange, className, placeholder, readOnly = false, onBlur,}, ref) => {
        const editorRef = useRef<HTMLDivElement>(null);
        const viewRef = useRef<EditorView | null>(null);
        const onChangeRef = useRef(onChange);
        const onBlurRef = useRef(onBlur);
        const prevReadOnlyRef = useRef(readOnly);
        const prevPlaceholderRef = useRef(placeholder);

        useEffect(() => {
            onChangeRef.current = onChange;
        }, [onChange]);
        useEffect(() => {
            onBlurRef.current = onBlur;
        }, [onBlur]);

        useImperativeHandle(ref, () => ({
            focus: () => {
                viewRef.current?.focus();
            },
            getView: () => viewRef.current,
        }), []);

        // Effect for Editor Setup and Teardown
        useEffect(() => {
            if (!editorRef.current) return;

            const createExtensions = (currentPlaceholder?: string, currentReadOnly?: boolean) => [
                history(), drawSelection(), dropCursor(), EditorState.allowMultipleSelections.of(true), indentOnInput(),
                bracketMatching(), closeBrackets(), autocompletion(), rectangularSelection(), highlightSelectionMatches(),
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
                markdown({base: markdownLanguage, codeLanguages: languages, addKeymap: true}),
                EditorView.lineWrapping,
                EditorView.contentAttributes.of({'aria-label': 'Markdown editor content'}),
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
                editorTheme,
            ];

            const startState = EditorState.create({
                doc: value,
                extensions: createExtensions(placeholder, readOnly)
            });

            const view = new EditorView({
                state: startState,
                parent: editorRef.current,
            });
            viewRef.current = view;

            prevReadOnlyRef.current = readOnly;
            prevPlaceholderRef.current = placeholder;

            return () => {
                view.destroy();
                viewRef.current = null;
            };
        }, []);

        useEffect(() => { 
            const view = viewRef.current;
            if (view && value !== view.state.doc.toString()) {
                view.dispatch({
                    changes: {from: 0, to: view.state.doc.length, insert: value || ''},
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
                view.dispatch({effects});
            }
        }, [readOnly, placeholder]);


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