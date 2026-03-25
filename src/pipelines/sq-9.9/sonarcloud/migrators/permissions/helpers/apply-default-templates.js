import logger from '../../../../../../shared/utils/logger.js';

// -------- Apply Default Permission Templates --------

export async function applyDefaultTemplates(defaultTemplates, templateMapping, client) {
  for (const dt of defaultTemplates) {
    const scTemplateId = templateMapping.get(dt.templateId);
    if (!scTemplateId) continue;
    try {
      await client.setDefaultTemplate(scTemplateId, dt.qualifier);
      logger.info(`Set default template for qualifier ${dt.qualifier}`);
    } catch (error) {
      logger.warn(`Failed to set default template: ${error.message}`);
    }
  }
}
