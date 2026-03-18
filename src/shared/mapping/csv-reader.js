import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import logger from '../utils/logger.js';

/**
 * Parse a CSV string into an array of row objects (RFC 4180 compliant).
 * First row is treated as headers. Returns { headers, rows }.
 *
 * @param {string} csvString - Raw CSV content
 * @returns {{ headers: string[], rows: object[] }}
 */
export function parseCsv(csvString) {
  const rawRows = parseRawRows(csvString);
  if (rawRows.length === 0) return { headers: [], rows: [] };

  const headers = rawRows[0].map(h => h.trim());
  const rows = [];
  for (let i = 1; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (row.length === 1 && row[0] === '') continue; // skip empty lines
    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = j < row.length ? row[j].trim() : '';
    }
    rows.push(obj);
  }
  return { headers, rows };
}

/**
 * Parse CSV string into a 2D array of raw field values (state machine parser).
 */
function parseRawRows(csvString) {
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
        } else {
          inQuotes = false;
          i++;
        }
      } else {
        currentField += ch;
        i++;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
        i++;
      } else if (ch === ',') {
        currentRow.push(currentField);
        currentField = '';
        i++;
      } else if (ch === '\r') {
        currentRow.push(currentField);
        currentField = '';
        rows.push(currentRow);
        currentRow = [];
        i++;
        if (i < csvString.length && csvString[i] === '\n') i++;
      } else if (ch === '\n') {
        currentRow.push(currentField);
        currentField = '';
        rows.push(currentRow);
        currentRow = [];
        i++;
      } else {
        currentField += ch;
        i++;
      }
    }
  }

  // Push last field/row if there's remaining data
  if (currentField !== '' || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  return rows;
}

/**
 * Read and parse a single CSV file.
 * @param {string} filePath - Absolute path to CSV file
 * @returns {Promise<{ headers: string[], rows: object[] }>}
 */
export async function parseCsvFile(filePath) {
  const content = await readFile(filePath, 'utf-8');
  return parseCsv(content);
}

/**
 * Load all CSV files from a mappings directory.
 * @param {string} mappingsDir - Path to the mappings directory
 * @returns {Promise<Map<string, { headers: string[], rows: object[] }>>}
 */
export async function loadMappingCsvs(mappingsDir) {
  const csvMap = new Map();
  let entries;
  try {
    entries = await readdir(mappingsDir);
  } catch {
    return csvMap;
  }

  const csvFiles = entries.filter(f => f.endsWith('.csv'));
  for (const fileName of csvFiles) {
    try {
      const parsed = await parseCsvFile(join(mappingsDir, fileName));
      if (parsed.headers.length > 0 && parsed.rows.length > 0) {
        csvMap.set(fileName, parsed);
        logger.debug(`Loaded CSV: ${fileName} (${parsed.rows.length} rows)`);
      }
    } catch (error) {
      logger.warn(`Failed to parse ${fileName}: ${error.message}`);
    }
  }

  return csvMap;
}

/**
 * Check if an Include column value means "included".
 * @param {string} value - The Include cell value
 * @returns {boolean}
 */
export function isIncluded(value) {
  if (value == null || value === '') return true; // default include
  const v = String(value).trim().toLowerCase();
  return v === 'yes' || v === 'true' || v === '1';
}
