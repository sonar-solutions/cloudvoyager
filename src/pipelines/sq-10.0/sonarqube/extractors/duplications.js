import logger from '../../../../shared/utils/logger.js';
import { mapConcurrent, createProgressLogger } from '../../../../shared/utils/concurrency.js';

/**
 * Extract duplication block data from SonarQube for all files that have duplications.
 *
 * Uses the component measures (duplicated_blocks > 0) to identify which files
 * have duplications, then fetches the detailed duplication data via the
 * /api/duplications/show endpoint for each.
 *
 * @param {SonarQubeClient} client - SonarQube client
 * @param {Array} components - Array of component objects (from extractComponentMeasures)
 * @param {string} [branch=null] - Branch name (optional)
 * @param {object} [options={}] - Performance options
 * @param {number} [options.concurrency=5] - Max concurrent API calls
 * @returns {Promise<Map<string, object>>} Map of componentKey → API response (duplications + files)
 */
export async function extractDuplications(client, components, branch = null, options = {}) {
  const concurrency = options.concurrency || 5;

  // Find FILE components with duplicated_blocks > 0
  const filesWithDups = components.filter(c => {
    if (c.qualifier !== 'FIL') return false;
    const dupBlocks = (c.measures || []).find(m => m.metric === 'duplicated_blocks');
    return dupBlocks && parseInt(dupBlocks.value, 10) > 0;
  });

  if (filesWithDups.length === 0) {
    logger.info('No files with duplications found');
    return new Map();
  }

  logger.info(`Found ${filesWithDups.length} files with duplications, fetching details...`);

  const progressLogger = createProgressLogger('Duplications', filesWithDups.length);
  const duplicationsMap = new Map();

  const results = await mapConcurrent(
    filesWithDups,
    async (file) => {
      const data = await client.getDuplications(file.key, branch);
      return { key: file.key, data };
    },
    { concurrency, settled: true, onProgress: progressLogger }
  );

  results
    .filter(r => r.status === 'fulfilled')
    .forEach(r => {
      const { key, data } = r.value;
      if (data.duplications && data.duplications.length > 0) {
        duplicationsMap.set(key, data);
      }
    });

  const failed = results.filter(r => r.status === 'rejected').length;
  if (failed > 0) {
    logger.warn(`Failed to fetch duplications for ${failed} files`);
  }

  logger.info(`Extracted duplications for ${duplicationsMap.size} files`);
  return duplicationsMap;
}
