// -------- Empty Extracted Data Factory --------

export function createEmptyExtractedData(config) {
  return {
    project: null, metrics: [], issues: [], measures: {},
    components: [], sources: [], activeRules: [],
    duplications: new Map(), changesets: new Map(),
    symbols: new Map(), syntaxHighlightings: new Map(),
    metadata: { extractedAt: new Date().toISOString(), mode: config.transfer.mode },
  };
}
