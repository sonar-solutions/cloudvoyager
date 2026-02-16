import logger from '../../utils/logger.js';
import { IssueData } from '../models.js';

/**
 * Extract issues from SonarQube
 * @param {SonarQubeClient} client - SonarQube client
 * @param {object} state - State tracker for incremental sync
 * @param {string} branch - Branch name (optional)
 * @returns {Promise<Array<IssueData>>}
 */
export async function extractIssues(client, state = null, branch = null) {
  logger.info('Extracting issues...');

  const filters = {};

  // Add branch filter if specified
  if (branch) {
    filters.branch = branch;
  }

  // Add incremental filter if state exists
  if (state && state.lastSync) {
    filters.createdAfter = state.lastSync;
    logger.info(`Incremental sync: fetching issues created after ${state.lastSync}`);
  }

  const issues = await client.getIssues(filters);
  logger.info(`Extracted ${issues.length} issues`);

  // Convert to IssueData models
  const issueData = issues.map(issue => new IssueData(issue));

  // Log issue breakdown by severity
  const severityCounts = {};
  issueData.forEach(issue => {
    severityCounts[issue.severity] = (severityCounts[issue.severity] || 0) + 1;
  });

  logger.info('Issue breakdown by severity:');
  Object.entries(severityCounts).forEach(([severity, count]) => {
    logger.info(`  ${severity}: ${count}`);
  });

  return issueData;
}
