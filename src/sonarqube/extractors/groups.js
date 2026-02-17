import logger from '../../utils/logger.js';

/**
 * Extract all user groups
 * @param {import('../api-client.js').SonarQubeClient} client
 * @returns {Promise<Array>} User groups
 */
export async function extractGroups(client) {
  const groups = await client.getGroups();
  logger.info(`Found ${groups.length} user groups`);

  return groups.map(group => ({
    id: group.id,
    name: group.name,
    description: group.description || '',
    membersCount: group.membersCount || 0,
    default: group.default || false
  }));
}
