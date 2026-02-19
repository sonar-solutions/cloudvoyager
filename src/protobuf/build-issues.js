import logger from '../utils/logger.js';

export function buildIssues(builder) {
  logger.info('Building issue messages...');

  const issuesByComponent = new Map();
  let skippedIssues = 0;

  builder.data.issues.forEach(issue => {
    if (!builder.validComponentKeys?.has(issue.component)) {
      skippedIssues++;
      return;
    }
    const componentRef = builder.componentRefMap.get(issue.component);

    if (!issuesByComponent.has(componentRef)) {
      issuesByComponent.set(componentRef, []);
    }

    const ruleParts = issue.rule.split(':');
    const ruleRepository = ruleParts[0] || '';
    const ruleKey = ruleParts[1] || issue.rule;

    const issueMsg = {
      ruleRepository: ruleRepository,
      ruleKey: ruleKey,
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

    issuesByComponent.get(componentRef).push(issueMsg);
  });

  if (skippedIssues > 0) {
    logger.warn(`Skipped ${skippedIssues} issues (components without source code)`);
  }
  logger.info(`Built ${builder.data.issues.length - skippedIssues} issue messages across ${issuesByComponent.size} components`);
  return issuesByComponent;
}
