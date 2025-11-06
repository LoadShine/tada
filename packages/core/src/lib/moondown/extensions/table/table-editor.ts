import buildPipeTable from './build-pipe.ts'
import computeCSS from './compute-css.ts'
import type {ColAlignment, TableEditorOptions} from './types.ts'
import {md2html} from './markdown-to-html.ts'
import {selectElementContents} from "./select-in-element.ts";
import { TABLE_SIZING, TABLE_CSS_CLASSES, TABLE_SYMBOLS } from './constants';
import tippy, {type Instance as TippyInstance } from 'tippy.js';
import {
    createIcons,
    ArrowLeftToLine,
    ArrowRightToLine,
    ArrowUpToLine,
    ArrowDownToLine,
    Trash2,
    AlignCenter,
    AlignLeft,
    AlignRight
} from 'lucide';

export default class TableEditor {
    /**
     * Holds the current number of rows within the table
     *
     * @var {number}
     */
    private _rows: number

    /**
     * Holds the current number of columns within the table
     *
     * @var {number}
     */
    private _cols: number

    /**
     * Holds the current column-index
     *
     * @var {number}
     */
    private _cellIndex: number

    /**
     * Holds the current row-index
     *
     * @var {number}
     */
    private _rowIndex: number

    /**
     * The options passed to the instance
     *
     * @var {TableEditorOptions}
     */
    private readonly _options: TableEditorOptions

    /**
     * If true, any events on the table editor are not handled
     *
     * @var {boolean}
     */
    private _eventLock: boolean

    /**
     * The container element for the editor
     *
     * @var {HTMLElement}
     */
    private readonly _containerElement: HTMLElement

    /**
     * The DOM element representing the editor
     *
     * @var {HTMLTableElement}
     */
    private readonly _elem: HTMLTableElement

    /**
     * The actual table contents
     *
     * @var {string[][]}
     */
    private readonly _ast: string[][]

    /**
     * Holds the current alignment per each column
     *
     * @var {ColAlignment[]}
     */
    private _colAlignment: ColAlignment[]

    /**
     * Holds the size of the edge buttons
     *
     * @var {number}
     */
    private readonly _edgeButtonSize: number

    /**
     * Remembers the clean/modified status of the table
     *
     * @var {boolean}
     */
    private _isClean: boolean

    /**
     * This variable is used internally to detect whether the table has
     * effectively changed since the last time to track the clean status
     *
     * @var {string}
     */
    private _lastSeenTable: string

    /**
     * The following variables are the various buttons
     */
    private readonly _addTopButton: HTMLDivElement
    private readonly _addLeftButton: HTMLDivElement

    private _lastMousemoveEvent: MouseEvent | undefined

    private _tippyInstance: TippyInstance | null = null;

    /**
     * Tracks pending blur operations to avoid conflicts
     */
    private _pendingBlur: number | null = null;

    /**
     * Creates a new TableHelper.
     *
     * @param {string[][]}         ast          The table AST
     * @param {ColAlignment[]}     alignments   The column alignments
     * @param {TableEditorOptions} [options={}] An object with optional callbacks for onBlur and onChange.
     */
    constructor(ast: string[][], alignments: ColAlignment[], options: TableEditorOptions = {}) {
        // First, copy over simple properties
        this._rows = ast.length
        this._cols = ast[0].length
        this._cellIndex = 0
        this._rowIndex = 0
        this._options = options
        this._eventLock = false // See _rebuildDOMElement for details
        this._ast = ast
        this._lastSeenTable = JSON.stringify(this._ast)
        this._colAlignment = alignments
        this._edgeButtonSize = TABLE_SIZING.EDGE_BUTTON_SIZE
        this._isClean = true
        this._pendingBlur = null

        // Find the container element
        if ('container' in options && options.container instanceof HTMLElement) {
            this._containerElement = options.container
        } else if ('container' in options && typeof options.container === 'string') {
            const target = document.querySelector(options.container)
            if (target === null) {
                throw new Error(`Could not find element using selector ${options.container}`)
            }
            this._containerElement = target as HTMLElement
        } else {
            this._containerElement = document.body
        }

        const template = document.createElement('div')
        template.classList.add(TABLE_CSS_CLASSES.OPERATE_BUTTON)

        this._addTopButton = template.cloneNode(true) as HTMLDivElement
        this._addTopButton.classList.add(TABLE_CSS_CLASSES.TOP_BUTTON)
        this._addTopButton.innerHTML = TABLE_SYMBOLS.HORIZONTAL_ELLIPSIS;
        this._addLeftButton = template.cloneNode(true) as HTMLDivElement
        this._addLeftButton.classList.add(TABLE_CSS_CLASSES.LEFT_BUTTON)
        this._addLeftButton.innerHTML = TABLE_SYMBOLS.VERTICAL_ELLIPSIS;

        // Create the Table element
        const table = document.createElement('table')
        table.classList.add(TABLE_CSS_CLASSES.HELPER)
        this._elem = table

        // Populate the inner contents initially
        this._rebuildDOMElement()

        // Whenever the user moves the mouse over the container, maybe show the edge
        // buttons ...
        this._containerElement.addEventListener('mouseover', (e) => {
            this._moveHelper(e)
            this._lastMousemoveEvent = e
        })

        this._containerElement.addEventListener('mousedown', (e) => {
            this._clickHelper(e)
            this._lastMousemoveEvent = e
        })

        this._containerElement.addEventListener('mouseover', (e) => {
            if (this._lastMousemoveEvent !== e) {
                this._hideAllButtons()
            }
        })

        // Activate the edge button's functionality. We need to prevent the default
        // on the mousedowns, otherwise the table cell will lose focus, thereby
        // triggering the blur event on the table.
        this._addTopButton.addEventListener('mousedown', (e) => {
            e.preventDefault();
            this._showColumnActions();
        });
        this._addLeftButton.addEventListener('mousedown', (e) => {
            e.preventDefault()
            this._showRowActions()
        })

        // Inject the CSS necessary to style the table and buttons.
        this._injectCSS()
    }

    private _showRowActions(): void {
        if (this._tippyInstance) {
            this._tippyInstance.destroy();
        }

        const content = this._createRowActionsTippyContent();

        this._tippyInstance = tippy(this._addLeftButton, {
            content: content,
            interactive: true,
            theme: 'custom',
            placement: 'right',
            trigger: 'manual',
            arrow: true,
        });

        this._tippyInstance.show();
    }

    private _createRowActionsTippyContent(): HTMLElement {
        const container = document.createElement('div');
        container.style.display = 'flex';
        container.style.gap = '5px';
        container.style.padding = '5px';

        const actions = [
            { icon: 'arrow-up-to-line', title: 'Insert row above', action: () => this.prependRow() },
            { icon: 'arrow-down-to-line', title: 'Insert row below', action: () => this.appendRow() },
            { icon: 'trash-2', title: 'Delete this row', action: () => this.pluckRow() },
        ];

        actions.forEach(({ icon, title, action }) => {
            const button = document.createElement('button');
            button.innerHTML = `<i data-lucide="${icon}"></i>`;
            button.title = title;
            button.className = 'tippy-button';
            button.addEventListener('click', () => {
                action();
                this._tippyInstance?.hide();
                this._options.saveIntent?.(this)
            });
            container.appendChild(button);
        });

        setTimeout(() => createIcons({
            icons: {ArrowUpToLine, ArrowDownToLine, Trash2},
            attrs: {
                width: '16',
                height: '16'
            }
        }), 0);

        return container;
    }

    private _showColumnActions(): void {
        if (this._tippyInstance) {
            this._tippyInstance.destroy();
        }

        const content = this._createColumnActionsTippyContent();

        this._tippyInstance = tippy(this._addTopButton, {
            content: content,
            interactive: true,
            theme: 'custom',
            placement: 'bottom',
            trigger: 'manual',
            arrow: true,
        });

        this._tippyInstance.show();
    }

    private _createColumnActionsTippyContent(): HTMLElement {
        const container = document.createElement('div');
        container.style.display = 'flex';
        container.style.gap = '5px';
        container.style.padding = '5px';

        const actions = [
            {
                icon: 'arrow-left-to-line',
                title: 'Insert column to the left',
                action: () => {
                    this.prependCol();
                    this._tippyInstance?.hide();
                    this._options.saveIntent?.(this)
                }
            },
            {
                icon: 'arrow-right-to-line',
                title: 'Insert column to the right',
                action: () => {
                    this.appendCol();
                    this._tippyInstance?.hide();
                    this._options.saveIntent?.(this)
                }
            },
            {
                icon: 'trash-2',
                title: 'Delete this column',
                action: () => {
                    this.pluckCol();
                    this._tippyInstance?.hide();
                    this._options.saveIntent?.(this)
                }
            },
            {
                icon: 'align-center',
                title: 'Alignment',
                action: (event: MouseEvent) => this._showAlignmentOptions(event.currentTarget as HTMLElement) },
        ];

        actions.forEach(({ icon, title, action }) => {
            const button = document.createElement('button');
            button.innerHTML = `<i data-lucide="${icon}"></i>`;
            button.title = title;
            button.className = 'tippy-button';
            button.addEventListener('click', action);
            container.appendChild(button);
        });

        setTimeout(() => createIcons({
            icons: {ArrowLeftToLine, ArrowRightToLine, Trash2, AlignCenter},
            attrs: {
                width: '16',
                height: '16'
            }
        }), 0);

        return container;
    }

    private _showAlignmentOptions(target: HTMLElement): void {
        const alignmentOptions = document.createElement('div');
        alignmentOptions.className = 'alignment-options';
        const alignments = [
            {
                icon: 'align-left',
                title: 'Align left',
                action: () => {
                    this.changeColAlignment('left');
                }
            },
            {
                icon: 'align-center',
                title: 'Align center',
                action: () => {
                    this.changeColAlignment('center');
                }
            },
            {
                icon: 'align-right',
                title: 'Align right',
                action: () => {
                    this.changeColAlignment('right');
                }
            }
        ]

        alignments.forEach(align => {
            const alignButton = document.createElement('button');
            alignButton.className = 'tippy-button';
            alignButton.title = align.title;
            alignButton.innerHTML = `<i data-lucide="${align.icon}"></i>`;
            alignButton.addEventListener('click', () => {
                align.action();
                this._tippyInstance?.hide();
                this._options.saveIntent?.(this)
            });
            alignmentOptions.appendChild(alignButton);
        });

        const instance = tippy(target, {
            content: alignmentOptions,
            interactive: true,
            theme: 'custom',
            placement: 'bottom',
            trigger: 'manual',
            arrow: true,
        });

        instance.show();

        setTimeout(() => createIcons({
            icons: {AlignLeft, AlignCenter, AlignRight},
            attrs: {
                width: '16',
                height: '16'
            }
        }), 0);
    }

    /**
     * Shows or hides the table buttons depending on the mouse position
     *
     * @param   {MouseEvent}  evt  The event
     */
    _moveHelper(evt: MouseEvent): void {
        const rect = this._elem.getBoundingClientRect()
        const minX = rect.left - this._edgeButtonSize
        const minY = rect.top - this._edgeButtonSize
        const maxX = minX + rect.width + this._edgeButtonSize * 2
        const maxY = minY + rect.height + this._edgeButtonSize * 2

        if (
            evt.clientX >= minX &&
            evt.clientX <= maxX &&
            evt.clientY >= minY &&
            evt.clientY <= maxY
        ) {
            // Always recalculate the positions to make sure
            // their position is always updated asap.
            this._recalculateEdgeButtonPositions()
        } else {
            this._hideAllButtons()
        }
    }

    _clickHelper(evt: MouseEvent): void {
        const rect = this._elem.getBoundingClientRect()
        const minX = rect.left - this._edgeButtonSize
        const minY = rect.top - this._edgeButtonSize
        const maxX = minX + rect.width + this._edgeButtonSize * 2
        const maxY = minY + rect.height + this._edgeButtonSize * 2

        if (
            evt.clientX >= minX &&
            evt.clientX <= maxX &&
            evt.clientY >= minY &&
            evt.clientY <= maxY
        ) {
            this._showEdgeButtons()
            this._recalculateEdgeButtonPositions()
        } else {
            this._hideAllButtons()
        }
    }

    /**
     * Rebuilds the inner contents of the Table element
     */
    _rebuildDOMElement(): void {
        this._eventLock = true
        // Removing any innerHTML will trigger events on the cells, namely
        // blur events. If we change the table (adding/removing cols/rows)
        // we are rebuilding the internal DOM. However, having blur trigger
        // during this would modify the internal AST, which we do not want.
        this._elem.innerHTML = '' // Reset
        this._eventLock = false

        const tbody = this._elem.createTBody()

        for (let i = 0; i < this._ast.length; i++) {
            const row = tbody.insertRow(-1)
            row.style.width = '100%'

            for (let j = 0; j < this._ast[i].length; j++) {
                const cell = row.insertCell(-1)
                cell.innerHTML = md2html(this._ast[i][j])
                cell.style.textAlign = this._colAlignment[j]
                cell.setAttribute('contenteditable', 'true')
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                cell.addEventListener('focus', (_) => {
                    this._onCellFocus(cell)
                })
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                cell.addEventListener('blur', (_) => {
                    this._onCellBlur(cell)
                })
            }
        }

        this.selectCell('start')
    }

    /**
     * Handles blur events on cells
     *
     * @param   {DOMElement}  cell  The cell on which the event was triggered
     */
    _onCellBlur(cell: HTMLTableCellElement): void {
        if (this._eventLock) {
            return // Ignore events
        }

        // Cancel any pending blur operation
        if (this._pendingBlur !== null) {
            clearTimeout(this._pendingBlur);
            this._pendingBlur = null;
        }

        const col = cell.cellIndex
        const row = (cell.parentElement as HTMLTableRowElement).rowIndex

        // Re-render the table element and save the textContent as data-source
        const newContent = cell.textContent ?? '';
        this._ast[row][col] = newContent;
        cell.innerHTML = md2html(newContent);

        this._signalContentChange();

        this._pendingBlur = window.setTimeout(() => {
            this._pendingBlur = null;
            const activeElement = document.activeElement;

            const isInCurrentTable = activeElement && this._elem.contains(activeElement);

            if (!isInCurrentTable) {
                if (this._options.onBlur !== undefined) {
                    this._options.onBlur(this);
                }
            }
        }, 50);
    }

    /**
     * Handles a focus event on table cells
     *
     * @param   {DOMElement}  cell  The cell on which the event has triggered
     */
    _onCellFocus(cell: HTMLTableCellElement): void {
        if (this._eventLock) {
            return // Ignore events
        }

        // Cancel any pending blur operation since we're focusing on this table
        if (this._pendingBlur !== null) {
            clearTimeout(this._pendingBlur);
            this._pendingBlur = null;
        }

        // As soon as any cell is focused, recalculate
        // the current cell and table dimensions.
        const col = cell.cellIndex
        const row = (cell.parentElement as HTMLTableRowElement).rowIndex
        // Before the cell is focused, replace the contents with the source for
        // easy editing, thereby removing any pre-rendered HTML
        cell.innerHTML = this._ast[row][col]

        this._rowIndex = row
        this._cellIndex = col

        this._recalculateEdgeButtonPositions()
    }

    /**
     * Recalculates the correct positions of all edge buttons.
     */
    _recalculateEdgeButtonPositions(): void {
        const spacing = 5; // Spacing in pixels
        const currentCell = this._elem.rows[this._rowIndex]?.cells[this._cellIndex];

        // Exit if the current cell doesn't exist (e.g., table is being rebuilt)
        if (!currentCell) {
            this._hideAllButtons();
            return;
        }

        const currentRow = this._elem.rows[this._rowIndex];
        const currentColumn = Array.from(this._elem.rows).map(row => row.cells[this._cellIndex]);

        const cellRect = currentCell.getBoundingClientRect();
        const rowRect = currentRow.getBoundingClientRect();

        // Calculate the top of the column by finding the min top of all cells in that column
        const columnTop = Math.min(...currentColumn.map(cell => cell.getBoundingClientRect().top));

        const containerRect = this._containerElement.getBoundingClientRect();

        // Use page scroll offsets to convert viewport-relative coords to absolute coords
        const scrollTop = window.scrollY || document.documentElement.scrollTop;
        const scrollLeft = window.scrollX || document.documentElement.scrollLeft;

        // Check if the cell is visible on the screen to avoid calculating for off-screen elements
        const cellIsOnScreen = cellRect.top > containerRect.top && cellRect.bottom < containerRect.bottom;

        if (cellIsOnScreen) {
            // Calculate and set the top button's position
            const topButtonTop = scrollTop + columnTop - this._edgeButtonSize * 0.6 - spacing;
            const topButtonLeft = scrollLeft + cellRect.left + cellRect.width / 2 - (this._edgeButtonSize * 1.2 / 2);
            this._addTopButton.style.top = `${topButtonTop}px`;
            this._addTopButton.style.left = `${topButtonLeft}px`;

            // Calculate and set the left button's position
            const leftButtonTop = scrollTop + rowRect.top + rowRect.height / 2 - (this._edgeButtonSize * 1.2 / 2);
            const leftButtonLeft = scrollLeft + rowRect.left - this._edgeButtonSize * 0.6 - spacing;
            this._addLeftButton.style.top = `${leftButtonTop}px`;
            this._addLeftButton.style.left = `${leftButtonLeft}px`;
        } else {
            // Hide buttons if the cell is not on screen
            this._addTopButton.style.top = '-1000px';
            this._addLeftButton.style.top = '-1000px';
        }
    }


    /**
     * Displays the edge buttons for adding rows, columns, alignment and removal.
     */
    _showEdgeButtons(): void {
        if (this._edgeButtonsVisible) {
            return
        }

        // Attach all buttons to the DOM
        document.body.appendChild(this._addTopButton)
        document.body.appendChild(this._addLeftButton)

        this._recalculateEdgeButtonPositions()
    }

    /**
     * Removes the edge buttons from the DOM.
     */
    _hideAllButtons(): void {
        // Hide the edge detection buttons again
        this._addTopButton.parentElement?.removeChild(this._addTopButton)
        this._addLeftButton.parentElement?.removeChild(this._addLeftButton)
    }

    /**
     * Returns true if the edge buttons are visible (i.e. attached to the DOM)
     *
     * @return  {boolean} True if the buttons are currently within the DOM
     */
    get _edgeButtonsVisible(): boolean {
        return this._addTopButton.parentElement !== null &&
            this._addLeftButton.parentElement !== null
    }

    /**
     * Returns the DOM representation of the table
     */
    get domElement(): HTMLTableElement {
        return this._elem
    }

    /**
     * Rebuilds the Abstract Syntax Tree after something has changed. Optionally
     * notifies the callback, if given.
     * @return {void} Does not return.
     */
    _signalContentChange(): void {
        const currentTable = JSON.stringify(this._ast)

        if (currentTable === this._lastSeenTable && this._isClean) {
            // The table has not changed
            return
        }

        this._lastSeenTable = currentTable
        this._isClean = false

        // Now inform the caller that the table has changed with this object.
        if (this._options.onChange !== undefined) {
            this._options.onChange(this)
        }
    }

    /**
     * Returns the Markdown table representation of this table.
     *
     * @returns {string} The markdown table
     */
    getMarkdownTable(): string {
        // Determine which table to output, based on the _mdTableType
        return buildPipeTable(this._ast, this._colAlignment)
    }

    /**
     * Signals the table editor that the caller has now saved the table contents
     */
    markClean(): void {
        this._isClean = true
    }

    /**
     * Returns the clean status of the table editor.
     *
     * @return  {boolean} True if the table has not changed
     */
    // isClean(): boolean {
    //     return this._isClean
    // }

    /**
     * Moves the cursor to the previous column, switching rows if necessary.
     */
    previousCell(): void {
        // We're already in the first cell
        if (this._cellIndex === 0 && this._rowIndex === 0) return

        // Focuses the previous cell of the table
        this._cellIndex--

        if (this._cellIndex < 0) {
            // Move to previous row, last cell
            this._rowIndex--
            this._cellIndex = this._cols - 1 // Zero-based indexing
        }

        this.selectCell('end')
        this._options.onCellChange?.(this)
    }

    /**
     * Moves the cursor to the next cell, passing over rows, if necessary.
     * Can add new rows as you go.
     *
     * @param  {boolean}  automaticallyAddRows  Whether to add new rows.
     */
    nextCell(automaticallyAddRows: boolean = true): void {
        // Focuses the next cell of the table
        let newCellIndex = this._cellIndex + 1
        let newRowIndex = this._rowIndex

        if (newCellIndex === this._cols) {
            newRowIndex++
            newCellIndex = 0
        }

        if (newRowIndex === this._rows) {
            if (automaticallyAddRows) {
                this.appendRow()
            } else {
                return // We should not add new rows here
            }
        }

        // Set the correct indices
        this._cellIndex = newCellIndex
        this._rowIndex = newRowIndex
        this.selectCell('end')
        this._options.onCellChange?.(this)
    }

    /**
     * Moves the cursor to the same column, previous row.
     * @return {void} Does not return.
     */
    previousRow(): void {
        // Focuses the same cell in the previous row
        if (this._rowIndex === 0) {
            return // We're already in the first row
        }

        this._rowIndex--

        this.selectCell('end')
        this._options.onCellChange?.(this)
    }

    /**
     * Moves the cursor to the same column, next row. Can also add new
     * rows, if you wish so.
     *
     * @param  {boolean}  automaticallyAddRows  Whether or not to add new rows.
     */
    nextRow(automaticallyAddRows: boolean = true): void {
        // Focuses the same cell in the next row
        const newRowIndex = this._rowIndex + 1

        if (newRowIndex === this._rows) {
            if (automaticallyAddRows) {
                this.appendRow()
            } else {
                return // We should not add new rows here
            }
        }

        // Set the new index and select the cell
        this._rowIndex = newRowIndex
        this.selectCell('end')
        this._options.onCellChange?.(this)
    }

    /**
     * Prepends a column to the left of the currently active cell of the table.
     * @return {void} Does not return.
     */
    prependCol(): void {
        // Add a column to the left of the active cell -> add a TD child to all TRs
        for (let i = 0; i < this._ast.length; i++) {
            this._ast[i].splice(this._cellIndex, 0, '')
        }

        this._colAlignment.splice(this._cellIndex, 0, 'left')
        this._cols++
        this._rebuildDOMElement()

        this._signalContentChange() // Notify the caller
    }

    /**
     * Appends a column at the right side of the currently active cell of the table.
     * @return {void} Does not return.
     */
    appendCol(): void {
        // Add a column to the right of the table -> add a TD child to all TRs
        for (let i = 0; i < this._ast.length; i++) {
            this._ast[i].splice(this._cellIndex + 1, 0, '')
        }

        this._colAlignment.splice(this._cellIndex + 1, 0, 'left')
        this._cols++
        this._rebuildDOMElement()

        // Move into the next cell of the current row
        this.nextCell()
        this._signalContentChange() // Notify the caller
    }

    /**
     * Prepends a row to the top of the currently active cell of the table.
     * @return {void} Does not return.
     */
    prependRow(): void {
        // Prepend a whole row to the currently active cell
        const cells = []
        for (let i = 0; i < this._cols; i++) {
            cells.push('')
        }

        this._ast.splice(this._rowIndex, 0, cells)
        this._rows++
        this._rebuildDOMElement()

        this._signalContentChange() // Notify the caller
    }

    /**
     * Appends a row at the end of the table.
     * @return {void} Does not return.
     */
    appendRow(): void {
        // Append a whole row to the table
        const cells = []
        for (let i = 0; i < this._cols; i++) {
            cells.push('')
        }

        this._ast.splice(this._rowIndex + 1, 0, cells)
        this._rows++
        this._rebuildDOMElement()

        this.nextRow()
        this._recalculateEdgeButtonPositions()
        this._signalContentChange() // Notify the caller
    }

    /**
     * Removes the currently active row from the table.
     * @return {void} Does not return.
     */
    pluckRow(): void {
        // Do not remove the last row
        if (this._rows === 1) {
            return
        }

        // Removes the current row from the table
        const rowToRemove = this._rowIndex
        const firstRow = rowToRemove === 0

        if (firstRow) {
            this._rowIndex++
        } else {
            this._rowIndex--
        }
        this.selectCell('start')

        // Now pluck the row.
        this._ast.splice(rowToRemove, 1)
        this._rows--
        // Select "the" cell again (to move back to the original position)
        this._rebuildDOMElement()

        if (firstRow) {
            this._rowIndex = 0
            this.selectCell('start')
        }

        this._signalContentChange() // Notify the caller
        this._options.onCellChange?.(this)
    }

    /**
     * Removes the currently active column from the table.
     * @return {void} Does not return.
     */
    pluckCol(): void {
        // Do not remove the last column.
        if (this._cols === 1) {
            return
        }

        // Removes the current column from the table
        const colToRemove = this._cellIndex
        const firstCol = colToRemove === 0

        if (firstCol) {
            this._cellIndex = 1
        } else {
            this._cellIndex--
        }
        this.selectCell('start')

        // Now pluck the column.
        for (let i = 0; i < this._ast.length; i++) {
            this._ast[i].splice(colToRemove, 1)
        }

        this._colAlignment.splice(colToRemove, 1)
        this._cols--
        this._rebuildDOMElement()

        if (firstCol) {
            this._cellIndex = 0
            this.selectCell('start')
        }

        this._signalContentChange() // Notify the caller
        this._options.onCellChange?.(this)
    }

    /**
     * Changes the column alignment for the provided column
     *
     * @param {ColAlignment}  alignment  The new alignment: left, center, or right
     * @param {number}        col        The column index to change
     */
    changeColAlignment(alignment: ColAlignment, col: number = this._cellIndex): void {
        if (!['left', 'center', 'right'].includes(alignment)) {
            throw new Error('Wrong column alignment provided! ' + alignment)
        }

        if (col >= this._cols || col < 0) {
            throw new Error('Could not align column - Index out of bounds: ' + col.toString())
        }

        this._colAlignment[col] = alignment

        // Change the visual alignment
        for (let row = 0; row < this._rows; row++) {
            this._elem.rows[row].cells[col].style.textAlign = alignment
        }

        this._signalContentChange() // Recalculate everything
        this._options.onCellChange?.(this)
    }

    /**
     * Selects the current cell. The parameter controls where the cursor ends up.
     *
     * @param  {any}  where  If "start" or "end", puts a cursor there. Passing an
     *                       object with `from` and `to` properties allows to
     *                       select actual ranges.
     */
    selectCell(where: 'start' | 'end' | { from: number, to: number } = 'end'): void {
        if (!this.domElement.contains(document.activeElement)) {
            return // Only select any cell if focus is currently within the table
        }

        const currentCell = this._elem.rows[this._rowIndex].cells[this._cellIndex]
        currentCell.focus()
        const textLength = currentCell.textContent?.length ?? 0

        if (where === 'start') {
            selectElementContents(currentCell)
        } else if (where === 'end') {
            selectElementContents(currentCell, textLength, textLength)
        } else {
            selectElementContents(currentCell, where.from, where.to)
        }
        this._recalculateEdgeButtonPositions()
        setTimeout(() => currentCell.focus(), 10)
    }

    /**
     * Injects the necessary CSS into the DOM, making sure it comes before any other
     * CSS sources so you can override the styles, if you wish.
     * @return {void} Does not return.
     */
    _injectCSS(): void {
        if (document.getElementById('tableHelperCSS') !== null) {
            return // CSS already present
        }

        // Create the styles
        const styleElement = computeCSS(this._edgeButtonSize)
        document.head.prepend(styleElement)
    }
}