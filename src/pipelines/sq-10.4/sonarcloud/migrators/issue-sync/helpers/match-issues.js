import { buildMatchKey } from './build-match-key.js';

// -------- Main Logic --------

/**
 * Match SonarQube issues to SonarCloud issues by rule + component + line.
 */
export function matchIssues(sqIssues, scIssues) {
  const scIssueMap = new Map();
  for (const issue of scIssues) {
    const key = buildMatchKey(issue);
    if (!key) continue;
    if (!scIssueMap.has(key)) scIssueMap.set(key, []);
    scIssueMap.get(key).push(issue);
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
