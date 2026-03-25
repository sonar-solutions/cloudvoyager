// -------- Protobuf Enum Mappers for External Issues --------

export function mapIssueType(type) {
  const typeMap = { 'CODE_SMELL': 1, 'BUG': 2, 'VULNERABILITY': 3, 'SECURITY_HOTSPOT': 4 };
  return typeMap[type] || 1;
}

export function mapSoftwareQuality(type) {
  const qualityMap = {
    'MAINTAINABILITY': 1, 'RELIABILITY': 2, 'SECURITY': 3,
    'CODE_SMELL': 1, 'BUG': 2, 'VULNERABILITY': 3, 'SECURITY_HOTSPOT': 3,
  };
  return qualityMap[type] || 1;
}

export function mapImpactSeverity(severity) {
  const sevMap = { 'LOW': 1, 'MEDIUM': 2, 'HIGH': 3, 'INFO': 4, 'BLOCKER': 5 };
  return sevMap[severity] || 2;
}

export function mapOldSeverityToImpact(severity) {
  const sevMap = { 'INFO': 1, 'MINOR': 1, 'MAJOR': 2, 'CRITICAL': 3, 'BLOCKER': 3 };
  return sevMap[severity] || 2;
}

export function mapCleanCodeAttribute(attr) {
  const attrMap = {
    'CONVENTIONAL': 1, 'FORMATTED': 2, 'IDENTIFIABLE': 3, 'CLEAR': 4, 'COMPLETE': 5,
    'EFFICIENT': 6, 'LOGICAL': 7, 'DISTINCT': 8, 'FOCUSED': 9, 'MODULAR': 10,
    'TESTED': 11, 'LAWFUL': 12, 'RESPECTFUL': 13, 'TRUSTWORTHY': 14,
  };
  return attrMap[attr] || 1;
}

export function defaultCleanCodeAttribute(type) {
  const attrMap = { 'CODE_SMELL': 1, 'BUG': 7, 'VULNERABILITY': 14, 'SECURITY_HOTSPOT': 14 };
  return attrMap[type] || 1;
}
