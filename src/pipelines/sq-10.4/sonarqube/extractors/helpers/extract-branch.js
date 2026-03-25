import logger from '../../../../../shared/utils/logger.js';
import { getCommonMetricKeys } from '../metrics.js';
import { extractBranchData } from './extract-branch-data.js';

// -------- Main Logic --------

/**
 * Extract data for a specific branch.
 * Returns the same shape as extractAll() for ProtobufBuilder compatibility.
 *
 * @param {object} extractor - DataExtractor instance
 * @param {string} branch - Branch name
 * @param {object} mainData - Data from main branch extractAll()
 * @returns {Promise<object>} Extracted data
 */
export async function extractBranch(extractor, branch, mainData) {
  logger.info(`Extracting data for branch: ${branch}`);
  const startTime = Date.now();
  const metricKeys = getCommonMetricKeys(mainData.metrics);

  const ctx = await extractBranchData(extractor, branch, metricKeys);

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  logger.info(`  [${branch}] Branch extraction completed in ${duration}s — ${ctx.issues.length} issues, ${ctx.components.length} components, ${ctx.sources.length} sources`);

  return {
    project: mainData.project, metrics: mainData.metrics,
    activeRules: mainData.activeRules, issues: ctx.issues,
    measures: ctx.measures, components: ctx.components,
    sources: ctx.sources, duplications: ctx.duplications,
    changesets: ctx.changesets, symbols: ctx.symbols,
    syntaxHighlightings: ctx.syntaxHighlightings,
    metadata: { extractedAt: new Date().toISOString(), mode: extractor.config.transfer.mode },
  };
}
