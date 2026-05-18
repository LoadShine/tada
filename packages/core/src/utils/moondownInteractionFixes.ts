export function installMoondownInteractionFixes(root: HTMLElement): () => void {
    const patchTables = () => {
        root.querySelectorAll<HTMLTableElement>('table.table-helper').forEach((table) => {
            table.removeAttribute('contenteditable');
            table.querySelectorAll<HTMLTableCellElement>('td').forEach((cell) => {
                if (cell.getAttribute('contenteditable') !== 'true') {
                    cell.setAttribute('contenteditable', 'true');
                }
            });
        });
    };

    patchTables();
    const observer = new MutationObserver(patchTables);
    observer.observe(root, {childList: true, subtree: true});

    return () => observer.disconnect();
}
