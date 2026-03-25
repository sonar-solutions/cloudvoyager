// -------- Create Issue Data --------

export function createIssueData(issue) {
  return {
    key: issue.key,
    rule: issue.rule,
    severity: issue.severity,
    component: issue.component,
    project: issue.project,
    line: issue.line,
    hash: issue.hash,
    textRange: issue.textRange,
    flows: issue.flows || [],
    status: issue.status,
    message: issue.message,
    effort: issue.effort,
    debt: issue.debt,
    author: issue.author,
    tags: issue.tags || [],
    creationDate: issue.creationDate,
    updateDate: issue.updateDate,
    type: issue.type,
    cleanCodeAttribute: issue.cleanCodeAttribute || null,
    impacts: issue.impacts || [],
  };
}
