import { mapCleanCodeAttribute, defaultCleanCodeAttribute } from './enum-mappers.js';

// -------- Resolve Clean Code Attribute --------

/**
 * Resolve cleanCodeAttribute: issue data -> SC enrichment -> type-based fallback.
 * Returns { cleanCodeAttr, wasEnriched }.
 */
export function resolveCleanCodeAttr(issue, enrichment) {
  if (issue.cleanCodeAttribute) {
    return { cleanCodeAttr: mapCleanCodeAttribute(issue.cleanCodeAttribute), wasEnriched: false };
  }
  if (enrichment?.cleanCodeAttribute) {
    return { cleanCodeAttr: mapCleanCodeAttribute(enrichment.cleanCodeAttribute), wasEnriched: true };
  }
  return { cleanCodeAttr: defaultCleanCodeAttribute(issue.type), wasEnriched: false };
}
