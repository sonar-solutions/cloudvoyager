import logger from '../../../../../../shared/utils/logger.js';
import { mapConcurrent } from '../../../../../../shared/utils/concurrency/helpers/map-concurrent.js';

// -------- Migrate Project-Level Group Permissions --------

export async function migrateProjectPermissions(projectKey, projectPermissions, client, { concurrency = 10 } = {}) {
  logger.debug(`Migrating project permissions for ${projectKey}: ${projectPermissions.length} groups`);

  // Flatten nested loops into parallel tasks
  const tasks = projectPermissions.flatMap(group =>
    group.permissions.map(perm => ({ groupName: group.name, permission: perm }))
  );

  await mapConcurrent(tasks, async ({ groupName, permission }) => {
    try {
      await client.addProjectGroupPermission(groupName, projectKey, permission);
    } catch (error) {
      logger.debug(`Failed to add ${permission} for group ${groupName} on ${projectKey}: ${error.message}`);
    }
  }, { concurrency, settled: true });
}
