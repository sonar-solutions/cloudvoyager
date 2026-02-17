import logger from '../../utils/logger.js';

/**
 * Migrate user groups from SonarQube to SonarCloud
 * @param {Array} extractedGroups - Groups extracted from SonarQube
 * @param {import('../api-client.js').SonarCloudClient} client - SonarCloud client
 * @returns {Promise<Map<string, object>>} Mapping of group name -> created group
 */
export async function migrateGroups(extractedGroups, client) {
  const groupMapping = new Map();

  // Skip default system groups that SonarCloud creates automatically
  const SYSTEM_GROUPS = new Set(['Anyone', 'sonar-users', 'sonar-administrators']);
  const customGroups = extractedGroups.filter(g => !SYSTEM_GROUPS.has(g.name));

  logger.info(`Migrating ${customGroups.length} custom groups (skipping ${extractedGroups.length - customGroups.length} system groups)`);

  for (const group of customGroups) {
    try {
      const created = await client.createGroup(group.name, group.description);
      groupMapping.set(group.name, created);
      logger.info(`Created group: ${group.name}`);
    } catch (error) {
      if (error.message?.includes('already exists')) {
        logger.debug(`Group ${group.name} already exists in SonarCloud`);
        groupMapping.set(group.name, { name: group.name });
      } else {
        logger.warn(`Failed to create group ${group.name}: ${error.message}`);
      }
    }
  }

  return groupMapping;
}
