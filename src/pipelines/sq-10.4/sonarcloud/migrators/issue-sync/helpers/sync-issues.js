import { matchIssues } from './match-issues.js';
import { syncSingleIssue } from './sync-single-issue.js';
import { createSyncStats } from './create-sync-stats.js';
import { logSyncStats } from './log-sync-stats.js';
import { mapConcurrent, createProgressLogger } from '../../../../../../shared/utils/concurrency.js';
import logger from '../../../../../../shared/utils/logger.js';

// -------- Main Logic --------

/**
 * Sync issue statuses, assignments, comments, and tags from SQ to SC.
 */
export async function syncIssues(projectKey, sqIssues, client, options = {}) {
  const concurrency = options.concurrency || 5;
  const sqClient = options.sqClient || null;
  const userMappings = options.userMappings || null;
  const stats = createSyncStats();

  const scIssues = await client.searchIssues(projectKey);
  logger.info(`Found ${scIssues.length} issues in SonarCloud, matching against ${sqIssues.length} SonarQube issues`);

  const matchedPairs = matchIssues(sqIssues, scIssues);
  stats.matched = matchedPairs.length;
  logger.info(`Matched ${matchedPairs.length} issues, syncing with concurrency=${concurrency}`);

  if (matchedPairs.length === 0) { logSyncStats(stats); return stats; }

  await mapConcurrent(
    matchedPairs,
    async ({ sqIssue, scIssue }) => syncSingleIssue(sqIssue, scIssue, client, sqClient, userMappings, stats),
    { concurrency, settled: true, onProgress: createProgressLogger(options.logPrefix ? `${options.logPrefix} Issue sync` : 'Issue sync', matchedPairs.length) },
  );

  logSyncStats(stats);
  return stats;
}
