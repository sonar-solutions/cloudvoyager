import logger from '../../../../../shared/utils/logger.js';
import { getCommonMetricKeys } from '../metrics.js';
import { buildBranchPhases } from './build-branch-phases.js';
import { runBranchPhases } from './run-branch-phases.js';

// -------- Main Logic --------

/**
 * Extract data for a specific branch with checkpoint support.
 *
 * @param {object} extractor - DataExtractor instance
 * @param {string} branch - Branch name
 * @param {object} mainData - Data from main branch extraction
 * @param {object} journal - CheckpointJournal
 * @param {object} cache - ExtractionCache
 * @param {Function} shutdownCheck - () => boolean
 * @returns {Promise<object>} Extracted data (same shape as extractAll)
 */
export async function extractBranchWithCheckpoints(extractor, branch, mainData, journal, cache, shutdownCheck) {
  logger.info(`Checkpoint-aware extraction for branch: ${branch}`);
  const startTime = Date.now();

  const metricKeys = getCommonMetricKeys(mainData.metrics);
  const maxFiles = Math.max(0, Number.parseInt(process.env.MAX_SOURCE_FILES || '0', 10) || 0);
  const sourceConcurrency = extractor.performanceConfig.sourceExtraction?.concurrency || 10;
  const dupConcurrency = extractor.performanceConfig.sourceExtraction?.concurrency || 5;

  const ctx = { components: [], sourceFilesList: [], issues: [], hotspotIssues: [], measures: {}, sources: [], duplications: new Map(), changesets: new Map(), symbols: new Map(), syntaxHighlightings: new Map() };
  const phases = buildBranchPhases(extractor, branch, ctx, { metricKeys, maxFiles, sourceConcurrency, dupConcurrency });

  await runBranchPhases(phases, branch, journal, cache, shutdownCheck);

  if (ctx.hotspotIssues.length > 0) {
    ctx.issues.push(...ctx.hotspotIssues);
    logger.info(`[${branch}] Added ${ctx.hotspotIssues.length} hotspots (total: ${ctx.issues.length})`);
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  logger.info(`[${branch}] Checkpoint-aware branch extraction completed in ${duration}s — ${ctx.issues.length} issues, ${ctx.components.length} components, ${ctx.sources.length} sources`);

  return {
    project: mainData.project, metrics: mainData.metrics, activeRules: mainData.activeRules,
    issues: ctx.issues, measures: ctx.measures, components: ctx.components,
    sources: ctx.sources, duplications: ctx.duplications, changesets: ctx.changesets,
    symbols: ctx.symbols, syntaxHighlightings: ctx.syntaxHighlightings,
    metadata: { extractedAt: new Date().toISOString(), mode: extractor.config.transfer.mode },
  };
}
