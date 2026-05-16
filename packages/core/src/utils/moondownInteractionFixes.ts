export function installMoondownInteractionFixes(root: HTMLElement): () => void {
    const patchTables = () => {
        root.querySelectorAll<HTMLTableElement>('table.table-helper').forEach((table) => {
            table.removeAttribute('contenteditable');
            table.querySelectorAll<HTMLTableCellElement>('td[contenteditable="true"]').forEach((cell) => {
                cell.tabIndex = 0;
            });
        });
    };

    const handleTablePointerEvent = (event: MouseEvent) => {
        const target = event.target instanceof Element ? event.target : null;
        const cell = target?.closest<HTMLTableCellElement>('td');
        const table = cell?.closest('table.table-helper');
        if (!cell || !table || !root.contains(table)) return;

        event.preventDefault();
        event.stopPropagation();
        table.removeAttribute('contenteditable');
        cell.tabIndex = 0;
        focusCellAtPoint(cell, event.clientX, event.clientY);
        window.setTimeout(() => focusCellAtPoint(cell, event.clientX, event.clientY), 0);
        window.setTimeout(() => focusCellAtPoint(cell, event.clientX, event.clientY), 40);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Enter' || event.key === 'Escape' || event.key === 'Tab') {
            window.setTimeout(() => hideStaleSlashMenu(root), 0);
        }
    };

    patchTables();
    const observer = new MutationObserver(patchTables);
    observer.observe(root, { childList: true, subtree: true });
    root.addEventListener('mousedown', handleTablePointerEvent, true);
    root.addEventListener('mouseup', handleTablePointerEvent, true);
    root.addEventListener('click', handleTablePointerEvent, true);
    root.addEventListener('keydown', handleKeyDown, true);

    return () => {
        observer.disconnect();
        root.removeEventListener('mousedown', handleTablePointerEvent, true);
        root.removeEventListener('mouseup', handleTablePointerEvent, true);
        root.removeEventListener('click', handleTablePointerEvent, true);
        root.removeEventListener('keydown', handleKeyDown, true);
    };
}

function focusCellAtPoint(cell: HTMLElement, x: number, y: number): void {
    void x;
    void y;
    cell.focus({ preventScroll: true });
    cell.dispatchEvent(new FocusEvent('focus'));
}

function hideStaleSlashMenu(root: HTMLElement): void {
    if (hasActiveSlashAtSelection(root)) return;
    root.querySelectorAll<HTMLElement>('.cm-slash-command-menu').forEach((menu) => {
        menu.style.display = 'none';
    });
}

function hasActiveSlashAtSelection(root: HTMLElement): boolean {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return false;
    const node = selection.getRangeAt(0).startContainer;
    const element = node instanceof Element ? node : node.parentElement;
    const line = element?.closest('.cm-line');
    if (!line || !root.contains(line)) return false;
    return /\/[^\s/]*$/u.test((line.textContent ?? '').trimEnd());
}
