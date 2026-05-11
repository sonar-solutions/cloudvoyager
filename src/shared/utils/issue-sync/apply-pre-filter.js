import logger from '../logger.js';
import { fetchSqChangelogs } from './fetch-sq-changelogs.js';
import { hasCheapManualSignal, hasManualChanges } from './has-manual-changes.js';

/**
 * Pre-filter SQ issues to only those with manual changes.
 * Two-phase: cheap field checks first, then changelog fetch only for ambiguous issues.
 *
 * @param {Array}  sqIssues    - Full list of SQ issues
 * @param {object} sqClient    - SonarQube API client (must have getIssueChangelog)
 * @param {object} stats       - Mutable stats object; stats.filtered is set
 * @param {number} concurrency - Max parallel changelog fetches
 * @returns {Promise<{ issuesToSync: Array, changelogMap: Map }>}
 */
export async function applyManualChangesPreFilter(sqIssues, sqClient, stats, concurrency) {
  const changelogMap = new Map();

  // -------- Phase 1: cheap field-only checks (no API calls) --------
  const definitelyManual = [];
  const needsChangelog = [];

  for (const issue of sqIssues) {
    if (hasCheapManualSignal(issue)) {
      definitelyManual.push(issue);
    } else {
      needsChangelog.push(issue);
    }
  }

  logger.info(`Cheap pre-filter: ${definitelyManual.length} issues with obvious manual signals, ${needsChangelog.length} need changelog check`);

  // -------- Phase 2: fetch changelogs only for ambiguous issues --------
  const fetched = await fetchSqChangelogs(needsChangelog, sqClient, concurrency);
  for (const [k, v] of fetched) changelogMap.set(k, v);

  const changelogMatches = needsChangelog.filter(issue =>
    hasManualChanges(issue, changelogMap.get(issue.key) ?? []),
  );

  // -------- Combine results --------
  const issuesToSync = [...definitelyManual, ...changelogMatches];
  const before = sqIssues.length;
  stats.filtered = before - issuesToSync.length;

  logger.info(`Pre-filtered ${stats.filtered} issues with no manual changes; ${issuesToSync.length} remaining`);
  return { issuesToSync, changelogMap };
}
