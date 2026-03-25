import logger from '../../../../../../shared/utils/logger.js';

// -------- Apply Default Templates --------

/** Set default permission templates for each qualifier. */
export async function applyDefaultTemplates(defaultTemplates, templateMapping, client) {
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
