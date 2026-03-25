import { mapIssueType } from './enum-mappers.js';
import { parseEffortToMinutes } from './parse-effort.js';

// -------- Main Logic --------

// Build a single ExternalIssue protobuf message from a SQ issue.
export function buildSingleExternalIssue(issue, engineId, ruleId, builder, cleanCodeAttr, impacts) {
  const componentRef = builder.componentRefMap.get(issue.component);

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

  if (issue.flows?.length > 0) {
    externalIssue.flow = issue.flows.map(flow => ({
      location: (flow.locations || []).map(loc => ({
        componentRef: builder.componentRefMap.get(loc.component) || componentRef,
        textRange: loc.textRange ? {
          startLine: loc.textRange.startLine, endLine: loc.textRange.endLine,
          startOffset: loc.textRange.startOffset || 0, endOffset: loc.textRange.endOffset || 0,
        } : undefined,
        msg: loc.msg || '',
      })),
    }));
  }

  return { externalIssue, componentRef };
}
