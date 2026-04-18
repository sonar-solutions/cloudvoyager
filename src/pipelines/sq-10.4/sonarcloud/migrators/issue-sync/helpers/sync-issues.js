import { matchIssues } from './match-issues.js';
import { syncSingleIssue } from './sync-single-issue.js';
import { createSyncStats } from './create-sync-stats.js';
import { logSyncStats } from './log-sync-stats.js';
import { mapConcurrent, createProgressLogger } from '../../../../../../shared/utils/concurrency.js';
import { applyManualChangesPreFilter } from '../../../../../../shared/utils/issue-sync/apply-pre-filter.js';
import { waitForScIndexing } from '../../../../../../shared/utils/issue-sync/wait-for-sc-indexing.js';
import logger from '../../../../../../shared/utils/logger.js';

// -------- Main Logic --------

/**
 * Sync issue statuses, assignments, comments, and tags from SQ to SC.
 * Pre-filters SQ issues to only those with manual changes for efficiency.
 */
export async function syncIssues(projectKey, sqIssues, client, options = {}) {
  const concurrency = options.concurrency || 5;
  const sqClient = options.sqClient || null;
  const userMappings = options.userMappings || null;
  const stats = createSyncStats();

  let issuesToSync = sqIssues;
  let changelogMap = new Map();

  if (sqClient) {
    ({ issuesToSync, changelogMap } = await applyManualChangesPreFilter(sqIssues, sqClient, stats, concurrency));
    if (issuesToSync.length === 0) { logSyncStats(stats); return stats; }
  }

  let scIssues = await client.searchIssues(projectKey);
  if (scIssues.length === 0 && issuesToSync.length > 0) {
    scIssues = await waitForScIndexing(
      () => client.searchIssues(projectKey),
      issuesToSync.length,
      { label: 'issues', projectKey },
    );
  }
  logger.info(`Found ${scIssues.length} issues in SonarCloud, matching against ${issuesToSync.length} SonarQube issues`);

  const matchedPairs = matchIssues(issuesToSync, scIssues);
  stats.matched = matchedPairs.length;
  logger.info(`Matched ${matchedPairs.length} issues, syncing with concurrency=${concurrency}`);

  if (matchedPairs.length === 0) { logSyncStats(stats); return stats; }

  await mapConcurrent(
    matchedPairs,
    async ({ sqIssue, scIssue }) => syncSingleIssue(sqIssue, scIssue, client, sqClient, userMappings, stats, changelogMap),
    { concurrency, settled: true, onProgress: createProgressLogger('Issue sync', matchedPairs.length) },
  );

  logSyncStats(stats);
  return stats;
}
