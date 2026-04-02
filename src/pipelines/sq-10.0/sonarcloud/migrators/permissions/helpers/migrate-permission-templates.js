import logger from '../../../../../../shared/utils/logger.js';
import { mapConcurrent } from '../../../../../../shared/utils/concurrency/helpers/map-concurrent.js';

// -------- Migrate Permission Templates --------

export async function migratePermissionTemplates(templateData, client) {
  const templateMapping = new Map();
  const { templates, defaultTemplates } = templateData;
  logger.info(`Migrating ${templates.length} permission templates`);

  await mapConcurrent(templates, async (template) => {
    await migrateOneTemplate(template, templateMapping, client);
  }, { concurrency: 5, settled: true });

  await applyDefaultTemplates(defaultTemplates, templateMapping, client);
  return templateMapping;
}

async function migrateOneTemplate(template, templateMapping, client) {
  try {
    const created = await client.createPermissionTemplate(template.name, template.description, template.projectKeyPattern);
    const scTemplateId = created.id;
    templateMapping.set(template.id, scTemplateId);
    for (const perm of template.permissions) {
      if (perm.groupsCount <= 0) continue;
      for (const groupName of (perm.groups || [])) {
        try { await client.addGroupToTemplate(scTemplateId, groupName, perm.key); }
        catch (error) { logger.debug(`Failed to add group ${groupName} to template: ${error.message}`); }
      }
    }
    logger.info(`Migrated permission template: ${template.name}`);
  } catch (error) { logger.warn(`Failed to migrate template ${template.name}: ${error.message}`); }
}

async function applyDefaultTemplates(defaultTemplates, templateMapping, client) {
  for (const dt of defaultTemplates) {
    const scTemplateId = templateMapping.get(dt.templateId);
    if (!scTemplateId) continue;
    try { await client.setDefaultTemplate(scTemplateId, dt.qualifier); logger.info(`Set default template for qualifier ${dt.qualifier}`); }
    catch (error) { logger.warn(`Failed to set default template: ${error.message}`); }
  }
}
