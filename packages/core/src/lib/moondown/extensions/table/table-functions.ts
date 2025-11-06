import {EditorState} from "@codemirror/state";
import {type SyntaxNode} from "@lezer/common";
import {parseNode as parse} from "./table-ast.ts";
import {type ParsedTable} from "./types.ts";

/**
 * Checks if any of the selections within the given EditorState has overlap with
 * the provided range.
 *
 * @param   {EditorState}  state      The state to draw selections from
 * @param   {number}       rangeFrom  The start position of the range
 * @param   {number}       rangeTo    The end position of the range
 *
 * @return  {boolean}                 True if any selection overlaps
 */
export function rangeInSelection (state: EditorState, rangeFrom: number, rangeTo: number): boolean {
    return state.selection.ranges
        .map(range => [ range.from, range.to ])
        .filter(([ from, to ]) => !(to <= rangeFrom || from >= rangeTo))
        .length > 0
}

/**
 * Parses a syntax node of type "Table" into an AST & column alignments ready
 * for a TableEditor instance.
 *
 * @param   {SyntaxNode}   tableNode  The table node
 * @param   {string}       markdown   The full Markdown source to read the
 *                                    contents from
 *
 * @return  {ParsedTable}             The parsed AST.
 */
export function parseNode (tableNode: SyntaxNode, markdown: string): ParsedTable | undefined {
    const ast = parse(tableNode, markdown)
    if (ast.type === 'Table') {
        const tableEditorAst = ast.rows.map(row => row.cells.map(cell => markdown.substring(cell.from, cell.to).trim()))

        if (tableEditorAst.length === 0) {
            throw new Error('Cannot instantiate TableEditor: Table had zero rows.')
        }

        return {
            ast: tableEditorAst,
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            colAlignments: ast.alignment ?? tableEditorAst[0].map(_cell => 'left')
        }
    }
}

/**
 * Extracts any amount of whitespace (\t\s\n\r\f\v, etc.) that occurs before
 * this node.
 *
 * @param   {SyntaxNode}  node      The node to extract whitespace for
 * @param   {string}      markdown  The Markdown source to extract the whitespace
 *
 * @return  {string}                The whitespace string
 */
export function getWhitespaceBeforeNode (node: SyntaxNode, markdown: string): string {
    if (node.prevSibling !== null) {
        const sliceBefore = markdown.substring(node.prevSibling.to, node.from)
        const onlyWhitespace = /(\s*)$/m.exec(sliceBefore) // NOTE the "m" flag
        return onlyWhitespace !== null ? onlyWhitespace[1] : ''
    } else if (node.parent !== null) {
        const sliceBefore = markdown.substring(node.parent.from, node.from)
        const onlyWhitespace = /(\s*)$/m.exec(sliceBefore) // NOTE the "m" flag
        return onlyWhitespace !== null ? onlyWhitespace[1] : ''
    } else {
        return ''
    }
}