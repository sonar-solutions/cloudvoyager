import logger from '../../../../../shared/utils/logger.js';
import { mapConcurrent, createProgressLogger } from '../../../../../shared/utils/concurrency.js';
import { matchIssues } from './helpers/match-issues.js';
import { syncOneIssue } from './helpers/sync-one-issue.js';
import { createSyncStats } from './helpers/create-sync-stats.js';

// -------- Re-exports --------

export { mapChangelogDiffToTransition } from './helpers/map-changelog-diff.js';
export { extractTransitionsFromChangelog } from './helpers/extract-transitions.js';

// -------- Sync Issues --------

/**
 * Sync issue statuses, assignments, comments, and tags from SQ to SC.
 */
export async function syncIssues(projectKey, sqIssues, client, options = {}) {
  const concurrency = options.concurrency || 5;
  const sqClient = options.sqClient || null;
  const userMappings = options.userMappings || null;
  const stats = createSyncStats();

  const scIssues = await client.searchIssues(projectKey);
  logger.info(`Found ${scIssues.length} SC issues, matching against ${sqIssues.length} SQ issues`);

  const matchedPairs = matchIssues(sqIssues, scIssues);
  stats.matched = matchedPairs.length;

  if (matchedPairs.length === 0) {
    logSyncSummary(stats);
    return stats;
  }

  logger.info(`Syncing ${matchedPairs.length} issues with concurrency=${concurrency}`);
  await mapConcurrent(
    matchedPairs,
    async (pair) => syncOneIssue(pair, client, sqClient, userMappings, stats),
    { concurrency, settled: true, onProgress: createProgressLogger('Issue sync', matchedPairs.length) },
  );

  logSyncSummary(stats);
  return stats;
}

/** Log the final sync summary. */
function logSyncSummary(stats) {
  const mapped = stats.assignmentMapped > 0 ? `, ${stats.assignmentMapped} mapped` : '';
  const skipped = stats.assignmentSkipped > 0 ? `, ${stats.assignmentSkipped} assignment-skipped` : '';
  logger.info(`Issue sync: ${stats.matched} matched, ${stats.transitioned} transitioned, ${stats.assigned} assigned${mapped}, ${stats.assignmentFailed} assignment-failed${skipped}, ${stats.commented} comments, ${stats.tagged} tagged, ${stats.metadataSyncTagged} metadata-sync-tagged, ${stats.sourceLinked} source-linked, ${stats.failed} failed`);
}
