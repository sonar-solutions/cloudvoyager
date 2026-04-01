import { buildMatchKey } from '../../../migrators/issue-sync/helpers/build-match-key.js';

// -------- Diff Project Issues --------

/** Pick only the fields needed for the delta report from an issue. */
function pickFields(issue) {
  return {
    key: issue.key,
    rule: issue.rule,
    component: issue.component,
    line: issue.line ?? issue.textRange?.startLine,
    message: issue.message,
    severity: issue.severity,
  };
}

/**
 * Compare SQ and SC issues by match key (rule|filePath|line).
 * Returns onlyInSQ (disappeared) and onlyInSC (appeared).
 */
export function diffProjectIssues(sqIssues, scIssues) {
  const scMap = new Map();
  for (const issue of scIssues) {
    const key = buildMatchKey(issue);
    if (key) {
      if (!scMap.has(key)) scMap.set(key, []);
      scMap.get(key).push(issue);
    }
  }

  const consumedScKeys = new Set();
  const onlyInSQ = [];

  for (const sqIssue of sqIssues) {
    const key = buildMatchKey(sqIssue);
    const candidates = key ? scMap.get(key) : null;
    if (!candidates || candidates.length === 0) {
      onlyInSQ.push(pickFields(sqIssue));
    } else {
      consumedScKeys.add(candidates[0].key);
      candidates.shift();
    }
  }

  const onlyInSC = scIssues
    .filter(i => !consumedScKeys.has(i.key))
    .map(pickFields);

  return { onlyInSQ, onlyInSC };
}
