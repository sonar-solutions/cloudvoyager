import { mapSoftwareQuality, mapImpactSeverity, mapOldSeverityToImpact } from './enum-mappers.js';

// -------- Main Logic --------

// Build impacts array for an ExternalIssue from the SonarQube issue data.
export function buildImpacts(issue) {
  if (issue.impacts?.length > 0) {
    return issue.impacts.map(impact => ({
      softwareQuality: mapSoftwareQuality(impact.softwareQuality) || mapSoftwareQuality(issue.type),
      severity: mapImpactSeverity(impact.severity),
    }));
  }
  // Fallback: derive from old-style type + severity
  return [{
    softwareQuality: mapSoftwareQuality(issue.type),
    severity: mapOldSeverityToImpact(issue.severity),
  }];
}
