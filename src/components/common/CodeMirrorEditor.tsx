// src/components/common/CodeMirrorEditor.tsx
import React, { useRef, useEffect } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLineGutter, highlightSpecialChars, drawSelection, dropCursor, rectangularSelection, highlightActiveLine, placeholder as viewPlaceholder} from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { bracketMatching, indentOnInput, foldGutter, foldKeymap } from '@codemirror/language';
import { autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { lintKeymap } from '@codemirror/lint';
import { twMerge } from 'tailwind-merge';

// Simple theme extension for basic styling override
const editorTheme = EditorView.theme({
    '&': {
        // height: '100%', // Ensure the editor itself tries to fill the container
        // backgroundColor: 'var(--color-canvas-inset)', // Match background
        borderRadius: 'inherit', // Inherit border radius from parent
    },
    '.cm-scroller': {
        // fontFamily: // Defined in index.css
        // overflow: 'auto', // Ensure scroll is handled
    },
    '.cm-content': {
        // padding: '8px', // Padding inside content area
        // caretColor: // Defined in index.css
    },
    '.cm-gutters': {
        // backgroundColor: // Defined in index.css
        // borderRight: // Defined in index.css
        // borderRadius: 'inherit', // Doesn't work well here, handle parent
    },
    '.cm-line': {
        // lineHeight: // Defined in index.css
    }
    // Add more specific selectors if needed
});


interface CodeMirrorEditorProps {
    value: string;
    onChange: (newValue: string) => void;
    className?: string; // Class for the container div
    placeholder?: string;
    readOnly?: boolean;
    onBlur?: () => void;
}

const CodeMirrorEditor: React.FC<CodeMirrorEditorProps> = ({
                                                               value,
                                                               onChange,
                                                               className,
                                                               placeholder,
                                                               readOnly = false,
                                                               onBlur,
                                                           }) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);

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
                    // Simple text arrows, could use SVG icons
                    marker.textContent = open ? "⌄" : "›";
                    marker.style.cursor = 'pointer';
                    marker.style.marginLeft = '4px';
                    marker.style.color = 'hsl(210, 10%, 65%)'; // muted color
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
            // crosshairCursor(), // Can be distracting
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
            view.dispatch({
                changes: { from: 0, to: view.state.doc.length, insert: value || '' },
                // selection: { anchor: view.state.doc.length } // Optionally move cursor to end
            });
        }
    }, [value]);

    // Container div handles focus ring and overall structure
    return <div
        ref={editorRef}
        className={twMerge(
            'cm-editor-container relative h-full w-full overflow-hidden rounded-md border border-gray-200/80 bg-canvas-inset',
            'focus-within:border-primary/80 focus-within:ring-1 focus-within:ring-primary/50', // Focus ring on the container
            className
        )}
        // Removed onBlur from here as it's handled by updateListener now
    ></div>;
};

export default CodeMirrorEditor;