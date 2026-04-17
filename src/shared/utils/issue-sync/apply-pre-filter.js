import logger from '../logger.js';
import { fetchSqChangelogs } from './fetch-sq-changelogs.js';
import { hasManualChanges } from './has-manual-changes.js';

/**
 * Pre-filter SQ issues to only those with manual changes.
 * Batch-fetches changelogs, then applies the hasManualChanges filter.
 *
 * @param {Array}  sqIssues    - Full list of SQ issues
 * @param {object} sqClient    - SonarQube API client (must have getIssueChangelog)
 * @param {object} stats       - Mutable stats object; stats.filtered is set
 * @param {number} concurrency - Max parallel changelog fetches
 * @returns {Promise<{ issuesToSync: Array, changelogMap: Map }>}
 */
export async function applyManualChangesPreFilter(sqIssues, sqClient, stats, concurrency) {
  const changelogMap = new Map();
  const fetched = await fetchSqChangelogs(sqIssues, sqClient, concurrency);
  for (const [k, v] of fetched) changelogMap.set(k, v);

  const before = sqIssues.length;
  const issuesToSync = sqIssues.filter(issue => hasManualChanges(issue, changelogMap.get(issue.key) ?? []));
  stats.filtered = before - issuesToSync.length;

  logger.info(`Pre-filtered ${stats.filtered} issues with no manual changes; ${issuesToSync.length} remaining`);
  return { issuesToSync, changelogMap };
}
