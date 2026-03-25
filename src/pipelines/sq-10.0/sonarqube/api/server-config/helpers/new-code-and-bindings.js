import logger from '../../../../../../shared/utils/logger.js';

// -------- New Code Periods & Bindings --------

export async function getNewCodePeriods(client, projectKey) {
  logger.info(`Fetching new code periods for: ${projectKey}`);
  let projectLevel = null;
  let branchOverrides = [];
  try {
    const response = await client.get('/api/new_code_periods/show', { params: { project: projectKey } });
    projectLevel = response.data;
  } catch (error) { logger.debug(`No project-level new code period for ${projectKey}: ${error.message}`); }
  try {
    const response = await client.get('/api/new_code_periods/list', { params: { project: projectKey } });
    branchOverrides = response.data.newCodePeriods || [];
  } catch (error) { logger.debug(`Failed to get branch-level new code periods for ${projectKey}: ${error.message}`); }
  return { projectLevel, branchOverrides };
}

export async function getAlmSettings(client) {
  logger.info('Fetching ALM/DevOps settings');
  try {
    const response = await client.get('/api/alm_settings/list_definitions');
    return response.data;
  } catch (error) { logger.warn(`Failed to get ALM settings: ${error.message}`); return {}; }
}

export async function getProjectBinding(client, projectKey) {
  logger.debug(`Fetching project binding for: ${projectKey}`);
  try {
    const response = await client.get('/api/alm_settings/get_binding', { params: { project: projectKey } });
    return response.data;
  } catch (error) { logger.debug(`No binding found for project ${projectKey}: ${error.message}`); return null; }
}
