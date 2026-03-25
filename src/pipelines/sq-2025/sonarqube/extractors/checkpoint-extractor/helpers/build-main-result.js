import logger from '../../../../../../shared/utils/logger.js';

// -------- Build Main Extraction Result --------

/** Merge hotspots into issues and assemble the final extracted data object. */
export function buildMainResult(ctx, extractor) {
  // Merge hotspots into issues
  if (ctx.hotspotIssues.length > 0) {
    ctx.issues = ctx.issues.concat(ctx.hotspotIssues);
    logger.info(`Added ${ctx.hotspotIssues.length} hotspots to issue list (total: ${ctx.issues.length})`);
  }

  return {
    project: ctx.project,
    metrics: ctx.metrics,
    issues: ctx.issues,
    measures: ctx.measures,
    components: ctx.components,
    sources: ctx.sources,
    activeRules: ctx.activeRules,
    duplications: ctx.duplications,
    changesets: ctx.changesets,
    symbols: ctx.symbols,
    syntaxHighlightings: ctx.syntaxHighlightings,
    metadata: {
      extractedAt: new Date().toISOString(),
      mode: extractor.config.transfer.mode,
      ...(ctx.scmRevisionId ? { scmRevisionId: ctx.scmRevisionId } : {}),
    },
  };
}
