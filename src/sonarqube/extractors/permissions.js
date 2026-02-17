import logger from '../../utils/logger.js';

/**
 * Extract organization-level (global) group permissions
 * @param {import('../api-client.js').SonarQubeClient} client
 * @returns {Promise<Array>} Global group permissions
 */
export async function extractGlobalPermissions(client) {
  const groups = await client.getGlobalPermissions();
  logger.info(`Found ${groups.length} groups with global permissions`);

  return groups.map(g => ({
    name: g.name,
    description: g.description || '',
    permissions: g.permissions || []
  }));
}

/**
 * Extract project-level group permissions
 * @param {import('../api-client.js').SonarQubeClient} client
 * @param {string} projectKey - Project key
 * @returns {Promise<Array>} Project group permissions
 */
export async function extractProjectPermissions(client, projectKey) {
  const groups = await client.getProjectPermissions(projectKey);
  logger.debug(`Found ${groups.length} groups with permissions for project: ${projectKey}`);

  return groups.map(g => ({
    name: g.name,
    description: g.description || '',
    permissions: g.permissions || []
  }));
}

/**
 * Extract permission templates with their group assignments
 * @param {import('../api-client.js').SonarQubeClient} client
 * @returns {Promise<object>} Permission templates data
 */
export async function extractPermissionTemplates(client) {
  const data = await client.getPermissionTemplates();
  const templates = data.permissionTemplates || [];
  const defaultTemplates = data.defaultTemplates || [];

  logger.info(`Found ${templates.length} permission templates`);

  return {
    templates: templates.map(t => ({
      id: t.id,
      name: t.name,
      description: t.description || '',
      projectKeyPattern: t.projectKeyPattern || '',
      permissions: t.permissions || []
    })),
    defaultTemplates: defaultTemplates.map(d => ({
      templateId: d.templateId,
      qualifier: d.qualifier
    }))
  };
}
