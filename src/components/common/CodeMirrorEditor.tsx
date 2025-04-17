// src/components/common/CodeMirrorEditor.tsx
import { useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLineGutter, highlightSpecialChars, drawSelection, dropCursor, rectangularSelection, highlightActiveLine, placeholder as viewPlaceholder } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { bracketMatching, indentOnInput, foldGutter, foldKeymap } from '@codemirror/language';
import { autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { lintKeymap } from '@codemirror/lint';
import { twMerge } from 'tailwind-merge';

// Theme extension for adjustments
const editorTheme = EditorView.theme({
    '&': {
        height: '100%', // Ensure the editor itself tries to fill the container
        borderRadius: 'inherit', // Inherit border radius from parent
        backgroundColor: 'transparent', // Make CM background transparent
    },
    '.cm-scroller': {
        // fontFamily defined via Tailwind in index.css
        overflow: 'auto', // Ensure scroll is handled by scroller
    },
    '.cm-content': {
        // padding defined in index.css
        // caretColor defined in index.css
    },
    '.cm-gutters': {
        // backgroundColor, borderRight, color, text-xs defined in index.css
    },
    '.cm-line': {
        // lineHeight, px defined in index.css
    },
    '.cm-activeLine': {
        // backgroundColor defined in index.css
    }
});

interface CodeMirrorEditorProps {
    value: string;
    onChange: (newValue: string) => void;
    className?: string; // Class for the container div
    placeholder?: string;
    readOnly?: boolean;
    onBlur?: () => void;
}

// Define the type for the ref handle
export interface CodeMirrorEditorRef {
    focus: () => void;
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

        // Expose focus method via ref
        useImperativeHandle(ref, () => ({
            focus: () => {
                viewRef.current?.focus();
            }
        }));

        useEffect(() => {
            if (!editorRef.current) return;

            const extensions = [
                lineNumbers(),
                highlightActiveLineGutter(),
                highlightSpecialChars(),
                history(),
                foldGutter({
                    markerDOM: (open) => {
                        const marker = document.createElement("span");
                        marker.className = `cm-foldMarker ${open ? 'cm-foldMarker-open' : 'cm-foldMarker-folded'}`;
                        marker.textContent = open ? "⌄" : "›"; // Use standard arrows
                        // Styles applied via CSS in index.css
                        return marker;
                    }
                }),
                drawSelection(),
                dropCursor(),
                EditorState.allowMultipleSelections.of(true),
                indentOnInput(),
                bracketMatching(),
                closeBrackets(),
                autocompletion(),
                rectangularSelection(),
                highlightActiveLine(),
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
                markdown({
                    base: markdownLanguage,
                    codeLanguages: languages,
                    addKeymap: true,
                }),
                EditorView.lineWrapping,
                EditorView.contentAttributes.of({ 'aria-label': 'Markdown editor' }),
                EditorView.updateListener.of((update) => {
                    if (update.docChanged) {
                        onChange(update.state.doc.toString());
                    }
                    if (update.focusChanged && !update.view.hasFocus && onBlur) {
                        onBlur(); // Trigger external onBlur when editor loses focus
                    }
                }),
                EditorState.readOnly.of(readOnly),
                ...(placeholder ? [viewPlaceholder(placeholder)] : []),
                editorTheme, // Apply our custom theme adjustments
            ];

            const startState = EditorState.create({
                doc: value,
                extensions: extensions,
            });

            const view = new EditorView({
                state: startState,
                parent: editorRef.current,
            });
            viewRef.current = view;

            return () => {
                view.destroy();
                viewRef.current = null;
            };
            // Re-initialize only if essential props change that require full rebuild
        }, [onChange, readOnly, placeholder, onBlur]); // Added onBlur dependency

        // Effect to update the editor content when the `value` prop changes from outside
        useEffect(() => {
            const view = viewRef.current;
            if (view && value !== view.state.doc.toString()) {
                // Only update if the document actually changed externally
                const currentDoc = view.state.doc.toString();
                if (value !== currentDoc) {
                    view.dispatch({
                        changes: { from: 0, to: view.state.doc.length, insert: value || '' },
                        // Avoid moving cursor if user might be editing
                        // selection: { anchor: view.state.doc.length }
                    });
                }
            }
        }, [value]);

        // Container div handles focus ring, background, and overall structure
        return (
            <div
                ref={editorRef}
                className={twMerge(
                    'cm-editor-container relative h-full w-full overflow-hidden',
                    'border border-border-color/60 bg-canvas-inset', // Apply base bg and border
                    'focus-within:border-primary/80 focus-within:ring-1 focus-within:ring-primary/50', // Focus ring on the container
                    className // Allow overrides like removing border/bg
                )}
            ></div>
        );
    }
);

CodeMirrorEditor.displayName = 'CodeMirrorEditor';
export default CodeMirrorEditor;