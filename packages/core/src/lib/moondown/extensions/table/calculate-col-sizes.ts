
/**
 * Column size calculator for markdown tables
 *
 * This module calculates optimal column widths based on the content of each cell
 * in a table AST (Abstract Syntax Tree). It handles both single-line and multi-line
 * cells, ensuring proper table formatting and readability.
 */

/**
 * Calculates optimal column sizes for a markdown table
 *
 * Analyzes each column in the table and determines the minimum width needed
 * to display all content without truncation. For multi-line cells, it uses
 * the longest line as the determining factor for column width.
 *
 * @param ast - 2D array representing the table structure where each element is a cell's content
 * @returns Array of column widths where each element represents the required width for that column
 *
 * @example
 * const table = [
 *   ["Name", "Description"],
 *   ["John", "A very long description that needs more space"],
 *   ["Jane", "Short"]
 * ];
 * const sizes = calculateColSizes(table); // Returns [4, 45]
 */
export default function calculateColSizes (ast: string[][]): number[] {
    const sizes = []
    for (let col = 0; col < ast[0].length; col++) {
        let colSize = 0
        for (let row = 0; row < ast.length; row++) {
            const cell = ast[row][col]
            let cellLength = cell.length
            if (cell.includes('\n')) {
                // Multi-line cell -> take the longest of the containing rows
                cellLength = Math.max(...cell.split('\n').map(x => x.length))
            }

            if (cellLength > colSize) {
                colSize = cellLength
            }
        }
        sizes.push(colSize)
    }
    return sizes
}