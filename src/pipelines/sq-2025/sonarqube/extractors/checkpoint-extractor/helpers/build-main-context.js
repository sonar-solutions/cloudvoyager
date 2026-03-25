// -------- Build Main Extraction Context --------

/** Create the empty context object for main branch extraction. */
export function buildMainContext() {
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
