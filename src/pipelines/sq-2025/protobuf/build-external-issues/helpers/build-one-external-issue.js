import { parseEffortToMinutes, mapIssueType } from './enum-mappers.js';
import { resolveCleanCodeAttr } from './resolve-clean-code-attr.js';
import { resolveImpacts } from './resolve-impacts.js';

// -------- Build One External Issue --------

/** Build a single ExternalIssue message from a SQ issue. */
export function buildOneExternalIssue(issue, builder, enrichment) {
  const ruleParts = issue.rule.split(':');
  const engineId = ruleParts[0] || 'unknown';
  const ruleId = ruleParts[1] || issue.rule;
  const componentRef = builder.componentRefMap.get(issue.component);

  const { attr: cleanCodeAttr, enriched } = resolveCleanCodeAttr(issue, enrichment);
  const impacts = resolveImpacts(issue, enrichment);

  const extIssue = {
    engineId, ruleId,
    msg: issue.message || '',
    severity: builder.mapSeverity(issue.severity),
    effort: parseEffortToMinutes(issue.effort || issue.debt),
    type: mapIssueType(issue.type),
    cleanCodeAttribute: cleanCodeAttr,
    impacts,
  };

  if (issue.textRange) {
    extIssue.textRange = {
      startLine: issue.textRange.startLine, endLine: issue.textRange.endLine,
      startOffset: issue.textRange.startOffset || 0, endOffset: issue.textRange.endOffset || 0,
    };
  }

  if (issue.flows && issue.flows.length > 0) {
    extIssue.flow = issue.flows.map(flow => ({
      location: (flow.locations || []).map(loc => ({
        componentRef: builder.componentRefMap.get(loc.component) || componentRef,
        textRange: loc.textRange ? { startLine: loc.textRange.startLine, endLine: loc.textRange.endLine, startOffset: loc.textRange.startOffset || 0, endOffset: loc.textRange.endOffset || 0 } : undefined,
        msg: loc.msg || '',
      })),
    }));
  }

  return { extIssue, engineId, ruleId, cleanCodeAttr, impacts, componentRef, enriched };
}
