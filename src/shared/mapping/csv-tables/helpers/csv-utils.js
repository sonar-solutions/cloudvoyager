// -------- CSV Utilities --------
export function escapeCsv(value) {
  if (value == null) return '';
  const str = String(value);
  if (/^[=+\-@]/.test(str)) return `"'${str.replaceAll('"', '""')}"`;
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replaceAll('"', '""')}"`;
  }
  return str;
}

export function toCsvRow(values) {
  return values.map(escapeCsv).join(',');
}
