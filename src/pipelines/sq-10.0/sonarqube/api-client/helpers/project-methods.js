import logger from '../../../../../shared/utils/logger.js';
import { SonarQubeAPIError } from '../../../../../shared/utils/errors.js';

// -------- Project Query Methods --------

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

export async function getSourceCode(client, fileKey, branch = null) {
  logger.debug(`Fetching source code for: ${fileKey}`);
  const params = { key: fileKey };
  if (branch) params.branch = branch;
  const response = await client.get('/api/sources/raw', { params, responseType: 'text' });
  return response.data;
}

export async function getSourceFiles(client, projectKey, branch = null) {
  logger.info(`Fetching source files for project: ${projectKey}`);
  const params = { component: projectKey, qualifiers: 'FIL' };
  if (branch) params.branch = branch;
  const { getPaginated } = await import('./get-paginated.js');
  return await getPaginated(client, '/api/components/tree', params, 'components');
}

export async function listAllProjects(client) {
  logger.info('Fetching all projects from SonarQube...');
  const { getPaginated } = await import('./get-paginated.js');
  return await getPaginated(client, '/api/projects/search', {}, 'components');
}
