import logger from '../../../../../../shared/utils/logger.js';
import { mapConcurrent } from '../../../../../../shared/utils/concurrency/helpers/map-concurrent.js';

// -------- Migrate Global Permissions --------

export async function migrateGlobalPermissions(globalPermissions, client, { concurrency = 10 } = {}) {
  logger.info(`Migrating global permissions for ${globalPermissions.length} groups`);

  // Flatten nested loops into parallel tasks
  const tasks = globalPermissions.flatMap(group =>
    group.permissions.map(perm => ({ groupName: group.name, permission: perm }))
  );

  await mapConcurrent(tasks, async ({ groupName, permission }) => {
    try {
      await client.addGroupPermission(groupName, permission);
      logger.debug(`Added ${permission} to group ${groupName}`);
    } catch (error) {
      logger.debug(`Failed to add ${permission} to group ${groupName}: ${error.message}`);
    }
  }, { concurrency, settled: true });
}
