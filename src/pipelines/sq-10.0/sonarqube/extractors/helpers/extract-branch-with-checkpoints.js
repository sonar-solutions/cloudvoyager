import logger from '../../../../../shared/utils/logger.js';
import { getCommonMetricKeys } from '../metrics.js';
import { buildBranchPhases } from './checkpoint-phases-branch.js';
import { runBranchCheckpointPhases } from './run-branch-checkpoint-phases.js';
import { parseMaxSourceFiles } from './extraction-utils.js';

// -------- Extract Branch With Checkpoints --------

export async function extractBranchWithCheckpoints(extractor, branch, mainData, journal, cache, shutdownCheck) {
  logger.info(`Checkpoint-aware extraction for branch: ${branch}`);
  const startTime = Date.now();
  const metricKeys = getCommonMetricKeys(mainData.metrics);
  const ctx = {
    components: [], sourceFilesList: [], issues: [],
    hotspotIssues: [], measures: {}, sources: [],
    duplications: new Map(), changesets: new Map(),
    symbols: new Map(), syntaxHighlightings: new Map(),
  };
  const opts = {
    maxFiles: parseMaxSourceFiles(),
    sourceConcurrency: extractor.performanceConfig.sourceExtraction?.concurrency || 10,
    dupConcurrency: extractor.performanceConfig.sourceExtraction?.concurrency || 5,
  };
  const phases = buildBranchPhases(extractor, branch, metricKeys, ctx, opts);
  await runBranchCheckpointPhases(phases, branch, journal, cache, shutdownCheck);
  if (ctx.hotspotIssues.length > 0) {
    ctx.issues.push(...ctx.hotspotIssues);
    logger.info(`[${branch}] Added ${ctx.hotspotIssues.length} hotspots (total: ${ctx.issues.length})`);
  }
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  logger.info(`[${branch}] Checkpoint-aware extraction completed in ${duration}s`);
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
