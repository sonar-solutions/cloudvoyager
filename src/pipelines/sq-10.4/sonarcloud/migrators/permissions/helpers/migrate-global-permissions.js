import logger from '../../../../../../shared/utils/logger.js';
import { TARGET_PERMISSION_GROUP, ALL_GLOBAL_PERMISSIONS } from '../../../../../../shared/utils/permission-constants.js';

// -------- Grant All Global Permissions --------

export async function migrateGlobalPermissions(globalPermissions, client) {
  logger.info(`Granting all global permissions to group "${TARGET_PERMISSION_GROUP}"`);

  for (const permission of ALL_GLOBAL_PERMISSIONS) {
    try {
      await client.addGroupPermission(TARGET_PERMISSION_GROUP, permission);
      logger.debug(`Granted global "${permission}" to "${TARGET_PERMISSION_GROUP}"`);
    } catch (error) {
      logger.warn(`Failed to grant global "${permission}" to "${TARGET_PERMISSION_GROUP}": ${error.message}`);
    }
  }
}
