
/**
 * Table node parser for markdown table AST conversion
 *
 * This module provides functionality to parse Lezer SyntaxNodes representing
 * markdown tables into a structured AST (Abstract Syntax Tree) format. It handles
 * both pipe tables and grid tables, extracting cell contents, determining column
 * alignments, and organizing table structure for further processing.
 *
 * Key features:
 * - Extracts table header and row data from syntax nodes
 * - Determines column alignment from delimiter rows
 * - Handles empty cells and table delimiters
 * - Creates structured AST representation with position information
 */
import {type SyntaxNode} from '@lezer/common'
import type {Table, TableRow, TableCell} from './table-ast.ts'
import {genericTextNode} from './generic-text-node.ts'
import {getWhitespaceBeforeNode} from "./table-functions.ts";
import {parseChildren} from "./parse-children.ts";

/**
 * Parses a SyntaxNode of name "Table"
 *
 * @param   {SyntaxNode}  node      The node to parse
 * @param   {string}      markdown  The original Markdown source
 *
 * @return  {Table}                 The parsed Table AST node
 */
export function parseTableNode(node: SyntaxNode, markdown: string): Table {
    const astNode: Table = {
        type: 'Table',
        name: 'Table',
        from: node.from,
        to: node.to,
        whitespaceBefore: getWhitespaceBeforeNode(node, markdown),
        rows: []
    }

    const header = node.getChildren('TableHeader')
    const rows = node.getChildren('TableRow')

    // The parser cannot reliably extract the table delimiters, but we need
    // those for the column alignment. Thus, we need to see if we can find the
    // header row (pipe tables) or a delimiter row (grid tables) in order to
    // determine the column alignments.
    for (const line of markdown.substring(node.from, node.to).split('\n')) {
        if (!/^[|+:-]+$/.test(line)) {
            continue
        }

        // The plus indicates a special Pandoc-type of pipe table
        const splitter = line.includes('+') ? '+' : '|'
        astNode.alignment = line.split(splitter)
            // NOTE: |-|-| will result in ['', '-', '-', ''] -> filter out
            .filter(c => c.length > 0)
            .map(c => {
                if (c.startsWith('|')) {
                    c = c.substring(1)
                }
                if (c.endsWith('|')) {
                    c = c.substring(0, c.length - 1)
                }
                if (c.startsWith(':') && c.endsWith(':')) {
                    return 'center'
                } else if (c.endsWith(':')) {
                    return 'right'
                } else {
                    return 'left'
                }
            })
        break
    } // Else: Couldn't determine either column alignment nor table type

    // Now, transform the rows.
    for (const row of [...header, ...rows]) {
        const rowNode: TableRow = {
            type: 'TableRow',
            name: row.name,
            from: row.from,
            to: row.to,
            whitespaceBefore: '',
            isHeaderOrFooter: row.name === 'TableHeader',
            cells: []
        }

        let next = row.firstChild
        let lastDelimPos = -1 // Track the position of the last delimiter
        while (next !== null) {
            if (next.name === 'TableDelimiter') {
                if (lastDelimPos !== -1) {
                    // Create an empty cell for each delimiter we encounter after the first
                    const cellNode: TableCell = {
                        type: 'TableCell',
                        name: 'TableCell',
                        from: lastDelimPos,
                        to: next.from,
                        whitespaceBefore: '',
                        children: [
                            genericTextNode(lastDelimPos, next.from, markdown.slice(lastDelimPos, next.from))
                        ]
                    }
                    rowNode.cells.push(cellNode)
                }
                lastDelimPos = next.to
            } else if (next.name === 'TableCell') {
                // Reset lastDelimPos as we've encountered a non-empty cell
                lastDelimPos = -1
                const cellNode: TableCell = {
                    type: 'TableCell',
                    name: 'TableCell',
                    from: next.from,
                    to: next.to,
                    whitespaceBefore: '',
                    children: []
                }
                parseChildren(cellNode, next, markdown)
                rowNode.cells.push(cellNode)
            } else {
                console.warn(`Could not fully parse Table node: Unexpected node "${next.name}" in row.`)
            }
            next = next.nextSibling
        }

        // Handle case where the row ends with empty cells
        if (lastDelimPos !== -1 && row.to > lastDelimPos) {
            const cellNode: TableCell = {
                type: 'TableCell',
                name: 'TableCell',
                from: lastDelimPos,
                to: row.to,
                whitespaceBefore: '',
                children: [
                    genericTextNode(lastDelimPos, row.to, markdown.slice(lastDelimPos, row.to))
                ]
            }
            rowNode.cells.push(cellNode)
        }

        astNode.rows.push(rowNode)
    }
    return astNode
}