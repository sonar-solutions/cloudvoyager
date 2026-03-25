// -------- Build Extracted Data Result --------

/**
 * Build the final extracted data object from a checkpoint context.
 * @param {object} ctx - Checkpoint context accumulator
 * @param {string} mode - Transfer mode
 * @returns {object} Extracted data
 */
export function buildExtractedData(ctx, mode) {
  return {
    project: ctx.project, metrics: ctx.metrics, issues: ctx.issues,
    measures: ctx.measures, components: ctx.components, sources: ctx.sources,
    activeRules: ctx.activeRules, duplications: ctx.duplications,
    changesets: ctx.changesets, symbols: ctx.symbols,
    syntaxHighlightings: ctx.syntaxHighlightings,
    metadata: {
      extractedAt: new Date().toISOString(), mode,
      ...(ctx.scmRevisionId ? { scmRevisionId: ctx.scmRevisionId } : {}),
    },
  };
}
