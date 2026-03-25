import logger from '../../../../../../shared/utils/logger.js';

// -------- Extract Permission Templates --------

/** Extract permission templates with their group assignments. */
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
      permissions: t.permissions || [],
    })),
    defaultTemplates: defaultTemplates.map(d => ({
      templateId: d.templateId,
      qualifier: d.qualifier,
    })),
  };
}
