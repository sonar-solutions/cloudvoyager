import { mapSoftwareQuality, mapImpactSeverity, mapOldSeverityToImpact } from './enum-mappers.js';

// -------- Build Impacts Array for an External Issue --------

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
