import logger from '../../../../../../shared/utils/logger.js';
import { mapConcurrent } from '../../../../../../shared/utils/concurrency/helpers/map-concurrent.js';
import { migrateOneTemplate } from './migrate-one-template.js';
import { applyDefaultTemplates } from './apply-default-templates.js';

// -------- Main Logic --------

// Migrate all permission templates from SQ to SC.
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
