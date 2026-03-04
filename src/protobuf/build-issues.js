import logger from '../utils/logger.js';
import { isExternalIssue } from './build-external-issues.js';

export function buildIssues(builder) {
  logger.info('Building issue messages...');

  const sonarCloudRepos = builder.sonarCloudRepos;
  const issuesByComponent = new Map();
  let skippedIssues = 0;

  builder.data.issues.forEach(issue => {
    // Skip issues whose rule repo is not in SonarCloud — they go through buildExternalIssues()
    if (isExternalIssue(issue, sonarCloudRepos)) return;

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

  const totalBuilt = [...issuesByComponent.values()].reduce((sum, arr) => sum + arr.length, 0);
  if (skippedIssues > 0) {
    logger.warn(`Skipped ${skippedIssues} issues (components without source code)`);
  }
  logger.info(`Built ${totalBuilt} issue messages across ${issuesByComponent.size} components`);
  return issuesByComponent;
}
