import { extractAll } from './extract-all.js';
import { extractBranch } from './extract-branch.js';
import { logExtractionSummary } from './log-extraction-summary.js';
import { extractAllWithCheckpoints } from './extract-all-with-checkpoints.js';
import { extractBranchWithCheckpoints } from './extract-branch-with-checkpoints.js';

// -------- Main Logic --------

/**
 * Create a DataExtractor instance (factory function).
 *
 * @param {object} client - SonarQube API client
 * @param {object} config - Transfer configuration
 * @param {object} [state=null] - State tracker for incremental mode
 * @param {object} [performanceConfig={}] - Performance tuning options
 * @returns {object} DataExtractor instance
 */
export function createDataExtractor(client, config, state = null, performanceConfig = {}) {
  const extractor = { client, config, state, performanceConfig };

  return {
    ...extractor,
    extractAll: () => extractAll(extractor),
    extractBranch: (branch, mainData) => extractBranch(extractor, branch, mainData),
    logExtractionSummary,
    extractAllWithCheckpoints: (journal, cache, shutdownCheck) =>
      extractAllWithCheckpoints(extractor, journal, cache, shutdownCheck),
    extractBranchWithCheckpoints: (branch, mainData, journal, cache, shutdownCheck) =>
      extractBranchWithCheckpoints(extractor, branch, mainData, journal, cache, shutdownCheck),
  };
}
