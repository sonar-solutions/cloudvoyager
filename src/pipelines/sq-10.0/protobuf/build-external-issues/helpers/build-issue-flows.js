// -------- Build Issue Flows --------

/**
 * Attach flow data to an external issue if the SQ issue has flows.
 */
export function buildIssueFlows(externalIssue, issue, builder, componentRef) {
  if (!issue.flows || issue.flows.length === 0) return;

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
