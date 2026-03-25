import { extractAll } from './helpers/extract-all.js';
import { extractBranch } from './helpers/extract-branch.js';
import { logExtractionSummary } from './helpers/log-extraction-summary.js';
import { extractAllWithCheckpoints } from './helpers/extract-all-with-checkpoints.js';
import { extractBranchWithCheckpoints } from './helpers/extract-branch-with-checkpoints.js';

// -------- Factory Function --------

export function createDataExtractor(client, config, state = null, performanceConfig = {}) {
  const ext = { client, config, state, performanceConfig };
  ext.extractAll = async () => { const data = await extractAll(ext); logExtractionSummary(data); return data; };
  ext.extractBranch = (branch, mainData) => extractBranch(ext, branch, mainData);
  ext.logExtractionSummary = (data) => logExtractionSummary(data);
  ext.extractAllWithCheckpoints = async (j, c, s) => { const data = await extractAllWithCheckpoints(ext, j, c, s); logExtractionSummary(data); return data; };
  ext.extractBranchWithCheckpoints = (branch, mainData, j, c, s) => extractBranchWithCheckpoints(ext, branch, mainData, j, c, s);
  return ext;
}

// -------- Class Wrapper (backward compat) --------

export class DataExtractor {
  constructor(client, config, state = null, performanceConfig = {}) {
    Object.assign(this, createDataExtractor(client, config, state, performanceConfig));
  }
}
