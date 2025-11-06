import { markdownToAST } from './table-ast.ts'
import { type ASTNode, type GenericNode } from './table-ast.ts'

/**
 * Represents an HTML tag. This is a purposefully shallow representation
 */
interface HTMLTag {
    /**
     * The tag name for the resulting HTML tag
     */
    tagName: string
    /**
     * Self closing are, e.g., <hr>
     */
    selfClosing: boolean
    /**
     * A simple map of attributes (e.g., ['class', 'my-class'])
     */
    attributes: Array<[ string, string ]>
}

/**
 * This function looks at a GenericNode and returns information regarding the
 * tag that the node should result in.
 *
 * @param   {GenericNode}  node  The input node
 *
 * @return  {HTMLTag}            The HTML tag information
 */
function getTagInfo (node: GenericNode): HTMLTag {
    const ret: HTMLTag = {
        tagName: 'div',
        selfClosing: false,
        attributes: []
    }

    if (node.name === 'HorizontalRule') {
        ret.tagName = 'hr'
        ret.selfClosing = true
    } else if (node.name === 'Paragraph') {
        ret.tagName = 'p'
    } else if (node.name === 'FencedCode' || node.name === 'InlineCode') {
        ret.tagName = 'code'
    } else if (node.name === 'Emphasis') {
        ret.tagName = 'em'
    } else if (node.name === 'StrongEmphasis') {
        ret.tagName = 'strong'
    } else if (node.name === 'Strikethrough') {
        ret.tagName = 'del'
    } else if (node.name === 'Mark') {
        ret.tagName = 'mark'
    } else if (node.name === 'Underline') {
        ret.tagName = 'u'
    } else if (node.children.length === 1) {
        ret.tagName = 'span'
    }

    if ([ 'span', 'div', 'p' ].includes(ret.tagName)) {
        ret.attributes.push([ 'class', node.name ])
    }

    return ret
}

/**
 * Takes a Markdown AST node and turns it to an HTML string
 *
 * @param   {ASTNode}  node         The node
 * @param   {number}   indent       The indentation for this node
 *
 * @return  {string}                The HTML string
 */
function nodeToHTML (node: ASTNode|ASTNode[], indent: number = 0): string {
    // Convenience to convert a list of child nodes to HTML
    if (Array.isArray(node)) {
        const body: string[] = []
        for (const child of node) {
            body.push(nodeToHTML(child, indent))
        }
        return body.join('')
    } else if (node.type === 'Generic' && node.name === 'Document') {
        // This ensures there's no outer div class=Document
        return nodeToHTML(node.children, indent)
    } else if (node.type === 'Table') {
        const rows: string[] = []
        let maxCells = 0

        // First calculate the maximum number of columns
        for (const row of node.rows) {
            maxCells = Math.max(maxCells, row.cells.length)
        }

        for (const row of node.rows) {
            const cells: string[] = []
            for (let i = 0; i < maxCells; i++) {
                if (i < row.cells.length) {
                    cells.push(nodeToHTML(row.cells[i].children, indent))
                } else {
                    cells.push('') // Add empty content for missing cells
                }
            }
            const tag = row.isHeaderOrFooter ? 'th' : 'td'
            const content = cells.map(c => `<${tag}>${c}</${tag}>`).join('\n')
            if (row.isHeaderOrFooter) {
                rows.push(`${row.whitespaceBefore}<thead>\n<tr>\n${content}\n</tr>\n</thead>`)
            } else {
                rows.push(`${row.whitespaceBefore}<tr>\n${content}\n</tr>`)
            }
        }
        return `${node.whitespaceBefore}<table>\n${rows.join('\n')}\n</table>`
    } else if (node.type === 'Text') {
        return node.whitespaceBefore + node.value // Plain text
    } else if (node.type === 'Generic') {
        // Skip rendering marker nodes (StrikethroughMarker, MarkMarker, UnderlineMarker)
        if (node.name === 'StrikethroughMarker' || node.name === 'MarkMarker' || node.name === 'UnderlineMarker') {
            return '' // Don't render the markers themselves
        }

        // Generic nodes are differentiated by name. There are a few we can support,
        // but most we wrap in a div.
        const tagInfo = getTagInfo(node)

        if ([ 'div', 'span' ].includes(tagInfo.tagName) && node.children.length === 0) {
            return '' // Simplify the resulting HTML by removing empty elements
        }

        const attr = tagInfo.attributes.length > 0
            ? ' ' + tagInfo.attributes.map(a => `${a[0]}="${a[1]}"`).join(' ')
            : ''

        const open = `${node.whitespaceBefore}<${tagInfo.tagName}${attr}${tagInfo.selfClosing ? '/' : ''}>`
        const close = tagInfo.selfClosing ? '' : `</${tagInfo.tagName}>`
        const body = tagInfo.selfClosing ? '' : nodeToHTML(node.children)
        return `${open}${body}${close}`
    }

    return ''
}

/**
 * Takes Markdown source and turns it into a valid HTML fragment. The citeLibrary
 * will be used to resolve citations.
 *
 * @param   {string}    markdown       The Markdown source
 *
 * @return  {string}                   The resulting HTML
 */
export function md2html (markdown: string): string {
    const ast = markdownToAST(markdown)
    return nodeToHTML(ast)
}