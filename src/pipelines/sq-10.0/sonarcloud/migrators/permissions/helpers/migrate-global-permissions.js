import logger from '../../../../../../shared/utils/logger.js';

// -------- Migrate Global Permissions --------

export async function migrateGlobalPermissions(globalPermissions, client) {
  logger.info(`Migrating global permissions for ${globalPermissions.length} groups`);

  for (const group of globalPermissions) {
    for (const permission of group.permissions) {
      try {
        await client.addGroupPermission(group.name, permission);
        logger.debug(`Added ${permission} to group ${group.name}`);
      } catch (error) {
        logger.debug(`Failed to add ${permission} to group ${group.name}: ${error.message}`);
      }
    }
  }
}
