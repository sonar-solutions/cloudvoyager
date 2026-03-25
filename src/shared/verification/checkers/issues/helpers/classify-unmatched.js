// -------- Classify Unmatched Issues --------

import { normalizeRule } from './normalize-rule.js';

const MAX_UNMATCHED_DETAILS = 200;

/** Classify unmatched SQ issues: genuine mismatches vs rules not in SC. */
export function classifyUnmatchedSq(sqIssues, matchedSqKeys, matchedRules, scRules, result) {
  let genuineUnmatched = 0;
  let ruleNotInSc = 0;

  for (const sqIssue of sqIssues) {
    if (matchedSqKeys.has(sqIssue.key)) continue;
    const normRule = normalizeRule(sqIssue.rule);
    if (!matchedRules.has(normRule) && !scRules.has(normRule)) { ruleNotInSc++; continue; }
    genuineUnmatched++;
    if (result.unmatchedSqIssues.length >= MAX_UNMATCHED_DETAILS) continue;
    result.unmatchedSqIssues.push({
      sqKey: sqIssue.key, rule: sqIssue.rule,
      file: (sqIssue.component || '').split(':').pop(),
      line: sqIssue.line || sqIssue.textRange?.startLine || 0,
      type: sqIssue.type || 'UNKNOWN', severity: sqIssue.severity || 'UNKNOWN',
      message: (sqIssue.message || '').slice(0, 120),
    });
  }

  result.unmatched = genuineUnmatched;
  result.ruleNotInSc = ruleNotInSc;
}

/** Classify SC-only issues (unmatched SC with rules shared by both sides). */
export function classifyScOnly(scIssueMap, matchedRules, sqRules, result) {
  const remainingSc = [];
  scIssueMap.forEach(candidates => { for (const i of candidates) remainingSc.push(i); });

  for (const scIssue of remainingSc) {
    const normRule = normalizeRule(scIssue.rule);
    if (!matchedRules.has(normRule) && !sqRules.has(normRule)) continue;
    if (result.scOnlyIssues.length >= MAX_UNMATCHED_DETAILS) continue;
    result.scOnlyIssues.push({
      scKey: scIssue.key, rule: scIssue.rule,
      file: (scIssue.component || '').split(':').pop(),
      line: scIssue.line || scIssue.textRange?.startLine || 0,
      type: scIssue.type || 'UNKNOWN', severity: scIssue.severity || 'UNKNOWN',
      message: (scIssue.message || '').slice(0, 120),
    });
  }
}
