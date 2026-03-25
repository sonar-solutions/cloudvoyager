import { mapCleanCodeAttribute, defaultCleanCodeAttribute } from './enum-mappers.js';

// -------- Resolve CleanCodeAttribute for an External Issue --------

export function resolveCleanCodeAttr(issue, enrichment) {
  if (issue.cleanCodeAttribute) return { attr: mapCleanCodeAttribute(issue.cleanCodeAttribute), enriched: false };
  if (enrichment?.cleanCodeAttribute) return { attr: mapCleanCodeAttribute(enrichment.cleanCodeAttribute), enriched: true };
  return { attr: defaultCleanCodeAttribute(issue.type), enriched: false };
}
