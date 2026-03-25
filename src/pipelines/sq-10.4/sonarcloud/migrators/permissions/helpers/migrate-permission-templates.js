import logger from '../../../../../../shared/utils/logger.js';
import { migrateOneTemplate } from './migrate-one-template.js';
import { applyDefaultTemplates } from './apply-default-templates.js';

// -------- Main Logic --------

// Migrate all permission templates from SQ to SC.
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
