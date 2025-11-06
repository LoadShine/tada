import { type SyntaxNode } from '@lezer/common'
import { parseTableNode } from './parse-table-node.ts'
import { parseChildren } from './parse-children.ts'
import { getWhitespaceBeforeNode } from "./table-functions.ts"
import { markdown } from "@codemirror/lang-markdown"
import { languages } from "@codemirror/language-data"
import { GFM } from "@lezer/markdown"
import { Mark } from "../mark-parser"
import { Underline } from "../underline-parser"
import { Strikethrough } from "../strikethrough-parser"

/**
 * Basic info every ASTNode needs to provide
 */
export interface MDNode {
    /**
     * The node.name property (may differ from the type; significant mainly for
     * generics)
     */
    name: string
    /**
     * The start offset of this node in the original source
     */
    from: number
    /**
     * The end offset of this node in the original source
     */
    to: number
    /**
     * This property contains the whitespace before this node; required to
     * determine appropriate significant whitespace portions for some elements
     * upon converting to HTML.
     */
    whitespaceBefore: string
    /**
     * Can be used to store arbitrary attributes (e.g. Pandoc-style attributes
     * such as {.className})
     */
    attributes?: Record<string, string>
}

/**
 * Represents a single table cell
 */
export interface TableCell extends MDNode {
    type: 'TableCell'
    /**
     * The text content of the cell TODO: Arbitrary children!
     */
    children: ASTNode[]
}

/**
 * Represents a table row.
 */
export interface TableRow extends MDNode {
    type: 'TableRow'
    /**
     * This is set to true if the row is a header.
     */
    isHeaderOrFooter: boolean
    /**
     * A list of cells within this row
     */
    cells: TableCell[]
}

export interface TableHeader extends MDNode {
    type: 'TableHeader'
    /**
     * This is set to true if the row is a header.
     */
    isHeaderOrFooter: boolean
    /**
     * A list of cells within this row
     */
    cells: TableCell[]
}

/**
 * Represents a table element.
 */
export interface Table extends MDNode {
    type: 'Table'
    /**
     * A list of rows of this table
     */
    rows: TableRow[]
    /**
     * A list of column alignments in the table. May be undefined; the default is
     * for all columns to be left-aligned.
     */
    alignment?: Array<'left'|'center'|'right'>
}

/**
 * A generic text node that can represent a string of content. Most nodes
 * contain at least one TextNode as its content (e.g. emphasis).
 */
export interface TextNode extends MDNode {
    type: 'Text'
    /**
     * The string value of the text node.
     */
    value: string
}

/**
 * This generic node represents any Lezer node that has no specific role (or can
 * be handled without additional care). This ensures that new nodes will always
 * end up in the resulting AST, even if we forgot to add the node specifically.
 */
export interface GenericNode extends MDNode {
    type: 'Generic'
    /**
     * Each generic node may have children
     */
    children: ASTNode[]
}

/**
 * Any node that can be part of the AST is an ASTNode.
 */
export type ASTNode = Table | TableCell | TableRow | TextNode | GenericNode

/**
 * Parses a single Lezer style SyntaxNode to an ASTNode.
 *
 * @param   {SyntaxNode}  node      The node to convert
 * @param   {string}      markdown  The Markdown source, required to extract the
 *                                  actual text content of the SyntaxNodes,
 *                                  which isn't stored in the nodes themselves.
 *
 * @return  {ASTNode}               The root node of a Markdown AST
 */
export function parseNode (node: SyntaxNode, markdown: string): ASTNode {
    if (node.name === 'Table') {
        return parseTableNode(node, markdown)
    } else {
        const astNode: GenericNode = {
            type: 'Generic',
            name: node.name,
            from: node.from,
            to: node.to,
            whitespaceBefore: getWhitespaceBeforeNode(node, markdown),
            children: []
        }
        return parseChildren(astNode, node, markdown)
    }
}

// Create a markdown parser with all extensions enabled
const markdownWithExtensions = markdown({
    codeLanguages: languages,
    extensions: [GFM, Mark, Underline, Strikethrough],
    addKeymap: false,
})

export function markdownToAST (markdown: string): ASTNode {
    const { parser } = markdownWithExtensions.language
    const tree = parser.parse(markdown)
    return parseNode(tree.topNode, markdown)
}