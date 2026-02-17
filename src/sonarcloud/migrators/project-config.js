import logger from '../../utils/logger.js';

/**
 * Migrate project settings (non-inherited configuration values)
 * @param {string} projectKey - SonarCloud project key
 * @param {Array} settings - Project settings from SonarQube
 * @param {import('../api-client.js').SonarCloudClient} client
 */
export async function migrateProjectSettings(projectKey, settings, client) {
  logger.info(`Migrating ${settings.length} project settings for ${projectKey}`);

  for (const setting of settings) {
    try {
      const value = setting.value || (setting.values ? setting.values.join(',') : '');
      if (value) {
        await client.setProjectSetting(setting.key, value, projectKey);
        logger.debug(`Set setting ${setting.key} on ${projectKey}`);
      }
    } catch (error) {
      logger.debug(`Failed to set setting ${setting.key} on ${projectKey}: ${error.message}`);
    }
  }
}

/**
 * Migrate project tags
 * @param {string} projectKey - SonarCloud project key
 * @param {Array<string>} tags - Project tags
 * @param {import('../api-client.js').SonarCloudClient} client
 */
export async function migrateProjectTags(projectKey, tags, client) {
  if (!tags || tags.length === 0) return;

  logger.info(`Setting ${tags.length} tags on project ${projectKey}`);

  try {
    await client.setProjectTags(projectKey, tags);
  } catch (error) {
    logger.warn(`Failed to set project tags on ${projectKey}: ${error.message}`);
  }
}

/**
 * Migrate project links
 * @param {string} projectKey - SonarCloud project key
 * @param {Array} links - Project links from SonarQube
 * @param {import('../api-client.js').SonarCloudClient} client
 */
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

/**
 * Migrate new code period definitions
 * @param {string} projectKey - SonarCloud project key
 * @param {Array} periods - New code period definitions from SonarQube
 * @param {import('../api-client.js').SonarCloudClient} client
 */
export async function migrateNewCodePeriods(projectKey, periods, client) {
  if (!periods || periods.length === 0) return;

  // Only migrate non-inherited periods
  const ownPeriods = periods.filter(p => !p.inherited);
  if (ownPeriods.length === 0) return;

  logger.info(`Migrating ${ownPeriods.length} new code period definitions for ${projectKey}`);

  for (const period of ownPeriods) {
    try {
      await client.setNewCodePeriod(projectKey, period.type, period.value, period.branchKey);
      logger.debug(`Set new code period: ${period.type}${period.branchKey ? ` (branch: ${period.branchKey})` : ''}`);
    } catch (error) {
      logger.debug(`Failed to set new code period: ${error.message}`);
    }
  }
}

/**
 * Migrate DevOps binding for a project
 * @param {string} projectKey - SonarCloud project key
 * @param {object} binding - DevOps binding from SonarQube
 * @param {import('../api-client.js').SonarCloudClient} client
 */
export async function migrateDevOpsBinding(projectKey, binding, client) {
  if (!binding) return;

  logger.info(`Setting ${binding.alm} DevOps binding for ${projectKey}`);

  try {
    switch (binding.alm) {
      case 'github':
        await client.setGithubBinding(projectKey, binding.key, binding.repository, binding.monorepo);
        break;
      case 'gitlab':
        await client.setGitlabBinding(projectKey, binding.key, binding.repository);
        break;
      case 'azure':
        await client.setAzureBinding(projectKey, binding.key, binding.repository, binding.slug);
        break;
      case 'bitbucket':
      case 'bitbucketcloud':
        await client.setBitbucketBinding(projectKey, binding.key, binding.repository, binding.slug);
        break;
      default:
        logger.warn(`Unknown ALM type: ${binding.alm}`);
    }
  } catch (error) {
    logger.warn(`Failed to set DevOps binding for ${projectKey}: ${error.message}`);
  }
}
