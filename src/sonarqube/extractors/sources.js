import logger from '../../utils/logger.js';
import { SourceFileData } from '../models.js';
import { mapConcurrent, createProgressLogger } from '../../utils/concurrency.js';

/**
 * Extract source code files from SonarQube
 * @param {SonarQubeClient} client - SonarQube client
 * @param {string} branch - Branch name (optional)
 * @param {number} maxFiles - Maximum number of files to extract (0 = all)
 * @param {object} options - Performance options
 * @param {number} [options.concurrency=10] - Max concurrent source file fetches
 * @returns {Promise<Array<SourceFileData>>}
 */
export async function extractSources(client, branch = null, maxFiles = 0, options = {}) {
  const concurrency = options.concurrency || 10;

  logger.info('Extracting source files...');

  // Get list of all source files
  const files = await client.getSourceFiles(branch);
  logger.info(`Found ${files.length} source files`);

  // Limit if specified
  const filesToFetch = maxFiles > 0 ? files.slice(0, maxFiles) : files;

  if (maxFiles > 0 && files.length > maxFiles) {
    logger.warn(`Limiting to first ${maxFiles} files (total: ${files.length})`);
  }

  logger.info(`Fetching ${filesToFetch.length} source files with concurrency=${concurrency}`);

  const progressLogger = createProgressLogger('Source files', filesToFetch.length);

  const results = await mapConcurrent(
    filesToFetch,
    async (file) => {
      logger.debug(`Fetching source: ${file.path || file.key}`);
      const content = await client.getSourceCode(file.key, branch);
      return new SourceFileData(file.key, content, file.language || '');
    },
    {
      concurrency,
      settled: true,
      onProgress: progressLogger
    }
  );

  const sourceFiles = results
    .filter(r => r.status === 'fulfilled')
    .map(r => r.value);

  const failed = results.filter(r => r.status === 'rejected').length;
  if (failed > 0) {
    logger.warn(`Failed to fetch ${failed} source files`);
  }

  logger.info(`Successfully extracted ${sourceFiles.length} source files`);

  return sourceFiles;
}
