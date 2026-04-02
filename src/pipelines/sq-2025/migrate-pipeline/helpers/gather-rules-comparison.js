import logger from '../../../../shared/utils/logger.js';
import { gatherRulesComparison } from '../../sonarcloud/reports/rules-comparison/index.js';

// -------- Gather Rules Comparison Report --------

/** Fetch all rules from SQ and SC, compare by Rule ID, attach to results. */
export async function gatherRulesComparisonReport(results, ctx) {
  if (ctx.dryRun) return;

  logger.info('=== Gathering rules comparison report (SQ vs SC) ===');
  results.rulesComparisonData = await gatherRulesComparison(ctx);

  const { sqTotalRules, scTotalRules, onlyInSQCount, onlyInSCCount, inBothCount } = results.rulesComparisonData.summary;
  logger.info(`Rules: SQ=${sqTotalRules} SC=${scTotalRules} — ${onlyInSQCount} only in SQ, ${onlyInSCCount} only in SC, ${inBothCount} shared`);
}
