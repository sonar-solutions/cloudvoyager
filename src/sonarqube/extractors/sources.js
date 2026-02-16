import logger from '../../utils/logger.js';
import { SourceFileData } from '../models.js';

/**
 * Extract source code files from SonarQube
 * @param {SonarQubeClient} client - SonarQube client
 * @param {string} branch - Branch name (optional)
 * @param {number} maxFiles - Maximum number of files to extract (0 = all)
 * @returns {Promise<Array<SourceFileData>>}
 */
export async function extractSources(client, branch = null, maxFiles = 0) {
  logger.info('Extracting source files...');

  // Get list of all source files
  const files = await client.getSourceFiles(branch);
  logger.info(`Found ${files.length} source files`);

  // Limit if specified
  const filesToFetch = maxFiles > 0 ? files.slice(0, maxFiles) : files;

  if (maxFiles > 0 && files.length > maxFiles) {
    logger.warn(`Limiting to first ${maxFiles} files (total: ${files.length})`);
  }

  const sourceFiles = [];
  let processed = 0;

  for (const file of filesToFetch) {
    try {
      logger.debug(`Fetching source: ${file.path || file.key}`);

      const content = await client.getSourceCode(file.key, branch);
      sourceFiles.push(new SourceFileData(file.key, content, file.language || ''));

      processed++;
      if (processed % 10 === 0) {
        logger.info(`Processed ${processed}/${filesToFetch.length} source files`);
      }
    } catch (error) {
      logger.warn(`Failed to fetch source for ${file.key}: ${error.message}`);
      // Continue with other files (fail fast is at API level, not individual file level)
    }
  }

  logger.info(`Successfully extracted ${sourceFiles.length} source files`);

  return sourceFiles;
}
