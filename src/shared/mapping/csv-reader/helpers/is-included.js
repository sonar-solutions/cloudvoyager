// -------- Check Include Column Value --------
export function isIncluded(value) {
  if (value == null || value === '') return true;
  const v = String(value).trim().toLowerCase();
  return v === 'yes' || v === 'true' || v === '1';
}
