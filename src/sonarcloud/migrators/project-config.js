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
 * Migrate new code period definitions.
 * SonarCloud staging does not have /api/new_code_periods/* endpoints.
 * Instead, we set sonar.leak.period via the settings API.
 * Supported types: NUMBER_OF_DAYS (value = number), PREVIOUS_VERSION (value = "previous_version").
 *
 * Strategy:
 *   1. If the project-level definition is mappable, use it.
 *   2. Otherwise, fall back to the main branch override (if mappable).
 *   3. Warn about unsupported types (e.g. REFERENCE_BRANCH, SPECIFIC_ANALYSIS).
 *
 * @param {string} projectKey - SonarCloud project key
 * @param {{projectLevel: object|null, branchOverrides: Array}} newCodeData - Extracted new code period data
 * @param {import('../api-client.js').SonarCloudClient} client
 */
export async function migrateNewCodePeriods(projectKey, newCodeData, client) {
  if (!newCodeData) return;

  const { projectLevel, branchOverrides } = newCodeData;
  if (!projectLevel && (!branchOverrides || branchOverrides.length === 0)) return;

  // Try project-level first
  let leakPeriodValue = null;
  let sourceLabel = null;

  if (projectLevel && projectLevel.leakPeriodValue) {
    leakPeriodValue = projectLevel.leakPeriodValue;
    sourceLabel = `project-level ${projectLevel.type}`;
  }

  // Fall back to main branch override if project-level isn't mappable
  if (!leakPeriodValue && branchOverrides && branchOverrides.length > 0) {
    // Prefer the main branch, otherwise use the first available
    const mainBranch = branchOverrides.find(b => b.branchKey === 'main' || b.branchKey === 'master');
    const fallback = mainBranch || branchOverrides[0];
    if (fallback.leakPeriodValue) {
      leakPeriodValue = fallback.leakPeriodValue;
      sourceLabel = `branch-level ${fallback.type} (branch: ${fallback.branchKey})`;
    }
  }

  if (!leakPeriodValue) {
    const types = [projectLevel?.type, ...((branchOverrides || []).map(b => b.type))].filter(Boolean);
    logger.warn(`Cannot migrate new code definition for ${projectKey}: unsupported type(s) ${types.join(', ')} (only NUMBER_OF_DAYS and PREVIOUS_VERSION are supported)`);
    return;
  }

  logger.info(`Setting new code definition for ${projectKey}: sonar.leak.period=${leakPeriodValue} (from ${sourceLabel})`);

  try {
    await client.setProjectSetting('sonar.leak.period', leakPeriodValue, projectKey);
  } catch (error) {
    logger.warn(`Failed to set new code definition for ${projectKey}: ${error.message}`);
    throw error;
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
