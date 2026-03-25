// -------- Resolve Line Count --------

export function resolveLineCount(file, components) {
  if (Array.isArray(file.lines)) return file.lines.length;
  if (typeof file.lines === 'string') return file.lines.split('\n').length;

  // Fallback: look up line count from components measures
  const comp = components?.find?.(c => c.key === file.key);
  const linesMeasure = comp?.measures?.find?.(m => m.metric === 'lines');
  return linesMeasure ? Number.parseInt(linesMeasure.value, 10) || 1 : 1;
}
