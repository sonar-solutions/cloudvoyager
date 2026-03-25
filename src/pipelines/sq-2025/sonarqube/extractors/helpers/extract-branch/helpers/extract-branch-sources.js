import { extractSources } from '../../../sources.js';
import { extractDuplications } from '../../../duplications.js';
import logger from '../../../../../../../shared/utils/logger.js';

// -------- Extract Branch Sources --------

/** Extract source code and duplications for a branch. */
export async function extractBranchSources(ext, branch) {
  logger.info(`  [${branch}] Extracting source code...`);
  const maxFiles = Math.max(0, Number.parseInt(process.env.MAX_SOURCE_FILES || '0', 10) || 0);
  return extractSources(ext.client, branch, maxFiles, {
    concurrency: ext.performanceConfig.sourceExtraction?.concurrency || 10,
  });
}

export async function extractBranchDuplications(ext, branch, components) {
  logger.info(`  [${branch}] Extracting duplications...`);
  return extractDuplications(ext.client, components, branch, {
    concurrency: ext.performanceConfig.sourceExtraction?.concurrency || 5,
  });
}
