import logger from '../../../../../shared/utils/logger.js';
import { SonarCloudAPIError } from '../../../../../shared/utils/errors.js';

// -------- Connection & Project Management Methods --------

export async function testConnection(client, organization) {
  try {
    logger.info('Testing connection to SonarCloud...');
    const response = await client.get('/api/organizations/search', { params: { organizations: organization } });
    const orgs = response.data.organizations || [];
    if (orgs.length === 0) throw new SonarCloudAPIError(`Organization not found: ${organization}`);
    logger.info('Successfully connected to SonarCloud');
    return true;
  } catch (error) {
    logger.error(`Failed to connect to SonarCloud: ${error.message}`);
    throw error;
  }
}

export async function projectExists(client, projectKey, organization) {
  try {
    const response = await client.get('/api/projects/search', { params: { projects: projectKey, organization } });
    return (response.data.components || []).length > 0;
  } catch (error) {
    logger.error(`Failed to check project existence: ${error.message}`);
    return false;
  }
}

export async function isProjectKeyTakenGlobally(client, projectKey) {
  try {
    const response = await client.get('/api/components/show', { params: { component: projectKey } });
    return { taken: true, owner: response.data.component?.organization || 'unknown' };
  } catch (error) {
    if (error.statusCode === 404 || error.message?.includes('not found')) return { taken: false, owner: null };
    logger.debug(`Could not check global key for ${projectKey}: ${error.message}`);
    return { taken: true, owner: 'unknown' };
  }
}

export async function ensureProject(client, projectKey, organization, projectName = null) {
  logger.info(`Ensuring project exists: ${projectKey}`);
  const exists = await projectExists(client, projectKey, organization);
  if (exists) { logger.info('Project already exists'); return; }
  const displayName = projectName || projectKey;
  logger.info(`Project does not exist, creating with name: ${displayName}`);
  await client.post('/api/projects/create', null, { params: { project: projectKey, name: displayName, organization } });
  logger.info('Project created successfully');
}
