/**
 * Generates CSS styles for table helper interface
 *
 * @param edgeButtonSize - Base size for table operation buttons (affects button dimensions and border radius)
 * @returns Style element containing all table helper CSS rules
 */
export default function computeCSS(edgeButtonSize: number): Element {
    const styleNode = document.createElement('style')
    styleNode.setAttribute('id', 'tableHelperCSS')
    styleNode.setAttribute('type', 'text/css')

    styleNode.textContent = `
  /* --- Light Mode Table Styles --- */
  table.table-helper {
    width: 100%;
    display: inline-table;
    border: 1px solid #e8ebed;
    padding: 0px;
    border-collapse: separate;
    border-spacing: 0;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02);
    background-color: #ffffff;
    transition: box-shadow 0.2s ease;
  }
  
  table.table-helper:hover {
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05), 0 2px 4px rgba(0, 0, 0, 0.03);
  }
  
  table.table-helper tr:first-child {
    font-weight: 500;
    background-color: #fafbfc;
    color: #4b5563;
    font-size: 13px;
    letter-spacing: 0.2px;
  }
  
  table.table-helper tr:first-child td {
    border-right: 1px solid #f1f3f5;
    padding: 12px 16px;
    text-transform: none;
  }
  
  table.table-helper tr:first-child td:last-child {
    border-right: none;
  }
  
  table.table-helper tr:not(:first-child) {
    transition: background-color 0.15s ease;
  }
  
  table.table-helper tr:not(:first-child):hover {
    background-color: #f8f9fa;
  }
  
  table.table-helper td {
    padding: 12px 16px;
    border-bottom: 1px solid #f1f3f5;
    border-right: 1px solid #f1f3f5;
    min-width: 150px;
    caret-color: #3b82f6;
    height: ${edgeButtonSize * 1.5}px;
    position: relative;
    color: #374151;
    line-height: 1.6;
    transition: all 0.15s ease;
  }
  
  table.table-helper td:last-child {
    border-right: none;
  }
  
  table.table-helper tr:last-child td {
    border-bottom: none;
  }
  
  table.table-helper td:focus {
    background-color: #eff6ff;
    outline: 2px solid #3b82f6;
    outline-offset: -2px;
    box-shadow: inset 0 0 0 1px #3b82f6;
    z-index: 1;
  }
  
  table.table-helper tr:first-child td:first-child {
    border-top-left-radius: 11px;
  }
  
  table.table-helper tr:first-child td:first-child:focus {
    border-top-left-radius: 11px;
  }
  
  table.table-helper tr:first-child td:last-child {
    border-top-right-radius: 11px;
  }
  
  table.table-helper tr:first-child td:last-child:focus {
    border-top-right-radius: 11px;
  }
  
  table.table-helper tr:last-child td:first-child {
    border-bottom-left-radius: 11px;
  }
  
  table.table-helper tr:last-child td:first-child:focus {
    border-bottom-left-radius: 11px;
  }
  
  table.table-helper tr:last-child td:last-child {
    border-bottom-right-radius: 11px;
  }
  
  table.table-helper tr:last-child td:last-child:focus {
    border-bottom-right-radius: 11px;
  }
  
  /* Formatting styles for table content */
  table.table-helper td em {
    font-style: italic;
  }
  
  table.table-helper td strong {
    font-weight: 600;
    color: #1f2937;
  }
  
  table.table-helper td code {
    background-color: #f3f4f6;
    color: #e11d48;
    padding: 2px 4px;
    border-radius: 4px;
    font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', monospace;
  }
  
  table.table-helper td del {
    text-decoration: line-through;
    opacity: 0.6;
  }
  
  table.table-helper td mark {
    background: #fef3c7;
    color: #92400e;
    padding: 2px 4px;
    border-radius: 3px;
  }
  
  table.table-helper td u {
    text-decoration: underline;
    text-decoration-color: #3b82f6;
    text-decoration-thickness: 2px;
    text-underline-offset: 2px;
  }
  
  .table-helper-operate-button {
    background: linear-gradient(135deg, #ffffff, #f8f9fa);
    color: #64748b;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04);
    border: 1px solid #e8ebed;
    backdrop-filter: blur(8px);
  }
  
  .table-helper-operate-button:hover {
    background: linear-gradient(135deg, #f8f9fa, #f1f3f5);
    color: #3b82f6;
    box-shadow: 0 4px 8px rgba(59, 130, 246, 0.15), 0 2px 4px rgba(59, 130, 246, 0.1);
    border-color: #3b82f6;
  }

  /* --- Dark Mode Table Styles --- */
  .dark table.table-helper {
    border-color: #2d3748;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3), 0 1px 2px rgba(0, 0, 0, 0.2);
    background-color: #1a202c;
  }
  
  .dark table.table-helper:hover {
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.4), 0 2px 4px rgba(0, 0, 0, 0.3);
  }
  
  .dark table.table-helper tr:first-child {
    background-color: #242c3a;
    color: #9ca3af;
  }
  
  .dark table.table-helper tr:first-child td {
    border-right-color: #2d3748;
  }
  
  .dark table.table-helper tr:not(:first-child):hover {
    background-color: #1f2937;
  }
  
  .dark table.table-helper td {
    border-bottom-color: #2d3748;
    border-right-color: #2d3748;
    caret-color: #60a5fa;
    color: #cbd5e1;
  }
  
  .dark table.table-helper td:focus {
    background-color: #1e3a5f;
    outline: 2px solid #3b82f6;
    outline-offset: -2px;
    box-shadow: inset 0 0 0 1px #3b82f6;
    z-index: 1;
  }
  
  /* Dark mode formatting styles */
  .dark table.table-helper td strong {
    color: #f1f5f9;
    font-weight: 600;
  }
  
  .dark table.table-helper td code {
    background-color: #0f172a;
    color: #fb7185;
    border-color: #1e293b;
  }
  
  .dark table.table-helper td mark {
    background: #92400e;
    color: #fef3c7;
  }
  
  .dark table.table-helper td u {
    text-decoration-color: #60a5fa;
  }
  
  .dark .table-helper-operate-button {
    background: linear-gradient(135deg, #2d3748, #283141);
    color: #94a3b8;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3), 0 1px 2px rgba(0, 0, 0, 0.2);
    border: 1px solid #374151;
  }
  
  .dark .table-helper-operate-button:hover {
    background: linear-gradient(135deg, #334155, #2d3748);
    color: #60a5fa;
    box-shadow: 0 4px 8px rgba(59, 130, 246, 0.25), 0 2px 4px rgba(59, 130, 246, 0.15);
    border-color: #3b82f6;
  }

  .tippy-box[data-theme~='custom'] {
    background-color: #ffffff;
    color: #1f2937;
    border-radius: 12px;
    box-shadow: 
      0 0 0 1px rgba(0, 0, 0, 0.05),
      0 20px 25px -5px rgba(0, 0, 0, 0.1),
      0 10px 10px -5px rgba(0, 0, 0, 0.04);
    border: none;
    font-size: 14px;
    padding: 4px;
  }
  
  .tippy-box[data-theme~='custom'][data-placement^='bottom'] > .tippy-arrow::before {
    border-bottom-color: #ffffff;
    filter: drop-shadow(0 -2px 2px rgba(0, 0, 0, 0.05));
  }
  
  .tippy-box[data-theme~='custom'][data-placement^='top'] > .tippy-arrow::before {
    border-top-color: #ffffff;
    filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.05));
  }
  
  .tippy-box[data-theme~='custom'][data-placement^='right'] > .tippy-arrow::before {
    border-right-color: #ffffff;
    filter: drop-shadow(-2px 0 2px rgba(0, 0, 0, 0.05));
  }
  
  .tippy-box[data-theme~='custom'][data-placement^='left'] > .tippy-arrow::before {
    border-left-color: #ffffff;
    filter: drop-shadow(2px 0 2px rgba(0, 0, 0, 0.05));
  }
  
  .tippy-box[data-theme~='custom'] .tippy-content {
    padding: 4px;
  }
  
  .tippy-button {
    border: none;
    background-color: transparent;
    cursor: pointer;
    padding: 8px 10px;
    border-radius: 8px;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    color: #6b7280;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    position: relative;
    overflow: hidden;
  }
  
  .tippy-button::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: radial-gradient(circle at center, rgba(59, 130, 246, 0.1) 0%, transparent 70%);
    opacity: 0;
    transition: opacity 0.3s ease;
  }
  
  .tippy-button:hover {
    background-color: #f3f4f6;
    color: #3b82f6;
  }
  
  .tippy-button:hover::before {
    opacity: 1;
  }
  
  .tippy-button:active {
    transform: translateY(0) scale(0.98);
  }
  
  /* Dark Mode Tippy.js */
  .dark .tippy-box[data-theme~='custom'] {
    background-color: #1e293b;
    color: #e2e8f0;
    box-shadow: 
      0 0 0 1px rgba(255, 255, 255, 0.1),
      0 20px 25px -5px rgba(0, 0, 0, 0.5),
      0 10px 10px -5px rgba(0, 0, 0, 0.3);
  }
  
  .dark .tippy-box[data-theme~='custom'][data-placement^='bottom'] > .tippy-arrow::before {
    border-bottom-color: #1e293b;
    filter: drop-shadow(0 -2px 2px rgba(0, 0, 0, 0.3));
  }
  
  .dark .tippy-box[data-theme~='custom'][data-placement^='top'] > .tippy-arrow::before {
    border-top-color: #1e293b;
    filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.3));
  }
  
  .dark .tippy-box[data-theme~='custom'][data-placement^='right'] > .tippy-arrow::before {
    border-right-color: #1e293b;
    filter: drop-shadow(-2px 0 2px rgba(0, 0, 0, 0.3));
  }
  
  .dark .tippy-box[data-theme~='custom'][data-placement^='left'] > .tippy-arrow::before {
    border-left-color: #1e293b;
    filter: drop-shadow(2px 0 2px rgba(0, 0, 0, 0.3));
  }
  
  .dark .tippy-button {
    color: #94a3b8;
  }
  
  .dark .tippy-button::before {
    background: radial-gradient(circle at center, rgba(96, 165, 250, 0.15) 0%, transparent 70%);
  }
  
  .dark .tippy-button:hover {
    background-color: #334155;
    color: #60a5fa;
  }

  /* --- Common Styles --- */
  .table-helper-operate-button {
    z-index: 3;
    opacity: 0.5;
    text-align: center;
    cursor: pointer;
    position: absolute;
    font-weight: 500;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
  }
  
  table.table-helper:hover .table-helper-operate-button {
    opacity: 0.7;
  }
  
  .table-helper-operate-button:hover {
    opacity: 1 !important;
    transform: scale(1.05);
  }
  
  .table-helper-operate-button:active {
    transform: scale(0.95);
  }
  
  .table-helper-operate-button.top, .table-helper-operate-button.bottom {
    width: ${edgeButtonSize * 1.2}px;
    height: ${edgeButtonSize * 0.6}px;
    border-radius: ${edgeButtonSize * 0.6}px;
  }
  
  .table-helper-operate-button.left, .table-helper-operate-button.right {
    width: ${edgeButtonSize * 0.6}px;
    height: ${edgeButtonSize * 1.2}px;
    border-radius: ${edgeButtonSize * 0.6}px;
  }
  
  .tippy-button i {
    display: block;
    width: 18px;
    height: 18px;
  }
  
  .alignment-options {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 4px;
    padding: 4px;
  }
  
  .alignment-options .tippy-button {
    aspect-ratio: 1;
    min-width: 36px;
  }
  `

    return styleNode
}