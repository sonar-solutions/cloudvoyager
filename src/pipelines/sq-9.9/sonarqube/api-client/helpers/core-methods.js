import logger from '../../../../../shared/utils/logger.js';
import { SonarQubeAPIError } from '../../../../../shared/utils/errors.js';

// -------- Core SonarQube Client Methods --------

export async function testConnection(client) {
  try {
    logger.info('Testing connection to SonarQube...');
    await client.get('/api/system/status');
    logger.info('Successfully connected to SonarQube');
    return true;
  } catch (error) { logger.error(`Failed to connect to SonarQube: ${error.message}`); throw error; }
}

export async function getServerVersion(client) {
  try {
    const response = await client.get('/api/system/status');
    return response.data.version || 'unknown';
  } catch (error) { logger.warn(`Failed to get server version: ${error.message}`); return 'unknown'; }
}

export async function getProject(client, projectKey) {
  logger.info(`Fetching project: ${projectKey}`);
  const response = await client.get('/api/projects/search', { params: { projects: projectKey } });
  const projects = response.data.components || [];
  if (projects.length === 0) throw new SonarQubeAPIError(`Project not found: ${projectKey}`);
  return projects[0];
}

export async function getBranches(client, projectKey) {
  logger.debug(`Fetching branches for project: ${projectKey}`);
  const response = await client.get('/api/project_branches/list', { params: { project: projectKey } });
  return response.data.branches || [];
}

export async function getQualityGate(client, projectKey) {
  logger.info(`Fetching quality gate for project: ${projectKey}`);
  try {
    const response = await client.get('/api/qualitygates/get_by_project', { params: { project: projectKey } });
    return response.data.qualityGate || null;
  } catch (error) {
    if (error.statusCode === 404) { logger.warn('No quality gate found for project'); return null; }
    throw error;
  }
}
