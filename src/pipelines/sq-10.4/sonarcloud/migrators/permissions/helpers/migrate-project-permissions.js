import logger from '../../../../../../shared/utils/logger.js';

// -------- Main Logic --------

// Migrate project-level group permissions.
export async function migrateProjectPermissions(projectKey, projectPermissions, client) {
  logger.debug(`Migrating project permissions for ${projectKey}: ${projectPermissions.length} groups`);

  for (const group of projectPermissions) {
    for (const permission of group.permissions) {
      try {
        await client.addProjectGroupPermission(group.name, projectKey, permission);
      } catch (error) {
        logger.debug(`Failed to add ${permission} for group ${group.name} on ${projectKey}: ${error.message}`);
      }
    }
  }
}
