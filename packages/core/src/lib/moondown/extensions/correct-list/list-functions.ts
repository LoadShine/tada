import { EditorView } from "@codemirror/view";
import { EditorState } from "@codemirror/state";

interface ListLevel {
    indent: number;
    number: number;
    type: 'ordered' | 'unordered';
}

export function updateLists(view: EditorView) {
    const { state } = view;
    const doc = state.doc;
    const lines = doc.toString().split('\n');
    const changes = [];

    let listStack: ListLevel[] = [];

    for (let lineNumber = 0; lineNumber < lines.length; lineNumber++) {
        const line = lines[lineNumber];
        const lineStart = doc.line(lineNumber + 1).from;

        const orderedMatch = line.match(/^(\s*)(\d+(?:\.\d+)*)\.\s/);
        const unorderedMatch = line.match(/^(\s*)([-*+])\s/);

        if (orderedMatch || unorderedMatch) {
            const indentation = (orderedMatch || unorderedMatch)![1];
            const currentIndent = indentation.length;
            const isOrdered = !!orderedMatch;
            const currentType = isOrdered ? 'ordered' : 'unordered';

            // 1. Pop levels from stack that are deeper than current indent
            while (listStack.length > 0 && listStack[listStack.length - 1].indent > currentIndent) {
                listStack.pop();
            }

            const topLevel = listStack.length > 0 ? listStack[listStack.length - 1] : null;

            if (topLevel && topLevel.indent === currentIndent && topLevel.type === currentType) {
                // 2. Same level and same type: increment number
                topLevel.number++;
            } else {
                // 3. New level (deeper indent) or type switch at same indent
                if (topLevel && topLevel.indent === currentIndent) {
                    // Type switch, replace the top level
                    listStack.pop();
                }
                listStack.push({
                    indent: currentIndent,
                    number: 1,
                    type: currentType,
                });
            }

            if (isOrdered) {
                // 4. Construct the new multi-level number string
                const newNumber = listStack
                    .filter(level => level.type === 'ordered')
                    .map(level => level.number)
                    .join('.');

                const currentNumber = orderedMatch![2];
                if (currentNumber !== newNumber) {
                    const numberStart = lineStart + indentation.length;
                    const numberEnd = numberStart + currentNumber.length;
                    changes.push({
                        from: numberStart,
                        to: numberEnd,
                        insert: newNumber,
                    });
                }
            }
        } else if (line.trim().length > 0) {
            // Non-list content line, reset the stack
            listStack = [];
        }
        // Empty lines do not reset the stack, allowing for space between list items.
    }

    if (changes.length > 0) {
        view.dispatch({ changes });
    }
}

export function getListInfo(state: EditorState, pos: number) {
    const line = state.doc.lineAt(pos);
    const lineText = line.text;

    // Check for ordered list
    const orderedMatch = lineText.match(/^(\s*)(\d+(?:\.\d+)*)\.\s/);
    if (orderedMatch) {
        return {
            type: 'ordered' as const,
            indent: orderedMatch[1].length,
            marker: orderedMatch[2] + '.',
            content: lineText.slice(orderedMatch[0].length),
            markerEnd: line.from + orderedMatch[0].length
        };
    }

    // Check for unordered list
    const unorderedMatch = lineText.match(/^(\s*)([-*+])\s/);
    if (unorderedMatch) {
        return {
            type: 'unordered' as const,
            indent: unorderedMatch[1].length,
            marker: unorderedMatch[2],
            content: lineText.slice(unorderedMatch[0].length),
            markerEnd: line.from + unorderedMatch[0].length
        };
    }

    return null;
}

export function generateListItem(type: 'ordered' | 'unordered', indent: number, number?: string): string {
    const indentation = ' '.repeat(indent);
    if (type === 'ordered') {
        return `${indentation}${number || '1'}. `;
    } else {
        const markers = ['-', '*', '+'];
        const markerIndex = Math.floor(indent / 2) % markers.length;
        return `${indentation}${markers[markerIndex]} `;
    }
}