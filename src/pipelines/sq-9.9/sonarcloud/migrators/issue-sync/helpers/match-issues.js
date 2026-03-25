import { buildMatchKey } from './build-match-key.js';

// -------- Build Match Map and Pre-Match SQ <-> SC Issues --------

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
    matchedPairs.push({ sqIssue, scIssue: candidates.shift() });
  }

  return matchedPairs;
}
