import logger from '../../../../../shared/utils/logger.js';
import { buildMainPhases } from './build-main-phases.js';
import { runPhases } from './run-phases.js';
import { logExtractionSummary } from './log-extraction-summary.js';
import { buildEmptyContext } from './build-empty-context.js';
import { contextToExtractedData } from './context-to-extracted-data.js';

// -------- Main Logic --------

/**
 * Extract all data with checkpoint support for pause/resume.
 *
 * @param {object} extractor - DataExtractor instance
 * @param {object} journal - CheckpointJournal
 * @param {object} cache - ExtractionCache
 * @param {Function} shutdownCheck - () => boolean
 * @returns {Promise<object>} Extracted data (same shape as extractAll)
 */
export async function extractAllWithCheckpoints(extractor, journal, cache, shutdownCheck) {
  logger.info('Starting checkpoint-aware data extraction from SonarQube...');
  const startTime = Date.now();

  const maxFiles = Math.max(0, Number.parseInt(process.env.MAX_SOURCE_FILES || '0', 10) || 0);
  const sourceConcurrency = extractor.performanceConfig.sourceExtraction?.concurrency || 10;
  const dupConcurrency = extractor.performanceConfig.sourceExtraction?.concurrency || 5;

  const ctx = buildEmptyContext();
  const phases = buildMainPhases(extractor, ctx, { maxFiles, sourceConcurrency, dupConcurrency });

  await runPhases(phases, journal, cache, shutdownCheck);

  // Merge hotspots into issues
  if (ctx.hotspotIssues.length > 0) {
    ctx.issues = ctx.issues.concat(ctx.hotspotIssues);
    logger.info(`Added ${ctx.hotspotIssues.length} hotspots to issue list (total: ${ctx.issues.length})`);
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  logger.info(`Checkpoint-aware extraction completed in ${duration}s`);

  const extractedData = contextToExtractedData(ctx, extractor.config.transfer.mode);
  logExtractionSummary(extractedData);
  return extractedData;
}
