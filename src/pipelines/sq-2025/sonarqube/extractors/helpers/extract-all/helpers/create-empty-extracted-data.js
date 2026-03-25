// -------- Create Empty Extracted Data --------

/** Create a fresh empty data structure for extraction results. */
export function createEmptyExtractedData(extractor) {
  return {
    project: null, metrics: [], issues: [], measures: {},
    components: [], sources: [], activeRules: [],
    duplications: new Map(), changesets: new Map(),
    symbols: new Map(), syntaxHighlightings: new Map(),
    metadata: { extractedAt: new Date().toISOString(), mode: extractor.config.transfer.mode },
  };
}
