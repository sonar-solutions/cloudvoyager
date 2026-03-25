import logger from '../../../../../shared/utils/logger.js';
import { buildMainPhases } from './checkpoint-phases-main.js';
import { runMainCheckpointPhases } from './run-main-checkpoint-phases.js';
import { parseMaxSourceFiles } from './extraction-utils.js';
import { createEmptyCheckpointContext } from './create-empty-checkpoint-context.js';
import { buildExtractedData } from './build-extracted-data.js';

// Re-export for backward compat
export { buildExtractedData } from './build-extracted-data.js';

// -------- Extract All With Checkpoints --------

/**
 * Extract all data with checkpoint support for pause/resume.
 */
export async function extractAllWithCheckpoints(extractor, journal, cache, shutdownCheck) {
  logger.info('Starting checkpoint-aware data extraction from SonarQube...');
  const startTime = Date.now();

  const ctx = createEmptyCheckpointContext();
  const opts = {
    maxFiles: parseMaxSourceFiles(),
    sourceConcurrency: extractor.performanceConfig.sourceExtraction?.concurrency || 10,
    dupConcurrency: extractor.performanceConfig.sourceExtraction?.concurrency || 5,
  };

  const phases = buildMainPhases(extractor, ctx, opts);
  await runMainCheckpointPhases(phases, journal, cache, shutdownCheck);

  if (ctx.hotspotIssues.length > 0) {
    ctx.issues = ctx.issues.concat(ctx.hotspotIssues);
    logger.info(`Added ${ctx.hotspotIssues.length} hotspots (total: ${ctx.issues.length})`);
  }

  logger.info(`Checkpoint-aware extraction completed in ${((Date.now() - startTime) / 1000).toFixed(2)}s`);
  return buildExtractedData(ctx, extractor.config.transfer.mode);
}
