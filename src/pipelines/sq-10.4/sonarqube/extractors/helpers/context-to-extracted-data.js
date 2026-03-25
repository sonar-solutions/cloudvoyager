// -------- Main Logic --------

/**
 * Convert a checkpoint extraction context into the standard extracted data shape.
 *
 * @param {object} ctx - Extraction context populated by phases
 * @param {string} mode - Transfer mode (e.g. 'full', 'incremental')
 * @returns {object} Extracted data (same shape as extractAll output)
 */
export function contextToExtractedData(ctx, mode) {
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
      mode,
      ...(ctx.scmRevisionId ? { scmRevisionId: ctx.scmRevisionId } : {}),
    },
  };
}
