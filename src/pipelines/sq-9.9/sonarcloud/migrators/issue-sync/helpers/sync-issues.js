import logger from '../../../../../../shared/utils/logger.js';
import { mapConcurrent, createProgressLogger } from '../../../../../../shared/utils/concurrency.js';
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

  const scIssues = await client.searchIssues(projectKey);
  logger.info(`Found ${scIssues.length} SC issues, matching against ${sqIssues.length} SQ issues`);

  const matchedPairs = matchIssues(sqIssues, scIssues);
  stats.matched = matchedPairs.length;
  logger.info(`Matched ${matchedPairs.length} issues, syncing with concurrency=${concurrency}`);

  if (matchedPairs.length === 0) { logSyncStats(stats); return stats; }

  await mapConcurrent(
    matchedPairs,
    async ({ sqIssue, scIssue }) => {
      try {
        const transitioned = await syncIssueStatus(scIssue, sqIssue, client, sqClient);
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
