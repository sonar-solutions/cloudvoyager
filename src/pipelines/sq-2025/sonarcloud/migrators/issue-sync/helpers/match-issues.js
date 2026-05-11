import logger from '../../../../../../shared/utils/logger.js';
import { buildMatchKey } from './build-match-key.js';

// -------- Match Issues --------

/** Build a lookup map and match SQ issues to SC issues by rule + file + line. */
export function matchIssues(sqIssues, scIssues, stats = null) {
  const scIssueMap = new Map();
  for (const issue of scIssues) {
    const key = buildMatchKey(issue);
    if (key) {
      if (!scIssueMap.has(key)) scIssueMap.set(key, []);
      scIssueMap.get(key).push(issue);
    }
  }

  const matchedPairs = [];
  const seenKeys = new Map();

  for (const sqIssue of sqIssues) {
    const matchKey = buildMatchKey(sqIssue);
    if (!matchKey) continue;

    if (seenKeys.has(matchKey)) {
      const firstKey = seenKeys.get(matchKey);
      logger.warn(`Duplicate match key "${matchKey}": SQ issue ${sqIssue.key} collides with ${firstKey} — skipping`);
      if (stats) stats.duplicateDropped++;
      continue;
    }

    const candidates = scIssueMap.get(matchKey);
    if (!candidates || candidates.length === 0) continue;

    seenKeys.set(matchKey, sqIssue.key);
    const scIssue = candidates.shift();
    matchedPairs.push({ sqIssue, scIssue });
  }

  const dupCount = stats?.duplicateDropped || 0;
  const dupMsg = dupCount > 0 ? ` (${dupCount} duplicates dropped)` : '';
  logger.info(`Matched ${matchedPairs.length} issues${dupMsg}`);
  return matchedPairs;
}
