// -------- Log Unsyncable Warning --------

import logger from '../../../utils/logger.js';

/**
 * Log the unsyncable items warning to the console.
 */
export function logUnsyncableWarning() {
  logger.info('');
  logger.warn('=== Unsyncable Items ===');
  logger.warn('The following differences are expected and cannot be synced via API:');
  logger.warn('  - Issue type changes (SonarQube Standard Experience → SonarCloud): type changes are not API-syncable');
  logger.warn('  - Issue severity changes: severity overrides are not API-syncable in either Standard or MQR mode');
  logger.warn('  - Hotspot assignments: the hotspot sync API does not support assignment changes');
}
