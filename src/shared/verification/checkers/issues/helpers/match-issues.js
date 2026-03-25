// -------- Match Issues --------

import { buildMatchKey } from './build-match-key.js';

/**
 * Match SQ issues to SC issues using rule + file + line keys.
 * @returns {{ matchedPairs, matchedSqKeys, scIssueMap }}
 */
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
  const matchedSqKeys = new Set();

  for (const sqIssue of sqIssues) {
    const matchKey = buildMatchKey(sqIssue);
    if (!matchKey) continue;
    const candidates = scIssueMap.get(matchKey);
    if (!candidates || candidates.length === 0) continue;
    const scIssue = candidates.shift();
    matchedPairs.push({ sqIssue, scIssue });
    matchedSqKeys.add(sqIssue.key);
  }

  return { matchedPairs, matchedSqKeys, scIssueMap };
}
