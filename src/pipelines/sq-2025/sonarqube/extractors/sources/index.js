import logger from '../../../../../shared/utils/logger.js';
import { fetchSourceFiles } from './helpers/fetch-source-files.js';

// -------- Extract Sources --------

/** Extract source code files from SonarQube. */
export async function extractSources(client, branch = null, maxFiles = 0, options = {}) {
  const concurrency = options.concurrency || 10;

  logger.info('Extracting source files...');
  const files = await client.getSourceFiles(branch);
  logger.info(`Found ${files.length} source files`);

  const filesToFetch = maxFiles > 0 ? files.slice(0, maxFiles) : files;
  if (maxFiles > 0 && files.length > maxFiles) {
    logger.warn(`Limiting to first ${maxFiles} files (total: ${files.length})`);
  }

  return fetchSourceFiles(client, filesToFetch, branch, concurrency);
}
