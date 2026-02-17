import logger from '../../utils/logger.js';
import { mapConcurrent } from '../../utils/concurrency.js';

/**
 * Extract ALM/DevOps platform settings and project bindings
 * @param {import('../api-client.js').SonarQubeClient} client
 * @returns {Promise<object>} ALM settings and platform definitions
 */
export async function extractAlmSettings(client) {
  const settings = await client.getAlmSettings();
  logger.info('Extracted ALM/DevOps platform settings');

  return {
    github: settings.github || [],
    gitlab: settings.gitlab || [],
    azure: settings.azure || [],
    bitbucket: settings.bitbucket || [],
    bitbucketcloud: settings.bitbucketcloud || []
  };
}

/**
 * Extract DevOps binding for a specific project
 * @param {import('../api-client.js').SonarQubeClient} client
 * @param {string} projectKey - Project key
 * @returns {Promise<object|null>} Project binding or null
 */
export async function extractProjectBinding(client, projectKey) {
  const binding = await client.getProjectBinding(projectKey);

  if (!binding) {
    return null;
  }

  return {
    alm: binding.alm,
    key: binding.key,
    repository: binding.repository || null,
    slug: binding.slug || null,
    url: binding.url || null,
    summaryCommentEnabled: binding.summaryCommentEnabled || false,
    monorepo: binding.monorepo || false
  };
}

/**
 * Extract DevOps bindings for all projects
 * @param {import('../api-client.js').SonarQubeClient} client
 * @param {Array} projects - List of projects with .key property
 * @param {object} [options] - Performance options
 * @param {number} [options.concurrency=10] - Max concurrent binding fetches
 * @returns {Promise<Map<string, object>>} Map of projectKey -> binding
 */
export async function extractAllProjectBindings(client, projects, options = {}) {
  const concurrency = options.concurrency || 10;

  logger.info(`Extracting DevOps bindings for ${projects.length} projects (concurrency=${concurrency})...`);

  const results = await mapConcurrent(
    projects,
    async (project) => {
      const binding = await extractProjectBinding(client, project.key);
      return { key: project.key, binding };
    },
    { concurrency, settled: true }
  );

  const bindings = new Map();
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value.binding) {
      bindings.set(r.value.key, r.value.binding);
    }
  }

  logger.info(`Found DevOps bindings for ${bindings.size}/${projects.length} projects`);
  return bindings;
}
