// -------- Build Branch Extraction Context --------

/** Create the empty context object for branch extraction. */
export function buildBranchContext() {
  return {
    components: [],
    sourceFilesList: [],
    issues: [],
    hotspotIssues: [],
    measures: {},
    sources: [],
    duplications: new Map(),
    changesets: new Map(),
    symbols: new Map(),
    syntaxHighlightings: new Map(),
  };
}
