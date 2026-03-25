import logger from '../../../../../../shared/utils/logger.js';

// -------- Main Logic --------

// Extract organization-level (global) group permissions.
export async function extractGlobalPermissions(client) {
  const groups = await client.getGlobalPermissions();
  logger.info(`Found ${groups.length} groups with global permissions`);

  return groups.map(g => ({
    name: g.name,
    description: g.description || '',
    permissions: g.permissions || []
  }));
}
