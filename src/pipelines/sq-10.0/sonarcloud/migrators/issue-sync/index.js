import logger from '../../../../../shared/utils/logger.js';
import { mapConcurrent, createProgressLogger } from '../../../../../shared/utils/concurrency.js';
import { applyManualChangesPreFilter } from '../../../../../shared/utils/issue-sync/apply-pre-filter.js';
import { waitForScIndexing } from '../../../../../shared/utils/issue-sync/wait-for-sc-indexing.js';
import { matchIssues } from './helpers/match-issues.js';
import { syncSingleIssue } from './helpers/sync-single-issue.js';
import { createEmptyStats } from './helpers/create-empty-stats.js';
import { logSyncSummary } from './helpers/log-sync-summary.js';

// -------- Re-exports for public API --------

export { mapChangelogDiffToTransition, extractTransitionsFromChangelog } from './helpers/transition-mapping.js';

// -------- Sync Issues Orchestrator --------

export async function syncIssues(projectKey, sqIssues, client, options = {}) {
  const concurrency = options.concurrency || 5;
  const sqClient = options.sqClient || null;
  const userMappings = options.userMappings || null;
  const stats = createEmptyStats();

  let issuesToSync = sqIssues;
  let changelogMap = new Map();

  if (sqClient) {
    ({ issuesToSync, changelogMap } = await applyManualChangesPreFilter(sqIssues, sqClient, stats, concurrency));
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
  logger.info(`Found ${scIssues.length} issues in SonarCloud, matching against ${issuesToSync.length} SonarQube issues`);
  const matchedPairs = matchIssues(issuesToSync, scIssues);
  stats.matched = matchedPairs.length;
  logger.info(`Matched ${matchedPairs.length} issues, syncing with concurrency=${concurrency}`);
  if (matchedPairs.length === 0) { logSyncSummary(stats); return stats; }
  const progressLogger = createProgressLogger('Issue sync', matchedPairs.length);
  await mapConcurrent(
    matchedPairs,
    async ({ sqIssue, scIssue }) => {
      try { await syncSingleIssue(sqIssue, scIssue, client, sqClient, userMappings, stats, changelogMap); }
      catch (error) { stats.failed++; logger.debug(`Failed to sync issue ${sqIssue.key}: ${error.message}`); }
    },
    { concurrency, settled: true, onProgress: progressLogger },
  );
  logSyncSummary(stats);
  return stats;
}
