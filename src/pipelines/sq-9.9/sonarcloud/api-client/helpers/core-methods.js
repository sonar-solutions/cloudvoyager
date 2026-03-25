import { SonarCloudAPIError } from '../../../../../shared/utils/errors.js';
import logger from '../../../../../shared/utils/logger.js';

// -------- Core SonarCloud Methods --------

export async function testConnection(ctx) {
  logger.info('Testing connection to SonarCloud...');
  const response = await ctx.client.get('/api/organizations/search', { params: { organizations: ctx.organization } });
  const orgs = response.data.organizations || [];
  if (orgs.length === 0) throw new SonarCloudAPIError(`Organization not found: ${ctx.organization}`);
  logger.info('Successfully connected to SonarCloud');
  return true;
}

export async function projectExists(ctx) {
  try {
    const response = await ctx.client.get('/api/projects/search', { params: { projects: ctx.projectKey, organization: ctx.organization } });
    return (response.data.components || []).length > 0;
  } catch (error) {
    logger.error(`Failed to check project existence: ${error.message}`);
    return false;
  }
}

export async function isProjectKeyTakenGlobally(ctx, projectKey) {
  try {
    const response = await ctx.client.get('/api/components/show', { params: { component: projectKey } });
    return { taken: true, owner: response.data.component?.organization || 'unknown' };
  } catch (error) {
    if (error.statusCode === 404 || error.message?.includes('not found')) return { taken: false, owner: null };
    logger.debug(`Could not check global key availability for ${projectKey}: ${error.message}`);
    return { taken: true, owner: 'unknown' };
  }
}

export async function ensureProject(ctx, projectName = null) {
  logger.info(`Ensuring project exists: ${ctx.projectKey}`);
  const exists = await projectExists(ctx);
  if (exists) { logger.info('Project already exists'); return; }
  const displayName = projectName || ctx.projectKey;
  logger.info(`Project does not exist, creating with name: ${displayName}`);
  await ctx.client.post('/api/projects/create', null, { params: { project: ctx.projectKey, name: displayName, organization: ctx.organization } });
  logger.info('Project created successfully');
}

export async function getMostRecentCeTask(ctx) {
  const response = await ctx.client.get('/api/ce/activity', { params: { component: ctx.projectKey, ps: 1, status: 'SUCCESS,FAILED,CANCELED,PENDING,IN_PROGRESS' } });
  const tasks = response.data.tasks || [];
  return tasks.length > 0 ? tasks[0] : null;
}
