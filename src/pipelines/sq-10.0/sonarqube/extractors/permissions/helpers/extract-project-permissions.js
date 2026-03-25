// -------- Extract Project Permissions --------

import logger from '../../../../../../shared/utils/logger.js';

export async function extractProjectPermissions(client, projectKey) {
  const groups = await client.getProjectPermissions(projectKey);
  logger.debug(`Found ${groups.length} groups with permissions for project: ${projectKey}`);

  return groups.map(g => ({
    name: g.name,
    description: g.description || '',
    permissions: g.permissions || []
  }));
}
