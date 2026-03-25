import logger from '../../../../../../shared/utils/logger.js';

// -------- Log Active Rules Breakdown --------

export function logRuleBreakdown(allActiveRules) {
  const repoCounts = {};
  allActiveRules.forEach(rule => {
    repoCounts[rule.ruleRepository] = (repoCounts[rule.ruleRepository] || 0) + 1;
  });
  logger.info('Active rules breakdown by repository:');
  Object.entries(repoCounts).forEach(([repo, count]) => {
    logger.info(`  ${repo}: ${count}`);
  });
}
