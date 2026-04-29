import logger from '../../../../../shared/utils/logger.js';
import { mapConcurrent, createProgressLogger } from '../../../../../shared/utils/concurrency.js';
import { parallelSyncIssues } from '../../../../../shared/utils/concurrency/helpers/parallel-issue-sync.js';
import { isClosedOrFixed } from '../../../../../shared/utils/issue-filters/is-closed-or-fixed.js';
import { applyManualChangesPreFilter } from '../../../../../shared/utils/issue-sync/apply-pre-filter.js';
import { waitForScIndexing } from '../../../../../shared/utils/issue-sync/wait-for-sc-indexing.js';
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

  const beforeFilter = sqIssues.length;
  let issuesToSync = sqIssues.filter(i => !isClosedOrFixed(i));
  if (issuesToSync.length < beforeFilter) {
    logger.info(`Filtered out ${beforeFilter - issuesToSync.length} closed/fixed issues`);
  }
  let changelogMap = new Map();

  if (sqClient) {
    ({ issuesToSync, changelogMap } = await applyManualChangesPreFilter(issuesToSync, sqClient, stats, concurrency));
    if (issuesToSync.length === 0) { logSyncSummary(stats); return stats; }
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

  if (matchedPairs.length === 0) {
    logSyncSummary(stats);
    return stats;
  }

  const PARALLEL_THRESHOLD = 500;
  if (matchedPairs.length >= PARALLEL_THRESHOLD) {
    const scConfig = { baseURL: client.baseURL, token: client.token, organization: client.organization, projectKey };
    const sqClientConfig = sqClient ? { baseURL: sqClient.baseURL, token: sqClient.token, projectKey: sqClient.projectKey } : null;
    const mergedStats = await parallelSyncIssues(matchedPairs, changelogMap, scConfig, sqClientConfig, userMappings);
    Object.assign(stats, mergedStats);
  } else {
    logger.info(`Syncing ${matchedPairs.length} issues with concurrency=${concurrency}`);
    await mapConcurrent(
      matchedPairs,
      async (pair) => syncOneIssue(pair, client, sqClient, userMappings, stats, changelogMap),
      { concurrency, settled: true, onProgress: createProgressLogger('Issue sync', matchedPairs.length) },
    );
  }

  logSyncSummary(stats);
  return stats;
}

/** Log the final sync summary. */
function logSyncSummary(stats) {
  const filtered = stats.filtered > 0 ? `${stats.filtered} filtered, ` : '';
  const mapped = stats.assignmentMapped > 0 ? `, ${stats.assignmentMapped} mapped` : '';
  const skipped = stats.assignmentSkipped > 0 ? `, ${stats.assignmentSkipped} assignment-skipped` : '';
  const apiErr = stats.apiErrors > 0 ? `, ${stats.apiErrors} api-errors` : '';
  logger.info(`Issue sync: ${filtered}${stats.matched} matched, ${stats.transitioned} transitioned, ${stats.assigned} assigned${mapped}, ${stats.assignmentFailed} assignment-failed${skipped}, ${stats.commented} comments, ${stats.tagged} tagged, ${stats.metadataSyncTagged} metadata-sync-tagged, ${stats.sourceLinked} source-linked, ${stats.failed} failed${apiErr}`);
}
