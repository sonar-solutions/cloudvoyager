// -------- PDF Table Utilities --------

/** Create a table header cell */
export function h(text) {
  return { text, style: 'tableHeader' };
}

/** Truncate text to maxLen characters */
export function truncate(text, maxLen) {
  if (!text) return '';
  return text.length > maxLen ? text.slice(0, maxLen - 1) + '…' : text;
}

/** Create a small detail table node for the PDF */
export function smallTable(rows, widths) {
  return {
    table: { headerRows: 1, widths, body: rows },
    layout: 'lightHorizontalLines',
    fontSize: 7,
    margin: [0, 0, 0, 5],
  };
}
