import { mapIssueType } from './enum-mappers.js';
import { parseEffortToMinutes } from './parse-effort-to-minutes.js';
import { resolveCleanCodeAttr } from './resolve-clean-code-attr.js';
import { resolveImpacts } from './resolve-impacts.js';

// -------- Build External Issue Message --------

/**
 * Build a single ExternalIssue protobuf message from a SQ issue.
 * Returns { externalIssue, cleanCodeAttr, impacts, wasEnriched }.
 */
export function buildExternalIssueMsg(issue, engineId, ruleId, enrichment, builder) {
  const { cleanCodeAttr, wasEnriched } = resolveCleanCodeAttr(issue, enrichment);
  const impacts = resolveImpacts(issue, enrichment);

  const externalIssue = {
    engineId, ruleId,
    msg: issue.message || '',
    severity: builder.mapSeverity(issue.severity),
    effort: parseEffortToMinutes(issue.effort || issue.debt),
    type: mapIssueType(issue.type),
    cleanCodeAttribute: cleanCodeAttr,
    impacts,
  };

  if (issue.textRange) {
    externalIssue.textRange = {
      startLine: issue.textRange.startLine, endLine: issue.textRange.endLine,
      startOffset: issue.textRange.startOffset || 0, endOffset: issue.textRange.endOffset || 0,
    };
  }

  return { externalIssue, cleanCodeAttr, impacts, wasEnriched };
}
