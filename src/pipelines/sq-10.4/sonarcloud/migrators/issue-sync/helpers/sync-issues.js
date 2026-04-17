import { matchIssues } from './match-issues.js';
import { syncSingleIssue } from './sync-single-issue.js';
import { createSyncStats } from './create-sync-stats.js';
import { logSyncStats } from './log-sync-stats.js';
import { mapConcurrent, createProgressLogger } from '../../../../../../shared/utils/concurrency.js';
import { fetchSqChangelogs } from '../../../../../../shared/utils/issue-sync/fetch-sq-changelogs.js';
import { hasManualChanges } from '../../../../../../shared/utils/issue-sync/has-manual-changes.js';
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
  const changelogMap = new Map();

  if (sqClient) {
    const fetched = await fetchSqChangelogs(sqIssues, sqClient, concurrency);
    for (const [k, v] of fetched) changelogMap.set(k, v);
    const before = sqIssues.length;
    issuesToSync = sqIssues.filter(issue => hasManualChanges(issue, changelogMap.get(issue.key) ?? []));
    stats.filtered = before - issuesToSync.length;
    logger.info(`Pre-filtered ${stats.filtered} issues with no manual changes; ${issuesToSync.length} remaining`);
    if (issuesToSync.length === 0) { logSyncStats(stats); return stats; }
  }

  const scIssues = await client.searchIssues(projectKey);
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
