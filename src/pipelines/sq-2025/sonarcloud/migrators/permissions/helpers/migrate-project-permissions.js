import logger from '../../../../../../shared/utils/logger.js';

// -------- Migrate Project Permissions --------

/**
 * Migrate project-level group permissions using simplified mechanism.
 *
 * Since 'admin' permission at org level already grants all permissions on all projects,
 * this function skips per-project, per-group permission migration to avoid edge cases
 * where groups don't exist in SonarCloud.
 *
 * The global permission migration (grantAllPermissionsOnAllProjects) handles this
 * by granting admin access at the organization level, which automatically applies
 * to all projects.
 */
export async function migrateProjectPermissions(projectKey, projectPermissions, client) {
  const groupCount = projectPermissions?.length ?? 0;
  logger.debug(`Skipping project permissions for ${projectKey}: ${groupCount} groups (admin at org level grants all permissions on all projects)`);
}
