// -------- Extraction Utilities --------

/**
 * Create an empty extracted data structure.
 * @param {string} mode - Transfer mode
 * @returns {object} Empty extracted data
 */
export function createEmptyExtractedData(mode) {
  return {
    project: null, metrics: [], issues: [], measures: {},
    components: [], sources: [], activeRules: [],
    duplications: new Map(), changesets: new Map(),
    symbols: new Map(), syntaxHighlightings: new Map(),
    metadata: { extractedAt: new Date().toISOString(), mode },
  };
}

/**
 * Parse MAX_SOURCE_FILES env var.
 * @returns {number} Max files (0 = unlimited)
 */
export function parseMaxSourceFiles() {
  return Math.max(0, Number.parseInt(process.env.MAX_SOURCE_FILES || '0', 10) || 0);
}
