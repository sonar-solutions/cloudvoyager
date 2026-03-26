import logger from '../../../../shared/utils/logger.js';
import { processExternalIssues } from './helpers/process-external-issues.js';
import { logExternalIssuesSummary } from './helpers/log-external-issues-summary.js';

// -------- Re-export --------

export { isExternalIssue } from './helpers/is-external-issue.js';

// -------- Build External Issues --------

export function buildExternalIssues(builder) {
  const sonarCloudRepos = builder.sonarCloudRepos;

  if (!sonarCloudRepos || sonarCloudRepos.size === 0) {
    logger.warn('No SonarCloud repositories available — using fallback built-in repo list');
  }

  logger.info('Auto-detecting external issues (rule repos not in SonarCloud)...');

  const result = processExternalIssues(builder, sonarCloudRepos);
  logExternalIssuesSummary(result.externalIssuesByComponent, result.adHocRules, result.detectedEngines, result.skippedIssues, result.enrichedCount);

  return { externalIssuesByComponent: result.externalIssuesByComponent, adHocRules: [...result.adHocRules.values()] };
}
