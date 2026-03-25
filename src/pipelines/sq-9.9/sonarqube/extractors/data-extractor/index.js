import { extractAll } from './helpers/extract-all.js';
import { extractBranch } from './helpers/extract-branch.js';
import { logExtractionSummary } from './helpers/log-extraction-summary.js';
import { extractAllWithCheckpoints } from './helpers/extract-all-with-checkpoints.js';
import { extractBranchWithCheckpoints } from './helpers/extract-branch-with-checkpoints.js';

// -------- Factory Function (primary export) --------

export function createDataExtractor(client, config, state = null, performanceConfig = {}) {
  const extractor = { client, config, state, performanceConfig };

  extractor.logExtractionSummary = (data) => logExtractionSummary(data);
  extractor.extractAll = () => extractAll(extractor);
  extractor.extractBranch = (branch, mainData) => extractBranch(extractor, branch, mainData);

  extractor.extractAllWithCheckpoints = (journal, cache, shutdownCheck) =>
    extractAllWithCheckpoints(extractor, journal, cache, shutdownCheck);

  extractor.extractBranchWithCheckpoints = (branch, mainData, journal, cache, shutdownCheck) =>
    extractBranchWithCheckpoints(extractor, branch, mainData, journal, cache, shutdownCheck);

  return extractor;
}

// -------- Class Wrapper (backward compatibility) --------

export class DataExtractor {
  constructor(client, config, state = null, performanceConfig = {}) {
    const instance = createDataExtractor(client, config, state, performanceConfig);
    Object.assign(this, instance);
  }
}
