// -------- Empty Checkpoint Context Factory --------

export function createEmptyContext() {
  return {
    project: null, metrics: [], metricKeys: [], components: [],
    sourceFilesList: [], activeRules: [], issues: [], hotspotIssues: [],
    measures: {}, sources: [], duplications: new Map(),
    changesets: new Map(), symbols: new Map(),
    syntaxHighlightings: new Map(), scmRevisionId: null,
  };
}
