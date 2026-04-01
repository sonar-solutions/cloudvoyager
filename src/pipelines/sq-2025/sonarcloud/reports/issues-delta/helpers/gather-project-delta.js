import logger from '../../../../../../shared/utils/logger.js';
import { diffProjectIssues } from './diff-project-issues.js';
import { buildRuleBreakdown } from './build-rule-breakdown.js';

// -------- Gather Project Issues Delta --------

/**
 * Fetch issues for one project from both SQ and SC, then compute the delta.
 * Returns a single project delta entry for the issues delta report.
 */
export async function gatherProjectDelta(sqProjectKey, scProjectKey, sqClient, scClient) {
  logger.debug(`Fetching issues delta: SQ=${sqProjectKey} SC=${scProjectKey}`);

  const [sqIssues, scIssues] = await Promise.all([
    sqClient.getIssues(sqProjectKey),
    scClient.searchIssues(scProjectKey),
  ]);

  const { onlyInSQ, onlyInSC } = diffProjectIssues(sqIssues, scIssues);
  const byRule = buildRuleBreakdown(onlyInSQ, onlyInSC);

  logger.debug(`Delta: ${sqProjectKey} — ${onlyInSQ.length} disappeared, ${onlyInSC.length} appeared`);

  return {
    sqProjectKey,
    scProjectKey,
    sqIssueCount: sqIssues.length,
    scIssueCount: scIssues.length,
    onlyInSQ,
    onlyInSC,
    byRule,
  };
}
