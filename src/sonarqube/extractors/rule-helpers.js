export function mapSeverity(severity) {
  const severityMap = { 'INFO': 1, 'MINOR': 2, 'MAJOR': 3, 'CRITICAL': 4, 'BLOCKER': 5 };
  return severityMap[severity?.toUpperCase()] || 3;
}

export function extractImpacts(rule) {
  if (rule.impacts && Array.isArray(rule.impacts)) {
    return rule.impacts.map(impact => ({
      softwareQuality: mapSoftwareQuality(impact.softwareQuality),
      severity: mapImpactSeverity(impact.severity)
    }));
  }
  return inferImpactsFromType(rule);
}

function inferImpactsFromType(rule) {
  if (!rule.type) return [];
  const quality = inferQualityFromType(rule.type);
  if (quality <= 0) return [];
  return [{ softwareQuality: quality, severity: mapImpactSeverityFromRuleSeverity(rule.severity) }];
}

function mapSoftwareQuality(quality) {
  const qualityMap = { 'MAINTAINABILITY': 1, 'RELIABILITY': 2, 'SECURITY': 3 };
  return qualityMap[quality?.toUpperCase()] || 1;
}

function mapImpactSeverity(severity) {
  const severityMap = { 'LOW': 1, 'MEDIUM': 2, 'HIGH': 3, 'BLOCKER': 4 };
  return severityMap[severity?.toUpperCase()] || 2;
}

function inferQualityFromType(type) {
  const typeMap = { 'CODE_SMELL': 1, 'BUG': 2, 'VULNERABILITY': 3, 'SECURITY_HOTSPOT': 3 };
  return typeMap[type?.toUpperCase()] || 0;
}

function mapImpactSeverityFromRuleSeverity(severity) {
  const severityMap = { 'INFO': 1, 'MINOR': 1, 'MAJOR': 2, 'CRITICAL': 3, 'BLOCKER': 4 };
  return severityMap[severity?.toUpperCase()] || 2;
}
