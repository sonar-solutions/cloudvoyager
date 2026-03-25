import logger from '../../../../../../shared/utils/logger.js';
import { addTemplateGroupPermissions } from './add-template-group-permissions.js';

// -------- Main Logic --------

// Migrate a single permission template from SQ to SC.
export async function migrateOneTemplate(template, templateMapping, client) {
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
