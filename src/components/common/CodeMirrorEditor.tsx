// src/components/common/CodeMirrorEditor.tsx
import { useRef, useEffect, useImperativeHandle, forwardRef, memo } from 'react';
import {EditorState, StateEffect} from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLineGutter, highlightSpecialChars, drawSelection, dropCursor, rectangularSelection, highlightActiveLine, placeholder as viewPlaceholder } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { bracketMatching, indentOnInput, foldGutter, foldKeymap } from '@codemirror/language';
import { autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { lintKeymap } from '@codemirror/lint';
import { twMerge } from 'tailwind-merge';

// Minimalist theme adjustments integrated with Tailwind styles applied externally
const editorTheme = EditorView.theme({
    '&': {
        height: '100%',
        fontSize: '13px', // Slightly smaller font size for editor
        backgroundColor: 'transparent', // Ensure CM background doesn't override container
        borderRadius: 'inherit', // Inherit rounding
    },
    '.cm-scroller': {
        fontFamily: `var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace)`, // Use CSS var or fallback
        lineHeight: '1.6', // Generous line height for readability
        overflow: 'auto',
        position: 'relative', // Needed for placeholder absolute positioning
    },
    '.cm-content': {
        padding: '10px 12px', // Consistent padding (matches TaskDetail p-4 roughly)
        caretColor: 'hsl(208, 100%, 50%)', // Primary color caret
    },
    '.cm-gutters': {
        backgroundColor: 'hsla(220, 30%, 96%, 0.5)', // Very light, slightly transparent gutter bg
        borderRight: '1px solid hsl(210, 20%, 90%)', // Subtle border
        color: 'hsl(210, 9%, 65%)', // Muted text color
        paddingLeft: '8px',
        paddingRight: '4px',
        fontSize: '11px',
        userSelect: 'none',
        WebkitUserSelect: 'none', // Safari
    },
    '.cm-lineNumbers .cm-gutterElement': {
        minWidth: '20px', // Ensure enough space for line numbers
    },
    '.cm-line': {
        padding: '0 4px', // Minimal horizontal padding within lines
    },
    '.cm-activeLine': {
        backgroundColor: 'hsla(208, 100%, 50%, 0.05)', // Very subtle primary active line
    },
    '.cm-activeLineGutter': {
        backgroundColor: 'hsla(208, 100%, 50%, 0.08)', // Slightly more visible gutter highlight
    },
    '.cm-placeholder': {
        color: 'hsl(210, 9%, 65%)', // Muted placeholder color
        fontStyle: 'italic',
        pointerEvents: 'none',
        padding: '10px 12px', // Match content padding
        position: 'absolute', // Position correctly within scroller
        top: 0,
        left: 0,
    },
    '.cm-foldGutter .cm-gutterElement': {
        padding: '0 4px 0 8px', // Adjust padding for fold arrows
        cursor: 'pointer',
        textAlign: 'center',
    },
    '.cm-foldMarker': { // Custom fold marker style
        display: 'inline-block',
        color: 'hsl(210, 10%, 70%)',
        '&:hover': {
            color: 'hsl(210, 10%, 50%)',
        },
    },
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
        const stateRef = useRef<EditorState | null>(null); // Keep track of state

        // Expose focus and view instance via ref
        useImperativeHandle(ref, () => ({
            focus: () => {
                viewRef.current?.focus();
            },
            getView: () => viewRef.current,
        }));

        // Effect for Initialization and Cleanup
        useEffect(() => {
            if (!editorRef.current) return;

            const extensions = [
                lineNumbers(),
                highlightActiveLineGutter(),
                highlightSpecialChars(),
                history(),
                foldGutter({
                    markerDOM: (open) => { // Simple text markers
                        const marker = document.createElement("span");
                        marker.className = "cm-foldMarker";
                        marker.textContent = open ? "⌄" : "›";
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
                    // Update internal state ref first
                    if (update.state) {
                        stateRef.current = update.state;
                    }
                    // Notify parent of document changes
                    if (update.docChanged) {
                        onChange(update.state.doc.toString());
                    }
                    // Handle blur event
                    if (update.focusChanged && !update.view.hasFocus && onBlur) {
                        onBlur();
                    }
                }),
                EditorState.readOnly.of(readOnly),
                ...(placeholder ? [viewPlaceholder(placeholder)] : []),
                editorTheme, // Apply our custom theme adjustments
            ];

            // Create initial state only once or if critical props change
            if (!stateRef.current) {
                stateRef.current = EditorState.create({
                    doc: value,
                    extensions: extensions,
                });
            }

            const view = new EditorView({
                state: stateRef.current,
                parent: editorRef.current,
            });
            viewRef.current = view;

            // Cleanup function
            return () => {
                view.destroy();
                viewRef.current = null;
                // Optionally reset stateRef if component might remount with different config
                // stateRef.current = null;
            };
            // Re-run effect only if props affecting extensions change significantly
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [readOnly, placeholder]); // onChange and onBlur are handled by listeners

        // Effect to update the editor content ONLY when the `value` prop changes externally
        useEffect(() => {
            const view = viewRef.current;
            const currentState = stateRef.current;

            if (view && currentState && value !== currentState.doc.toString()) {
                // Check again to prevent race conditions if internal state updated quickly
                if (value !== view.state.doc.toString()){
                    view.dispatch({
                        changes: { from: 0, to: view.state.doc.length, insert: value || '' },
                        // Optionally preserve selection or move cursor to end
                        // selection: view.state.selection,
                        // selection: { anchor: view.state.doc.length } // Move cursor to end
                    });
                }
            }
        }, [value]); // Only depend on the external value prop

        // Effect to update readOnly state dynamically
        useEffect(() => {
            const view = viewRef.current;
            if (view) {
                view.dispatch({
                    effects: StateEffect.reconfigure.of(EditorState.readOnly.of(readOnly))
                });
            }
        }, [readOnly]);


        // Container div handles focus ring, background, and overall structure
        // Removed internal border/bg, rely on external styling or props
        return (
            <div
                ref={editorRef}
                className={twMerge(
                    'cm-editor-container relative h-full w-full overflow-hidden', // Base structure
                    // Apply focus styles to the container for a clear boundary
                    'focus-within:ring-1 focus-within:ring-primary/50 focus-within:border-primary/80 border border-transparent', // Transparent border initially
                    className // Allow overrides like adding border/bg externally
                )}
            />
        );
    }
);

CodeMirrorEditor.displayName = 'CodeMirrorEditor';
// Memoize to prevent unnecessary re-renders if props haven't changed shallowly
export default memo(CodeMirrorEditor);