
/**
 * TypeScript type definitions for table editor functionality
 *
 * This module exports all type definitions used throughout the table editor
 * system, including column alignment types, parsed table structures, and
 * configuration options for the TableEditor class.
 *
 * These types ensure type safety across the table editing features and provide
 * clear interfaces for table data manipulation and editor configuration.
 */
import type TableEditor from './table-editor.ts'

export type ColAlignment = 'center'|'left'|'right'

export interface ParsedTable {
    ast: string[][]
    colAlignments: ColAlignment[]
}

export interface TableEditorOptions {
    /**
     * Describes the container for the Table element (either an Element or a querySelector)
     */
    container?: HTMLElement|string

    /**
     * A callback that is fired whenever the TableEditor is unfocused
     *
     * @param   {TableEditor}  instance  The TableEditor instance
     */
    onBlur?: (instance: TableEditor) => void

    /**
     * A callback that is fired whenever the TableEditor's contents change
     *
     * @param   {TableEditor}  instance  The TableEditor instance
     */
    onChange?: (instance: TableEditor) => void

    /**
     * A callback that is fired whenever the user switches the cell of the table
     *
     * @param   {TableEditor}  instance     The TableEditor instance
     */
    onCellChange?: (instance: TableEditor) => void

    /**
     * When the user clicks on the save button, this callback is called to signal
     * that the user intended to save the table
     *
     * @param   {TableEditor}  instance  The TableEditor instance
     */
    saveIntent?: (instance: TableEditor) => void
}