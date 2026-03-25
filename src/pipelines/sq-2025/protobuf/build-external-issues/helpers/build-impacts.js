import { mapSoftwareQuality, mapImpactSeverity, mapOldSeverityToImpact } from './enum-mappers.js';

// -------- Build Impacts --------

/** Build impacts array for an ExternalIssue from the SQ issue data. */
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
