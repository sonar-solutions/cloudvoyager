import logger from '../../../../../shared/utils/logger.js';
import { mapConcurrent, createProgressLogger } from '../../../../../shared/utils/concurrency.js';
import { fetchSqChangelogs } from '../../../../../shared/utils/issue-sync/fetch-sq-changelogs.js';
import { hasManualChanges } from '../../../../../shared/utils/issue-sync/has-manual-changes.js';
import { matchIssues } from './helpers/match-issues.js';
import { syncOneIssue } from './helpers/sync-one-issue.js';
import { createSyncStats } from './helpers/create-sync-stats.js';

// -------- Re-exports --------

export { mapChangelogDiffToTransition } from './helpers/map-changelog-diff.js';
export { extractTransitionsFromChangelog } from './helpers/extract-transitions.js';

// -------- Sync Issues --------

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
  }

  const scIssues = await client.searchIssues(projectKey);
  logger.info(`Found ${scIssues.length} SC issues, matching against ${issuesToSync.length} SQ issues`);

  const matchedPairs = matchIssues(issuesToSync, scIssues);
  stats.matched = matchedPairs.length;

  if (matchedPairs.length === 0) {
    logSyncSummary(stats);
    return stats;
  }

  logger.info(`Syncing ${matchedPairs.length} issues with concurrency=${concurrency}`);
  await mapConcurrent(
    matchedPairs,
    async (pair) => syncOneIssue(pair, client, sqClient, userMappings, stats, changelogMap),
    { concurrency, settled: true, onProgress: createProgressLogger('Issue sync', matchedPairs.length) },
  );

  logSyncSummary(stats);
  return stats;
}

/** Log the final sync summary. */
function logSyncSummary(stats) {
  const filtered = stats.filtered > 0 ? `${stats.filtered} filtered, ` : '';
  const mapped = stats.assignmentMapped > 0 ? `, ${stats.assignmentMapped} mapped` : '';
  const skipped = stats.assignmentSkipped > 0 ? `, ${stats.assignmentSkipped} assignment-skipped` : '';
  logger.info(`Issue sync: ${filtered}${stats.matched} matched, ${stats.transitioned} transitioned, ${stats.assigned} assigned${mapped}, ${stats.assignmentFailed} assignment-failed${skipped}, ${stats.commented} comments, ${stats.tagged} tagged, ${stats.metadataSyncTagged} metadata-sync-tagged, ${stats.sourceLinked} source-linked, ${stats.failed} failed`);
}
