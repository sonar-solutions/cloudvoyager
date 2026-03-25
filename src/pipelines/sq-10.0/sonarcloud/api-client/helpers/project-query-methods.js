import logger from '../../../../../shared/utils/logger.js';

// -------- Project-Specific Query Methods --------

export async function getProjectMeasures(client, projectKey, metricKeys) {
  const response = await client.get('/api/measures/component', { params: { component: projectKey, metricKeys: metricKeys.join(',') } });
  return response.data.component || {};
}

export async function getProjectSettings(client, projectKey) {
  const response = await client.get('/api/settings/values', { params: { component: projectKey } });
  return response.data.settings || [];
}

export async function getProjectLinks(client, projectKey) {
  const response = await client.get('/api/project_links/search', { params: { projectKey } });
  return response.data.links || [];
}

export async function getProjectTagsForProject(client, projectKey) {
  try {
    const response = await client.get('/api/project_tags/search', { params: { project: projectKey, ps: 100 } });
    return response.data.tags || [];
  } catch (error) {
    logger.debug(`Failed to get tags for ${projectKey}: ${error.message}`);
    return [];
  }
}

export async function getNewCodePeriods(client, projectKey) {
  let projectLevel = null;
  let branchOverrides = [];
  try { const r = await client.get('/api/new_code_periods/show', { params: { project: projectKey } }); projectLevel = r.data; }
  catch (e) { logger.debug(`No project-level new code period for ${projectKey}: ${e.message}`); }
  try { const r = await client.get('/api/new_code_periods/list', { params: { project: projectKey } }); branchOverrides = r.data.newCodePeriods || []; }
  catch (e) { logger.debug(`Failed to get branch new code periods for ${projectKey}: ${e.message}`); }
  return { projectLevel, branchOverrides };
}

export async function getProjectBinding(client, projectKey) {
  try {
    const response = await client.get('/api/alm_settings/get_binding', { params: { project: projectKey } });
    return response.data;
  } catch (error) {
    logger.debug(`No binding for ${projectKey}: ${error.message}`);
    return null;
  }
}

export { getHotspotDetails } from './hotspot-query-methods.js';
