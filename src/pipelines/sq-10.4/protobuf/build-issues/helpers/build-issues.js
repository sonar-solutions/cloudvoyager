import logger from '../../../../../shared/utils/logger.js';
import { isExternalIssue } from '../../build-external-issues.js';
import { isClosedOrFixed } from '../../../../../shared/utils/issue-filters/is-closed-or-fixed.js';
import { buildIssueMessage } from './build-issue-message.js';

// -------- Main Logic --------

// Build issue protobuf messages grouped by component.
export function buildIssues(builder) {
  logger.info('Building issue messages...');

  const sonarCloudRepos = builder.sonarCloudRepos;
  const issuesByComponent = new Map();
  let skippedIssues = 0;

  builder.data.issues.forEach(issue => {
    if (isClosedOrFixed(issue)) return;
    if (isExternalIssue(issue, sonarCloudRepos)) return;

    if (!builder.validComponentKeys?.has(issue.component)) {
      skippedIssues++;
      return;
    }

    const componentRef = builder.componentRefMap.get(issue.component);
    if (!issuesByComponent.has(componentRef)) issuesByComponent.set(componentRef, []);

    issuesByComponent.get(componentRef).push(buildIssueMessage(issue, builder));
  });

  const totalBuilt = [...issuesByComponent.values()].reduce((sum, arr) => sum + arr.length, 0);
  if (skippedIssues > 0) logger.warn(`Skipped ${skippedIssues} issues (components without source code)`);
  logger.info(`Built ${totalBuilt} issue messages across ${issuesByComponent.size} components`);
  return issuesByComponent;
}
