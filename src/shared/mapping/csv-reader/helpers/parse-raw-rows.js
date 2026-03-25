// -------- RFC 4180 CSV State Machine Parser --------
export function parseRawRows(csvString) {
  const rows = [];
  let currentRow = [];
  let currentField = '';
  let inQuotes = false;
  let i = 0;

  while (i < csvString.length) {
    const ch = csvString[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < csvString.length && csvString[i + 1] === '"') {
          currentField += '"';
          i += 2;
        } else { inQuotes = false; i++; }
      } else { currentField += ch; i++; }
    } else {
      if (ch === '"') { inQuotes = true; i++; }
      else if (ch === ',') { currentRow.push(currentField); currentField = ''; i++; }
      else if (ch === '\r') {
        currentRow.push(currentField); currentField = '';
        rows.push(currentRow); currentRow = [];
        i++;
        if (i < csvString.length && csvString[i] === '\n') i++;
      } else if (ch === '\n') {
        currentRow.push(currentField); currentField = '';
        rows.push(currentRow); currentRow = [];
        i++;
      } else { currentField += ch; i++; }
    }
  }

  if (currentField !== '' || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }
  return rows;
}
