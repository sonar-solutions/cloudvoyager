// -------- Build Issue Message --------

export function buildIssueMessage(issue, builder) {
  const ruleParts = issue.rule.split(':');
  const ruleRepository = ruleParts[0] || '';
  const ruleKey = ruleParts[1] || issue.rule;

  const issueMsg = {
    ruleRepository,
    ruleKey,
    msg: issue.message || '',
    overriddenSeverity: builder.mapSeverity(issue.severity),
  };

  if (issue.textRange) {
    issueMsg.textRange = {
      startLine: issue.textRange.startLine,
      endLine: issue.textRange.endLine,
      startOffset: issue.textRange.startOffset || 0,
      endOffset: issue.textRange.endOffset || 0
    };
  }

  return issueMsg;
}
