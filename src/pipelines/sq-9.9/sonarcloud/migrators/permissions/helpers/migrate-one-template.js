import logger from '../../../../../../shared/utils/logger.js';

// -------- Migrate a Single Permission Template --------

export async function migrateOneTemplate(template, templateMapping, client) {
  try {
    const created = await client.createPermissionTemplate(template.name, template.description, template.projectKeyPattern);
    templateMapping.set(template.id, created.id);

    for (const perm of template.permissions) {
      if (perm.groupsCount <= 0) continue;
      for (const groupName of (perm.groups || [])) {
        try {
          await client.addGroupToTemplate(created.id, groupName, perm.key);
        } catch (error) {
          logger.debug(`Failed to add group ${groupName} to template: ${error.message}`);
        }
      }
    }
    logger.info(`Migrated permission template: ${template.name}`);
  } catch (error) {
    logger.warn(`Failed to migrate template ${template.name}: ${error.message}`);
  }
}
