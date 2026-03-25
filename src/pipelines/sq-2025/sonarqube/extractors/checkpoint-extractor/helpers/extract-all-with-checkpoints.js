import logger from '../../../../../../shared/utils/logger.js';
import { buildMainContext } from './build-main-context.js';
import { buildMainExtractionPhases } from './main-extraction-phases.js';
import { runMainPhases } from './run-main-phases.js';
import { buildMainResult } from './build-main-result.js';

// -------- Extract All With Checkpoints --------

/**
 * Extract all data with checkpoint support for pause/resume.
 * Each step is guarded by the journal: completed phases load from cache,
 * in-progress phases are re-executed, and shutdown checks run between phases.
 */
export async function extractAllWithCheckpoints(extractor, journal, cache, shutdownCheck) {
  logger.info('Starting checkpoint-aware data extraction from SonarQube...');
  const startTime = Date.now();

  const maxFiles = Math.max(0, Number.parseInt(process.env.MAX_SOURCE_FILES || '0', 10) || 0);
  const sourceConcurrency = extractor.performanceConfig.sourceExtraction?.concurrency || 10;
  const dupConcurrency = extractor.performanceConfig.sourceExtraction?.concurrency || 5;

  const ctx = buildMainContext();
  const phases = buildMainExtractionPhases(extractor, ctx, maxFiles, sourceConcurrency, dupConcurrency);
  await runMainPhases(phases, journal, cache, shutdownCheck);

  const extractedData = buildMainResult(ctx, extractor);
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  logger.info(`Checkpoint-aware extraction completed in ${duration}s`);

  extractor.logExtractionSummary(extractedData);
  return extractedData;
}
