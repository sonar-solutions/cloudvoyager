import logger from '../../../../../../shared/utils/logger.js';
import { TARGET_PERMISSION_GROUP, ALL_PROJECT_PERMISSIONS } from '../../../../../../shared/utils/permission-constants.js';

// -------- Grant All Project Permissions --------

export async function migrateProjectPermissions(projectKey, projectPermissions, client) {
  logger.info(`Granting all permissions on project "${projectKey}" to group "${TARGET_PERMISSION_GROUP}"`);

  for (const permission of ALL_PROJECT_PERMISSIONS) {
    try {
      await client.addProjectGroupPermission(TARGET_PERMISSION_GROUP, projectKey, permission);
    } catch (error) {
      logger.warn(`Failed to grant "${permission}" on "${projectKey}" to "${TARGET_PERMISSION_GROUP}": ${error.message}`);
    }
  }
}
