import { extractAll } from './extract-all.js';
import { extractBranch } from './extract-branch.js';
import { logExtractionSummary } from './log-extraction-summary.js';
import { extractAllWithCheckpoints, extractBranchWithCheckpoints } from '../checkpoint-extractor.js';

// -------- Factory --------

/**
 * Create a DataExtractor instance that orchestrates
 * extraction of all data from SonarQube.
 *
 * @param {object} client - SonarQube API client
 * @param {object} config - Pipeline configuration
 * @param {object} [state] - State tracker for incremental mode
 * @param {object} [performanceConfig] - Performance tuning
 * @returns {object} DataExtractor instance
 */
export function createDataExtractor(client, config, state = null, performanceConfig = {}) {
  const extractor = { client, config, state, performanceConfig };

  extractor.logExtractionSummary = (data) => logExtractionSummary(data);

  extractor.extractAll = () => extractAll(extractor);

  extractor.extractBranch = (branch, mainData) =>
    extractBranch(extractor, branch, mainData);

  extractor.extractAllWithCheckpoints = (journal, cache, shutdownCheck) =>
    extractAllWithCheckpoints(extractor, journal, cache, shutdownCheck);

  extractor.extractBranchWithCheckpoints = (branch, mainData, journal, cache, shutdownCheck) =>
    extractBranchWithCheckpoints(extractor, branch, mainData, journal, cache, shutdownCheck);

  return extractor;
}
