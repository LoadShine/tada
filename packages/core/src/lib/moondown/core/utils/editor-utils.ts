
import { EditorState, type ChangeSpec } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { SELECTION } from "../constants";

/**
 * Utility functions for editor operations
 */

// Re-export for convenience
export { SELECTION };

/**
 * Gets the current line at the cursor position
 * @param state - Editor state
 * @returns The line object at cursor position
 */
export function getCurrentLine(state: EditorState) {
  const { from } = state.selection.main;
  return state.doc.lineAt(from);
}

/**
 * Gets all lines in a selection range
 * @param state - Editor state
 * @param from - Start position
 * @param to - End position
 * @returns Array of line objects
 */
export function getLinesInRange(state: EditorState, from: number, to: number) {
  const lines = [];
  let pos = from;
  
  while (pos <= to) {
    const line = state.doc.lineAt(pos);
    lines.push(line);
    
    if (line.to + 1 > to) break;
    pos = line.to + 1;
  }
  
  return lines;
}

/**
 * Applies changes to the editor
 * @param view - Editor view
 * @param changes - Array of change specifications
 */
export function applyChanges(view: EditorView, changes: ChangeSpec[]) {
  if (changes.length === 0) return;
  
  view.dispatch({ changes });
}

/**
 * Gets text in a range with extra context around it
 * @param state - Editor state
 * @param from - Start position
 * @param to - End position
 * @param contextLength - Number of extra characters to include on each side
 * @returns Object with text, start position, and end position
 */
export function getTextWithContext(
  state: EditorState,
  from: number,
  to: number,
  contextLength: number
) {
  const start = Math.max(0, from - contextLength);
  const end = Math.min(state.doc.length, to + contextLength);
  
  return {
    text: state.doc.sliceString(start, end),
    start,
    end,
  };
}

/**
 * Checks if the current selection is empty (cursor position)
 * @param state - Editor state
 * @returns True if selection is empty
 */
export function isSelectionEmpty(state: EditorState): boolean {
  const { from, to } = state.selection.main;
  return from === to;
}

/**
 * Gets the selected text
 * @param state - Editor state
 * @returns Selected text or empty string
 */
export function getSelectedText(state: EditorState): string {
  const { from, to } = state.selection.main;
  return state.doc.sliceString(from, to);
}

/**
 * Replaces the current selection with text
 * @param view - Editor view
 * @param text - Text to insert
 * @param selectInserted - Whether to select the inserted text
 */
export function replaceSelection(
  view: EditorView,
  text: string,
  selectInserted: boolean = false
) {
  const { from, to } = view.state.selection.main;
  
  const changes = { from, to, insert: text };
  const newCursorPos = from + text.length;
  
  view.dispatch({
    changes,
    selection: selectInserted
      ? { anchor: from, head: newCursorPos }
      : { anchor: newCursorPos },
  });
}

/**
 * Inserts text at a specific position
 * @param view - Editor view
 * @param pos - Position to insert at
 * @param text - Text to insert
 */
export function insertAt(view: EditorView, pos: number, text: string) {
  view.dispatch({
    changes: { from: pos, insert: text },
  });
}

/**
 * Gets coordinates for a position in the editor
 * @param view - Editor view
 * @param pos - Position to get coordinates for
 * @returns Coordinates or null if position is invalid
 */
export function getCoordsAtPos(view: EditorView, pos: number) {
  return view.coordsAtPos(pos);
}

/**
 * Gets position from coordinates
 * @param view - Editor view
 * @param x - X coordinate
 * @param y - Y coordinate
 * @returns Position or null if coordinates are invalid
 */
export function getPosAtCoords(view: EditorView, x: number, y: number) {
  return view.posAtCoords({ x, y });
}
