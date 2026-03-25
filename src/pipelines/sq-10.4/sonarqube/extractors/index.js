import { createDataExtractor } from './helpers/create-data-extractor.js';

// -------- Factory Function (primary export) --------

export { createDataExtractor };

// -------- Thin Class Wrapper (backward compatibility) --------

/**
 * DataExtractor class — thin wrapper around createDataExtractor factory.
 * Preserves `new DataExtractor(...)` usage in existing callers.
 */
export class DataExtractor {
  constructor(client, config, state = null, performanceConfig = {}) {
    const instance = createDataExtractor(client, config, state, performanceConfig);
    this.client = instance.client;
    this.config = instance.config;
    this.state = instance.state;
    this.performanceConfig = instance.performanceConfig;
    this._instance = instance;
  }

  extractAll() {
    return this._instance.extractAll();
  }

  extractBranch(branch, mainData) {
    return this._instance.extractBranch(branch, mainData);
  }

  logExtractionSummary(data) {
    return this._instance.logExtractionSummary(data);
  }

  extractAllWithCheckpoints(journal, cache, shutdownCheck) {
    return this._instance.extractAllWithCheckpoints(journal, cache, shutdownCheck);
  }

  extractBranchWithCheckpoints(branch, mainData, journal, cache, shutdownCheck) {
    return this._instance.extractBranchWithCheckpoints(branch, mainData, journal, cache, shutdownCheck);
  }
}
