import logger from '../../../../../shared/utils/logger.js';
import { mapConcurrent, createProgressLogger } from '../../../../../shared/utils/concurrency.js';
import { fetchSqChangelogs } from '../../../../../shared/utils/issue-sync/fetch-sq-changelogs.js';
import { hasManualChanges } from '../../../../../shared/utils/issue-sync/has-manual-changes.js';
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
