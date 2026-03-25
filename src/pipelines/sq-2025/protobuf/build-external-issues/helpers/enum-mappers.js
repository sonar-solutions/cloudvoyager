// -------- Enum Mappers for External Issues --------

/** Parse SQ effort string (e.g. "30min", "2h") to minutes. */
export function parseEffortToMinutes(effort) {
  if (!effort) return 0;
  if (typeof effort === 'number') return effort;
  let minutes = 0;
  const hourMatch = effort.match(/(\d+)h/);
  const minMatch = effort.match(/(\d+)min/);
  if (hourMatch) minutes += Number.parseInt(hourMatch[1], 10) * 60;
  if (minMatch) minutes += Number.parseInt(minMatch[1], 10);
  return minutes;
}

/** Map SQ issue type to IssueType protobuf enum. */
export function mapIssueType(type) {
  return { 'CODE_SMELL': 1, 'BUG': 2, 'VULNERABILITY': 3, 'SECURITY_HOTSPOT': 4 }[type] || 1;
}

/** Map SQ type/quality to SoftwareQuality protobuf enum. */
export function mapSoftwareQuality(type) {
  return { 'MAINTAINABILITY': 1, 'RELIABILITY': 2, 'SECURITY': 3, 'CODE_SMELL': 1, 'BUG': 2, 'VULNERABILITY': 3, 'SECURITY_HOTSPOT': 3 }[type] || 1;
}

/** Map SQ impact severity to ImpactSeverity protobuf enum. */
export function mapImpactSeverity(severity) {
  return { 'LOW': 1, 'MEDIUM': 2, 'HIGH': 3, 'INFO': 4, 'BLOCKER': 5 }[severity] || 2;
}

/** Map old-style issue severity to ImpactSeverity. */
export function mapOldSeverityToImpact(severity) {
  return { 'INFO': 1, 'MINOR': 1, 'MAJOR': 2, 'CRITICAL': 3, 'BLOCKER': 3 }[severity] || 2;
}

/** Map CleanCodeAttribute name to protobuf enum value. */
export function mapCleanCodeAttribute(attr) {
  return { 'CONVENTIONAL': 1, 'FORMATTED': 2, 'IDENTIFIABLE': 3, 'CLEAR': 4, 'COMPLETE': 5, 'EFFICIENT': 6, 'LOGICAL': 7, 'DISTINCT': 8, 'FOCUSED': 9, 'MODULAR': 10, 'TESTED': 11, 'LAWFUL': 12, 'RESPECTFUL': 13, 'TRUSTWORTHY': 14 }[attr] || 1;
}

/** Derive default cleanCodeAttribute enum from issue type. */
export function defaultCleanCodeAttribute(type) {
  return { 'CODE_SMELL': 1, 'BUG': 7, 'VULNERABILITY': 14, 'SECURITY_HOTSPOT': 14 }[type] || 1;
}
