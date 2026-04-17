import logger from '../../../../../../shared/utils/logger.js';
import { mapConcurrent, createProgressLogger } from '../../../../../../shared/utils/concurrency.js';
import { fetchSqChangelogs } from '../../../../../../shared/utils/issue-sync/fetch-sq-changelogs.js';
import { hasManualChanges } from '../../../../../../shared/utils/issue-sync/has-manual-changes.js';
import { matchIssues } from './match-issues.js';
import { createEmptyStats } from './create-empty-stats.js';
import { logSyncStats } from './log-sync-stats.js';
import { syncIssueStatus } from './sync-issue-status.js';
import { syncIssueAssignment } from './sync-issue-assignment.js';
import { syncIssueCommentsAndTags } from './sync-issue-comments-and-tags.js';

// -------- Sync Issues from SonarQube to SonarCloud --------

export async function syncIssues(projectKey, sqIssues, client, options = {}) {
  const concurrency = options.concurrency || 5;
  const sqClient = options.sqClient || null;
  const userMappings = options.userMappings || null;
  const stats = createEmptyStats();

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
  logger.info(`Found ${scIssues.length} SC issues, matching against ${issuesToSync.length} SQ issues`);

  const matchedPairs = matchIssues(issuesToSync, scIssues);
  stats.matched = matchedPairs.length;
  logger.info(`Matched ${matchedPairs.length} issues, syncing with concurrency=${concurrency}`);

  if (matchedPairs.length === 0) { logSyncStats(stats); return stats; }

  await mapConcurrent(
    matchedPairs,
    async ({ sqIssue, scIssue }) => {
      try {
        const preloadedChangelog = changelogMap.get(sqIssue.key);
        const transitioned = await syncIssueStatus(scIssue, sqIssue, client, sqClient, preloadedChangelog);
        if (transitioned) stats.transitioned++;
        await syncIssueAssignment(scIssue, sqIssue, client, stats, userMappings);
        await syncIssueCommentsAndTags(scIssue, sqIssue, client, stats, sqClient);
      } catch (error) {
        stats.failed++;
        logger.debug(`Failed to sync issue ${sqIssue.key}: ${error.message}`);
      }
    },
    { concurrency, settled: true, onProgress: createProgressLogger('Issue sync', matchedPairs.length) },
  );

  logSyncStats(stats);
  return stats;
}
