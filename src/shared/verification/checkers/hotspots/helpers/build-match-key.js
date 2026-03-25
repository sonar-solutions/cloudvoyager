// -------- Build Hotspot Match Key --------

/**
 * Build a match key for hotspots: ruleKey + file + line.
 */
export function buildHotspotMatchKey(hotspot) {
  const ruleKey = hotspot.ruleKey || hotspot.rule?.key || hotspot.securityCategory || '';
  const component = hotspot.component || '';
  const filePath = component.includes(':') ? component.split(':').pop() : component;
  const line = hotspot.line || hotspot.textRange?.startLine || 0;
  if (!ruleKey || !filePath) return null;
  return `${ruleKey}|${filePath}|${line}`;
}
