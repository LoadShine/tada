// src/components/common/CodeMirrorEditor.tsx
import React, { useRef, useEffect, useImperativeHandle } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLineGutter, highlightSpecialChars, drawSelection, dropCursor, rectangularSelection, crosshairCursor, highlightActiveLine, placeholder as viewPlaceholder} from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { bracketMatching, indentOnInput, foldGutter, foldKeymap } from '@codemirror/language';
import { autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { lintKeymap } from '@codemirror/lint';
import { twMerge } from 'tailwind-merge';

// Optional: Define a ref handle type
export interface CodeMirrorEditorRef {
    focus: () => void;
}

interface CodeMirrorEditorProps {
    value: string;
    onChange: (newValue: string) => void;
    className?: string;
    placeholder?: string;
    readOnly?: boolean;
    onBlur?: (event: FocusEvent) => void; // Pass the event
    onFocus?: (event: FocusEvent) => void; // Pass the event
    editorRef?: React.Ref<CodeMirrorEditorRef>; // Allow passing a ref
}

const CodeMirrorEditor = React.forwardRef<HTMLDivElement, CodeMirrorEditorProps>(({
                                                                                      value,
                                                                                      onChange,
                                                                                      className,
                                                                                      placeholder,
                                                                                      readOnly = false,
                                                                                      onBlur,
                                                                                      onFocus,
                                                                                      editorRef: externalEditorRef, // Rename prop to avoid conflict
                                                                                  }, ref) => {
    const internalEditorRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);

    // Combine internal and external refs
    const combinedRef = (el: HTMLDivElement | null) => {
        if (typeof ref === 'function') {
            ref(el);
        } else if (ref) {
            ref.current = el;
        }
        (internalEditorRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
    };

    // Expose focus method via ref
    useImperativeHandle(externalEditorRef, () => ({
        focus: () => {
            viewRef.current?.focus();
        },
    }), []); // Ensure dependencies are correct if viewRef changes need to be tracked

    useEffect(() => {
        if (!internalEditorRef.current) return;

        // Theme and Styling Extensions
        const themeExtensions = EditorView.theme({
            // Apply Tailwind classes directly where possible, or define custom CM classes
            '&': {
                height: '100%', // Ensure editor fills container height
                fontSize: '0.875rem', // text-sm
                lineHeight: '1.5', // Adjust line height for readability
            },
            '.cm-scroller': {
                fontFamily: "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace",
                overflow: 'auto', // Ensure scrollbars appear
            },
            // Add more theme overrides here if needed
        });

        const extensions = [
            lineNumbers(),
            highlightActiveLineGutter(),
            highlightSpecialChars(),
            history(),
            foldGutter({
                markerDOM: (open) => {
                    const marker = document.createElement("span");
                    marker.className = `cm-foldMarker ${open ? 'cm-foldMarker-open' : ''}`;
                    marker.textContent = open ? "⌄" : "›"; // Use chevrons
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
            crosshairCursor(),
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
                addKeymap: true, // Add default markdown keybindings
            }),
            EditorView.lineWrapping,
            themeExtensions, // Apply custom theme/styles
            EditorView.contentAttributes.of({ 'aria-label': 'Markdown editor' }),
            EditorView.updateListener.of((update) => {
                if (update.docChanged) {
                    onChange(update.state.doc.toString());
                }
                if (update.focusChanged) {
                    if (update.view.hasFocus) {
                        onFocus?.(new FocusEvent('focus')); // Synthesize event if needed
                    } else {
                        onBlur?.(new FocusEvent('blur')); // Synthesize event if needed
                    }
                }
            }),
            EditorState.readOnly.of(readOnly),
            ...(placeholder ? [viewPlaceholder(placeholder)] : [])
        ];

        const startState = EditorState.create({
            doc: value,
            extensions: extensions,
        });

        // Destroy previous view if it exists
        if (viewRef.current) {
            viewRef.current.destroy();
        }

        const view = new EditorView({
            state: startState,
            parent: internalEditorRef.current,
        });
        viewRef.current = view;

        return () => {
            view.destroy();
            viewRef.current = null;
        };
        // Include relevant dependencies. onChange, onFocus, onBlur are functions and might cause re-renders if not stable.
        // Consider wrapping them in useCallback in the parent component.
    }, [onChange, readOnly, placeholder, onFocus, onBlur]);

    // Effect to update the editor content when the `value` prop changes from outside
    useEffect(() => {
        if (viewRef.current && value !== viewRef.current.state.doc.toString()) {
            viewRef.current.dispatch({
                changes: { from: 0, to: viewRef.current.state.doc.length, insert: value || '' },
            });
        }
    }, [value]);

    return (
        <div
            ref={combinedRef}
            // Apply base styling here, CM theme handles internal styles
            className={twMerge('cm-editor-container relative h-full w-full', className)}
            // Remove onBlur from the container div, let CM handle it via updateListener
        ></div>
    );
});
CodeMirrorEditor.displayName = 'CodeMirrorEditor';
export default CodeMirrorEditor;