import { mapSoftwareQuality, mapImpactSeverity } from './enum-mappers.js';
import { buildImpacts } from './build-impacts.js';

// -------- Resolve Impacts for an External Issue --------

export function resolveImpacts(issue, enrichment) {
  if (issue.impacts && issue.impacts.length > 0) return buildImpacts(issue);

  if (enrichment?.impacts?.length > 0) {
    return enrichment.impacts.map(impact => ({
      softwareQuality: mapSoftwareQuality(impact.softwareQuality) || mapSoftwareQuality(issue.type),
      severity: mapImpactSeverity(impact.severity),
    }));
  }

  return buildImpacts(issue);
}
