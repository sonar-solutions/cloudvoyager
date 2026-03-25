// -------- Main Logic --------

/**
 * Build an empty extraction context for checkpoint-aware extraction.
 * Phases populate this object as they complete.
 *
 * @returns {object} Empty extraction context
 */
export function buildEmptyContext() {
  return {
    project: null,
    metrics: [],
    metricKeys: [],
    components: [],
    sourceFilesList: [],
    activeRules: [],
    issues: [],
    hotspotIssues: [],
    measures: {},
    sources: [],
    duplications: new Map(),
    changesets: new Map(),
    symbols: new Map(),
    syntaxHighlightings: new Map(),
    scmRevisionId: null,
  };
}
