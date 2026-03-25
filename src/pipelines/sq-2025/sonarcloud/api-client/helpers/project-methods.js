import logger from '../../../../../shared/utils/logger.js';
import { SonarCloudAPIError } from '../../../../../shared/utils/errors.js';

// -------- Project Methods --------

/** Test connection to SonarCloud by verifying the organization exists. */
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

/** Check if a project exists in the organization. */
export async function projectExists(client, projectKey, organization) {
  try {
    const response = await client.get('/api/projects/search', { params: { projects: projectKey, organization } });
    return (response.data.components || []).length > 0;
  } catch (error) {
    logger.error(`Failed to check project existence: ${error.message}`);
    return false;
  }
}

/** Ensure a project exists, creating it if necessary. */
export async function ensureProject(client, projectKey, organization, projectName = null) {
  logger.info(`Ensuring project exists: ${projectKey}`);
  const exists = await projectExists(client, projectKey, organization);
  if (exists) { logger.info('Project already exists'); return; }
  const displayName = projectName || projectKey;
  logger.info(`Project does not exist, creating with name: ${displayName}`);
  await client.post('/api/projects/create', null, { params: { project: projectKey, name: displayName, organization } });
  logger.info('Project created successfully');
}
