import logger from '../../../../../../shared/utils/logger.js';

// -------- Build Branch Extraction Result --------

/** Merge hotspots into issues and assemble the final branch extracted data object. */
export function buildBranchResult(ctx, extractor, branch, mainData) {
  if (ctx.hotspotIssues.length > 0) {
    ctx.issues.push(...ctx.hotspotIssues);
    logger.info(`[${branch}] Added ${ctx.hotspotIssues.length} hotspots to issue list (total: ${ctx.issues.length})`);
  }

  return {
    project: mainData.project,
    metrics: mainData.metrics,
    activeRules: mainData.activeRules,
    issues: ctx.issues,
    measures: ctx.measures,
    components: ctx.components,
    sources: ctx.sources,
    duplications: ctx.duplications,
    changesets: ctx.changesets,
    symbols: ctx.symbols,
    syntaxHighlightings: ctx.syntaxHighlightings,
    metadata: {
      extractedAt: new Date().toISOString(),
      mode: extractor.config.transfer.mode,
    },
  };
}
