// -------- Extract Duplications --------

import logger from '../../../../../shared/utils/logger.js';
import { mapConcurrent, createProgressLogger } from '../../../../../shared/utils/concurrency.js';
import { findFilesWithDuplications } from './helpers/find-files-with-duplications.js';
import { collectDuplicationResults } from './helpers/collect-duplication-results.js';

export async function extractDuplications(client, components, branch = null, options = {}) {
  const concurrency = options.concurrency || 5;
  const filesWithDups = findFilesWithDuplications(components);

  if (filesWithDups.length === 0) {
    logger.info('No files with duplications found');
    return new Map();
  }

  logger.info(`Found ${filesWithDups.length} files with duplications, fetching details...`);
  const progressLogger = createProgressLogger('Duplications', filesWithDups.length);

  const results = await mapConcurrent(
    filesWithDups,
    async (file) => {
      const data = await client.getDuplications(file.key, branch);
      return { key: file.key, data };
    },
    { concurrency, settled: true, onProgress: progressLogger }
  );

  return collectDuplicationResults(results);
}
