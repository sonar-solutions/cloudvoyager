import logger from '../../../../../../shared/utils/logger.js';
import { buildBranchPhases } from './checkpoint-phases-branch.js';
import { runBranchCheckpointPhases } from './run-checkpoint-phases.js';

// -------- Checkpoint-Aware Branch Extraction --------

export async function extractBranchWithCheckpoints(extractor, branch, mainData, journal, cache, shutdownCheck) {
  logger.info(`Checkpoint-aware extraction for branch: ${branch}`);
  const startTime = Date.now();

  const ctx = createEmptyBranchContext();
  const phases = buildBranchPhases(extractor, branch, mainData, ctx);

  await runBranchCheckpointPhases(phases, branch, journal, cache, shutdownCheck);

  // Merge hotspots into issues
  if (ctx.hotspotIssues.length > 0) {
    ctx.issues.push(...ctx.hotspotIssues);
    logger.info(`[${branch}] Added ${ctx.hotspotIssues.length} hotspots to issue list (total: ${ctx.issues.length})`);
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  logger.info(`[${branch}] Checkpoint-aware branch extraction completed in ${duration}s — ${ctx.issues.length} issues, ${ctx.components.length} components, ${ctx.sources.length} sources`);

  return {
    project: mainData.project, metrics: mainData.metrics,
    activeRules: mainData.activeRules,
    issues: ctx.issues, measures: ctx.measures,
    components: ctx.components, sources: ctx.sources,
    duplications: ctx.duplications, changesets: ctx.changesets,
    symbols: ctx.symbols, syntaxHighlightings: ctx.syntaxHighlightings,
    metadata: {
      extractedAt: new Date().toISOString(),
      mode: extractor.config.transfer.mode,
      ...(ctx.scmRevisionId ? { scmRevisionId: ctx.scmRevisionId } : {}),
    },
  };
}

// -------- Helpers --------

function createEmptyBranchContext() {
  return {
    components: [], sourceFilesList: [], issues: [], hotspotIssues: [],
    measures: {}, sources: [], duplications: new Map(),
    changesets: new Map(), symbols: new Map(),
    syntaxHighlightings: new Map(), scmRevisionId: null,
  };
}
