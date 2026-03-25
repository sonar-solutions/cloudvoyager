import logger from '../../../../../../shared/utils/logger.js';

// -------- Main Logic --------

// Log a breakdown of active rules by repository.
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
