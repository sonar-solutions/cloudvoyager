// -------- Build Issue Match Key --------

/** Build a match key from rule + file component + line number. */
export function buildMatchKey(issue) {
  const rule = issue.rule;
  const component = issue.component || '';
  const filePath = component.includes(':') ? component.split(':').pop() : component;
  const line = issue.line || issue.textRange?.startLine || 0;

  if (!rule || !filePath) return null;
  return `${rule}|${filePath}|${line}`;
}
