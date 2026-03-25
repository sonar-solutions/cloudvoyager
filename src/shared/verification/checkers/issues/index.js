// -------- Verify Issues --------

import logger from '../../../utils/logger.js';
import { mapConcurrent, createProgressLogger } from '../../../utils/concurrency.js';
import { normalizeRule } from './helpers/normalize-rule.js';
import { createEmptyIssueResult } from './helpers/create-empty-result.js';
import { computeBreakdowns } from './helpers/compute-breakdowns.js';
import { matchIssues } from './helpers/match-issues.js';
import { classifyUnmatchedSq, classifyScOnly } from './helpers/classify-unmatched.js';
import { verifyIssuePair } from './helpers/verify-issue-pair.js';

/** Verify issues between SonarQube and SonarCloud for a project. */
export async function verifyIssues(sqClient, scClient, scProjectKey, options = {}) {
  const result = createEmptyIssueResult();
  logger.info('Fetching issues from SonarQube...');
  const sqIssues = await sqClient.getIssuesWithComments();
  result.sqCount = sqIssues.length;
  logger.info('Fetching issues from SonarCloud...');
  const scIssues = await scClient.searchIssuesWithComments(scProjectKey);
  result.scCount = scIssues.length;

  const sqBd = computeBreakdowns(sqIssues);
  const scBd = computeBreakdowns(scIssues);
  result.typeBreakdown = { sq: sqBd.typeBreakdown, sc: scBd.typeBreakdown };
  result.severityBreakdown = { sq: sqBd.severityBreakdown, sc: scBd.severityBreakdown };
  if (sqIssues.length === 0 && scIssues.length === 0) return result;

  const { matchedPairs, matchedSqKeys, scIssueMap } = matchIssues(sqIssues, scIssues);
  result.matched = matchedPairs.length;
  const matchedRules = new Set(matchedPairs.map(p => normalizeRule(p.sqIssue.rule)));
  const scRules = new Set(scIssues.map(i => normalizeRule(i.rule)));
  const sqRules = new Set(sqIssues.map(i => normalizeRule(i.rule)));
  classifyUnmatchedSq(sqIssues, matchedSqKeys, matchedRules, scRules, result);
  classifyScOnly(scIssueMap, matchedRules, sqRules, result);

  logger.info(`Matched ${matchedPairs.length}/${sqIssues.length}, verifying details...`);
  const progress = createProgressLogger('Issue verification', matchedPairs.length);
  await mapConcurrent(matchedPairs, async ({ sqIssue, scIssue }) => {
    await verifyIssuePair(sqIssue, scIssue, sqClient, scClient, result);
  }, { concurrency: options.concurrency || 5, settled: true, onProgress: progress });

  if (result.unmatched > 0 || result.statusMismatches.length > 0 || result.statusHistoryMismatches.length > 0) result.status = 'fail';
  else if (result.assignmentMismatches.length > 0 || result.commentMismatches.length > 0 || result.tagMismatches.length > 0) result.status = 'fail';
  return result;
}
