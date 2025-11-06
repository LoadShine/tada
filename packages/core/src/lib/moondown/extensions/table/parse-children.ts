import type {SyntaxNode} from '@lezer/common'
import {type ASTNode, parseNode, type MDNode} from './table-ast.ts'
import {genericTextNode} from './generic-text-node.ts'
import {getWhitespaceBeforeNode} from "./table-functions.ts";

/**
 * This list contains all Node names that do not themselves have any content.
 * These are either purely formatting nodes (such as heading marks or link
 * marks) who can be reconstructed without the verbatim value, as well as larger
 * container nodes (whose contents is represented via their children).
 *
 * @var {string[]}
 */
const EMPTY_NODES = [
    'HeaderMark',
    'CodeMark',
    'EmphasisMark',
    'SuperscriptMark',
    'SubscriptMark',
    'QuoteMark',
    'ListMark',
    'YAMLFrontmatterStart',
    'YAMLFrontmatterEnd',
    'Document',
    'List',
    'ListItem',
    'PandocAttribute'
]

/**
 * Parses the children of ASTNodes who can have children.
 *
 * @param   {T}           astNode   The AST node that must support children
 * @param   {SyntaxNode}  node      The original Lezer SyntaxNode
 * @param   {string}      markdown  The Markdown source
 *
 * @return  {T}                     Returns the same astNode with children.
 */
export function parseChildren<T extends {
    children: ASTNode[]
} & MDNode>(astNode: T, node: SyntaxNode, markdown: string): T {
    if (node.firstChild === null) {
        if (!EMPTY_NODES.includes(node.name)) {
            const textNode = genericTextNode(node.from, node.to, markdown.substring(node.from, node.to), getWhitespaceBeforeNode(node, markdown))
            astNode.children = [textNode]
        }
        return astNode // We're done
    }

    astNode.children = []

    let currentChild: SyntaxNode | null = node.firstChild
    let currentIndex = node.from
    while (currentChild !== null) {
        // NOTE: We have to account for "gaps" where a node has children that do not
        // completely cover the node's contents. In that case, we have to add text
        // nodes that just contain those strings.
        if (currentChild.from > currentIndex && !EMPTY_NODES.includes(node.name)) {
            const gap = markdown.substring(currentIndex, currentChild.from)
            const onlyWhitespace = /^(\s*)/m.exec(gap)
            const whitespaceBefore = onlyWhitespace !== null ? onlyWhitespace[1] : ''
            const textNode = genericTextNode(
                currentIndex,
                currentChild.from,
                gap.substring(whitespaceBefore.length),
                whitespaceBefore
            )
            astNode.children.push(textNode)
        }
        astNode.children.push(parseNode(currentChild, markdown))
        currentIndex = currentChild.to // Must happen before the nextSibling assignment
        currentChild = currentChild.nextSibling
    }

    if (currentIndex < node.to && !EMPTY_NODES.includes(node.name)) {
        // One final text node
        const textNode = genericTextNode(currentIndex, node.to, markdown.substring(currentIndex, node.to))
        astNode.children.push(textNode)
    }

    return astNode
}