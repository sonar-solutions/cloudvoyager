// -------- Collect Duplication Results --------

import logger from '../../../../../../shared/utils/logger.js';

export function collectDuplicationResults(results) {
  const duplicationsMap = new Map();

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
