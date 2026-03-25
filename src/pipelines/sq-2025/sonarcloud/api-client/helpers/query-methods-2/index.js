import logger from '../../../../../../shared/utils/logger.js';
export { getNewCodePeriods } from './helpers/get-new-code-periods.js';

// -------- Read-Only Query Methods (Part 2) --------

/** Get project measures for given metric keys. */
export async function getProjectMeasures(client, projectKey, metricKeys) {
  const response = await client.get('/api/measures/component', { params: { component: projectKey, metricKeys: metricKeys.join(',') } });
  return response.data.component || {};
}

/** Get project settings. */
export async function getProjectSettings(client, projectKey) {
  const response = await client.get('/api/settings/values', { params: { component: projectKey } });
  return response.data.settings || [];
}

/** Get project links. */
export async function getProjectLinks(client, projectKey) {
  const response = await client.get('/api/project_links/search', { params: { projectKey } });
  return response.data.links || [];
}

/** Get tags for a project. */
export async function getProjectTagsForProject(client, projectKey) {
  try {
    const response = await client.get('/api/project_tags/search', { params: { project: projectKey, ps: 100 } });
    return response.data.tags || [];
  } catch (error) {
    logger.debug(`Failed to get project tags for ${projectKey}: ${error.message}`);
    return [];
  }
}
