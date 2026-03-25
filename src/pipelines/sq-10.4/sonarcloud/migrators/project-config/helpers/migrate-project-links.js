import logger from '../../../../../../shared/utils/logger.js';

// -------- Main Logic --------

// Migrate project links.
export async function migrateProjectLinks(projectKey, links, client) {
  if (!links || links.length === 0) return;
  logger.info(`Creating ${links.length} project links for ${projectKey}`);
  for (const link of links) {
    try {
      await client.createProjectLink(projectKey, link.name, link.url);
      logger.debug(`Created link: ${link.name}`);
    } catch (error) {
      logger.debug(`Failed to create link ${link.name}: ${error.message}`);
    }
  }
}
