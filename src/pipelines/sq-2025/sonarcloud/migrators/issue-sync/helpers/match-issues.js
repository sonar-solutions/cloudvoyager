import logger from '../../../../../../shared/utils/logger.js';
import { buildMatchKey } from './build-match-key.js';

// -------- Match Issues --------

/** Build a lookup map and match SQ issues to SC issues by rule + file + line. */
export function matchIssues(sqIssues, scIssues) {
  const scIssueMap = new Map();
  for (const issue of scIssues) {
    const key = buildMatchKey(issue);
    if (key) {
      if (!scIssueMap.has(key)) scIssueMap.set(key, []);
      scIssueMap.get(key).push(issue);
    }
  }

  const matchedPairs = [];
  for (const sqIssue of sqIssues) {
    const matchKey = buildMatchKey(sqIssue);
    if (!matchKey) continue;
    const candidates = scIssueMap.get(matchKey);
    if (!candidates || candidates.length === 0) continue;
    const scIssue = candidates.shift();
    matchedPairs.push({ sqIssue, scIssue });
  }

  logger.info(`Matched ${matchedPairs.length} issues`);
  return matchedPairs;
}
