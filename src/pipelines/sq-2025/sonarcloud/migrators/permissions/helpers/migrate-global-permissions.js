import logger from '../../../../../../shared/utils/logger.js';

// -------- Migrate Global Permissions --------

/**
 * Migrate organization-level group permissions using simplified mechanism.
 *
 * Instead of trying to replicate the complex per-group, per-permission structure
 * from SonarQube (which fails silently when groups don't exist in SonarCloud),
 * this grants 'admin' permission at the org level to the Sonar Migration Admins group.
 *
 * The 'admin' permission at org level automatically grants all permissions on all projects.
 * This avoids edge cases where groups, users, etc. are not available in SQC.
 */
export async function migrateGlobalPermissions(globalPermissions, client, migrationAdminGroup = 'Sonar Migration Admins') {
  logger.info(`Migrating global permissions using simplified 'Grant All Permissions on All Projects' mechanism`);

  try {
    await client.grantAllPermissionsOnAllProjects(migrationAdminGroup);
    logger.info(`Successfully granted admin permission to '${migrationAdminGroup}' group (grants all permissions on all projects)`);
  } catch (error) {
    logger.warn(`Failed to grant admin permission to '${migrationAdminGroup}': ${error.message}`);
    // Fallback: try to grant admin permission to 'Anyone' group at org level
    logger.info(`Attempting fallback: granting admin permission to 'Anyone' group`);
    try {
      await client.grantAllPermissionsOnAllProjects('Anyone');
      logger.info(`Successfully granted admin permission to 'Anyone' group as fallback`);
    } catch (fallbackError) {
      logger.error(`Failed to grant admin permission to fallback group 'Anyone': ${fallbackError.message}`);
      throw fallbackError;
    }
  }
}
