import logger from './logger.js';
import { TARGET_PERMISSION_GROUP, ALL_GLOBAL_PERMISSIONS, ALL_PROJECT_PERMISSIONS } from './permission-constants.js';

export async function grantGlobalPermissions(client) {
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

export async function grantProjectPermissions(projectKey, client) {
  logger.info(`Granting all permissions on project "${projectKey}" to group "${TARGET_PERMISSION_GROUP}"`);
  for (const permission of ALL_PROJECT_PERMISSIONS) {
    try {
      await client.addProjectGroupPermission(TARGET_PERMISSION_GROUP, projectKey, permission);
    } catch (error) {
      logger.warn(`Failed to grant "${permission}" on "${projectKey}" to "${TARGET_PERMISSION_GROUP}": ${error.message}`);
    }
  }
}
