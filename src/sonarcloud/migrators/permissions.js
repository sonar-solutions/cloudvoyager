import logger from '../../utils/logger.js';

/**
 * Migrate organization-level group permissions
 * @param {Array} globalPermissions - Global permissions from SonarQube
 * @param {import('../api-client.js').SonarCloudClient} client
 */
export async function migrateGlobalPermissions(globalPermissions, client) {
  logger.info(`Migrating global permissions for ${globalPermissions.length} groups`);

  for (const group of globalPermissions) {
    for (const permission of group.permissions) {
      try {
        await client.addGroupPermission(group.name, permission);
        logger.debug(`Added ${permission} to group ${group.name}`);
      } catch (error) {
        logger.debug(`Failed to add ${permission} to group ${group.name}: ${error.message}`);
      }
    }
  }
}

/**
 * Migrate project-level group permissions
 * @param {string} projectKey - SonarCloud project key
 * @param {Array} projectPermissions - Project permissions from SonarQube
 * @param {import('../api-client.js').SonarCloudClient} client
 */
export async function migrateProjectPermissions(projectKey, projectPermissions, client) {
  logger.debug(`Migrating project permissions for ${projectKey}: ${projectPermissions.length} groups`);

  for (const group of projectPermissions) {
    for (const permission of group.permissions) {
      try {
        await client.addProjectGroupPermission(group.name, projectKey, permission);
      } catch (error) {
        logger.debug(`Failed to add ${permission} for group ${group.name} on ${projectKey}: ${error.message}`);
      }
    }
  }
}

/**
 * Migrate permission templates
 * @param {object} templateData - Templates data from SonarQube
 * @param {import('../api-client.js').SonarCloudClient} client
 * @returns {Promise<Map<string, string>>} Mapping of SQ template ID -> SC template ID
 */
export async function migratePermissionTemplates(templateData, client) {
  const templateMapping = new Map();
  const { templates, defaultTemplates } = templateData;

  logger.info(`Migrating ${templates.length} permission templates`);

  for (const template of templates) {
    await migrateOneTemplate(template, templateMapping, client);
  }

  await applyDefaultTemplates(defaultTemplates, templateMapping, client);

  return templateMapping;
}

async function migrateOneTemplate(template, templateMapping, client) {
  try {
    const created = await client.createPermissionTemplate(
      template.name,
      template.description,
      template.projectKeyPattern
    );

    const scTemplateId = created.id;
    templateMapping.set(template.id, scTemplateId);

    await addTemplateGroupPermissions(scTemplateId, template.permissions, client);
    logger.info(`Migrated permission template: ${template.name}`);
  } catch (error) {
    logger.warn(`Failed to migrate template ${template.name}: ${error.message}`);
  }
}

async function addTemplateGroupPermissions(scTemplateId, permissions, client) {
  for (const perm of permissions) {
    if (perm.groupsCount <= 0) continue;

    for (const groupName of (perm.groups || [])) {
      try {
        await client.addGroupToTemplate(scTemplateId, groupName, perm.key);
      } catch (error) {
        logger.debug(`Failed to add group ${groupName} to template: ${error.message}`);
      }
    }
  }
}

async function applyDefaultTemplates(defaultTemplates, templateMapping, client) {
  for (const defaultTemplate of defaultTemplates) {
    const scTemplateId = templateMapping.get(defaultTemplate.templateId);
    if (!scTemplateId) continue;

    try {
      await client.setDefaultTemplate(scTemplateId, defaultTemplate.qualifier);
      logger.info(`Set default template for qualifier ${defaultTemplate.qualifier}`);
    } catch (error) {
      logger.warn(`Failed to set default template: ${error.message}`);
    }
  }
}
