import { mapSoftwareQuality, mapImpactSeverity, mapOldSeverityToImpact } from './enum-mappers.js';

// -------- Build Impacts --------

/**
 * Build impacts array for an ExternalIssue from the SonarQube issue data.
 * Uses the issue's impacts field if available, otherwise derives from type/severity.
 */
export function buildImpacts(issue) {
  if (issue.impacts && issue.impacts.length > 0) {
    return issue.impacts.map(impact => ({
      softwareQuality: mapSoftwareQuality(impact.softwareQuality) || mapSoftwareQuality(issue.type),
      severity: mapImpactSeverity(impact.severity),
    }));
  }
  return [{
    softwareQuality: mapSoftwareQuality(issue.type),
    severity: mapOldSeverityToImpact(issue.severity),
  }];
}
