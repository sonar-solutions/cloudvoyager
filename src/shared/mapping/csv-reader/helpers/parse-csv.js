// -------- Parse CSV String --------
import { parseRawRows } from './parse-raw-rows.js';

export function parseCsv(csvString) {
  const rawRows = parseRawRows(csvString);
  if (rawRows.length === 0) return { headers: [], rows: [] };

  const headers = rawRows[0].map(h => h.trim());
  const rows = [];
  for (let i = 1; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (row.length === 1 && row[0] === '') continue;
    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = j < row.length ? row[j].trim() : '';
    }
    rows.push(obj);
  }
  return { headers, rows };
}
