import logger from '../../../../../../shared/utils/logger.js';

// -------- Migrate DevOps Binding --------

export async function migrateDevOpsBinding(projectKey, binding, client) {
  if (!binding) return;

  logger.info(`Setting ${binding.alm} DevOps binding for ${projectKey}`);

  try {
    await applyBinding(client, projectKey, binding);
  } catch (error) {
    logger.warn(`Failed to set DevOps binding for ${projectKey}: ${error.message}`);
  }
}

async function applyBinding(client, projectKey, binding) {
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
}
