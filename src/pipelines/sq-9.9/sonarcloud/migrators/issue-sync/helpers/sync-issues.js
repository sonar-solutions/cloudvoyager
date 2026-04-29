import logger from '../../../../../../shared/utils/logger.js';
import { mapConcurrent, createProgressLogger } from '../../../../../../shared/utils/concurrency.js';
import { isClosedOrFixed } from '../../../../../../shared/utils/issue-filters/is-closed-or-fixed.js';
import { applyManualChangesPreFilter } from '../../../../../../shared/utils/issue-sync/apply-pre-filter.js';
import { waitForScIndexing } from '../../../../../../shared/utils/issue-sync/wait-for-sc-indexing.js';
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

  const beforeFilter = sqIssues.length;
  let issuesToSync = sqIssues.filter(i => !isClosedOrFixed(i));
  if (issuesToSync.length < beforeFilter) {
    logger.info(`Filtered out ${beforeFilter - issuesToSync.length} closed/fixed issues`);
  }
  let changelogMap = new Map();

  if (sqClient) {
    ({ issuesToSync, changelogMap } = await applyManualChangesPreFilter(issuesToSync, sqClient, stats, concurrency));
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
