import logger from '../../../../../../shared/utils/logger.js';
import { buildMainBranchPhases } from './checkpoint-phases-main.js';
import { runCheckpointPhases } from './run-checkpoint-phases.js';
import { createEmptyContext } from './create-empty-context.js';
import { buildExtractedData } from './build-extracted-data.js';

// -------- Checkpoint-Aware Main Extraction --------

export async function extractAllWithCheckpoints(extractor, journal, cache, shutdownCheck) {
  logger.info('Starting checkpoint-aware data extraction from SonarQube...');
  const startTime = Date.now();

  const ctx = createEmptyContext();
  const phases = buildMainBranchPhases(extractor, ctx);

  await runCheckpointPhases(phases, journal, cache, shutdownCheck);

  // Merge hotspots into issues
  if (ctx.hotspotIssues.length > 0) {
    ctx.issues = ctx.issues.concat(ctx.hotspotIssues);
    logger.info(`Added ${ctx.hotspotIssues.length} hotspots to issue list (total: ${ctx.issues.length})`);
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  logger.info(`Checkpoint-aware extraction completed in ${duration}s`);

  const extractedData = buildExtractedData(ctx, extractor.config);
  extractor.logExtractionSummary(extractedData);
  return extractedData;
}
