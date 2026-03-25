import logger from '../../../../../../shared/utils/logger.js';

// -------- Migrate DevOps Binding --------

/** Migrate DevOps binding for a project to SonarCloud. */
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
        await client.setAzureBinding(projectKey, binding.key, binding.slug, binding.repository);
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
