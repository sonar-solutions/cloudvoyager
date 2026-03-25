// -------- Empty Checkpoint Context Factory --------

/**
 * Create a fresh mutable context for checkpoint-aware extraction.
 * @returns {object} Empty context with all fields initialized
 */
export function createEmptyCheckpointContext() {
  return {
    project: null, metrics: [], metricKeys: [], components: [],
    sourceFilesList: [], activeRules: [], issues: [], hotspotIssues: [],
    measures: {}, sources: [], duplications: new Map(), changesets: new Map(),
    symbols: new Map(), syntaxHighlightings: new Map(), scmRevisionId: null,
  };
}
