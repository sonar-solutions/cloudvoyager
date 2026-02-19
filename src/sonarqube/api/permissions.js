import logger from '../../utils/logger.js';

export async function getGroups(getPaginated) {
  logger.info('Fetching all user groups');
  return await getPaginated('/api/user_groups/search', {}, 'groups');
}

export async function getGlobalPermissions(getPaginated) {
  logger.info('Fetching global permissions');
  return await getPaginated('/api/permissions/groups', { ps: 100 }, 'groups');
}

export async function getProjectPermissions(getPaginated, projectKey) {
  logger.debug(`Fetching project permissions for: ${projectKey}`);
  return await getPaginated('/api/permissions/groups', { projectKey, ps: 100 }, 'groups');
}

export async function getPermissionTemplates(client) {
  logger.info('Fetching permission templates');
  const response = await client.get('/api/permissions/search_templates');
  return response.data;
}

export async function getPortfolios(client) {
  logger.info('Fetching portfolios');
  try {
    const response = await client.get('/api/views/list');
    return response.data.views || [];
  } catch (error) {
    logger.warn(`Failed to get portfolios (may require Enterprise edition): ${error.message}`);
    return [];
  }
}

export async function getPortfolioDetails(client, key) {
  logger.debug(`Fetching portfolio details: ${key}`);
  try {
    const response = await client.get('/api/views/show', { params: { key } });
    return response.data;
  } catch (error) {
    logger.warn(`Failed to get portfolio details: ${error.message}`);
    return null;
  }
}
