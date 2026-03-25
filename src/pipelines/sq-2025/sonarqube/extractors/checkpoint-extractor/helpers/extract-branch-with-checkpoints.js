import logger from '../../../../../../shared/utils/logger.js';
import { getCommonMetricKeys } from '../../metrics.js';
import { buildBranchContext } from './build-branch-context.js';
import { buildBranchExtractionPhases } from './branch-extraction-phases.js';
import { runBranchPhases } from './run-branch-phases.js';
import { buildBranchResult } from './build-branch-result.js';

// -------- Extract Branch With Checkpoints --------

/**
 * Extract data for a specific branch with checkpoint support.
 * Uses branch-specific journal methods for pause/resume.
 */
export async function extractBranchWithCheckpoints(extractor, branch, mainData, journal, cache, shutdownCheck) {
  logger.info(`Checkpoint-aware extraction for branch: ${branch}`);
  const startTime = Date.now();

  const metricKeys = getCommonMetricKeys(mainData.metrics);
  const maxFiles = Math.max(0, Number.parseInt(process.env.MAX_SOURCE_FILES || '0', 10) || 0);
  const sourceConcurrency = extractor.performanceConfig.sourceExtraction?.concurrency || 10;
  const dupConcurrency = extractor.performanceConfig.sourceExtraction?.concurrency || 5;

  const ctx = buildBranchContext();
  const phases = buildBranchExtractionPhases(extractor, ctx, branch, metricKeys, maxFiles, sourceConcurrency, dupConcurrency);
  await runBranchPhases(phases, branch, journal, cache, shutdownCheck);

  const result = buildBranchResult(ctx, extractor, branch, mainData);
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  logger.info(`[${branch}] Checkpoint-aware branch extraction completed in ${duration}s — ${ctx.issues.length} issues, ${ctx.components.length} components, ${ctx.sources.length} sources`);

  return result;
}
