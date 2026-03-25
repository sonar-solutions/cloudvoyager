// -------- Build Extracted Data from Context --------

export function buildExtractedData(ctx, config) {
  return {
    project: ctx.project, metrics: ctx.metrics, issues: ctx.issues,
    measures: ctx.measures, components: ctx.components, sources: ctx.sources,
    activeRules: ctx.activeRules, duplications: ctx.duplications,
    changesets: ctx.changesets, symbols: ctx.symbols,
    syntaxHighlightings: ctx.syntaxHighlightings,
    metadata: {
      extractedAt: new Date().toISOString(),
      mode: config.transfer.mode,
      ...(ctx.scmRevisionId ? { scmRevisionId: ctx.scmRevisionId } : {}),
    },
  };
}
