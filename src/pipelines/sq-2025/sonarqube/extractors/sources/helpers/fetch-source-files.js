import logger from '../../../../../../shared/utils/logger.js';
import { SourceFileData } from '../../../models.js';
import { mapConcurrent, createProgressLogger } from '../../../../../../shared/utils/concurrency.js';

// -------- Fetch Source Files --------

/** Fetch source code for a list of files concurrently. */
export async function fetchSourceFiles(client, filesToFetch, branch, concurrency) {
  logger.info(`Fetching ${filesToFetch.length} source files with concurrency=${concurrency}`);

  const progressLogger = createProgressLogger('Source files', filesToFetch.length);

  const results = await mapConcurrent(
    filesToFetch,
    async (file) => {
      logger.debug(`Fetching source: ${file.path || file.key}`);
      const content = await client.getSourceCode(file.key, branch);
      return new SourceFileData(file.key, content, file.language || '');
    },
    { concurrency, settled: true, onProgress: progressLogger },
  );

  const sourceFiles = results
    .filter(r => r.status === 'fulfilled')
    .map(r => r.value);

  const failed = results.filter(r => r.status === 'rejected').length;
  if (failed > 0) logger.warn(`Failed to fetch ${failed} source files`);

  logger.info(`Successfully extracted ${sourceFiles.length} source files`);
  return sourceFiles;
}
