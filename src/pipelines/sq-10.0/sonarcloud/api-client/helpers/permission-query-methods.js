import logger from '../../../../../shared/utils/logger.js';
import { getPaginated } from './query-methods.js';

// -------- Permission & Group Query Methods --------

export async function listProjects(client, organization) {
  return getPaginated(client, '/api/projects/search', { organization }, 'components');
}

export async function getGroups(client, organization) {
  return getPaginated(client, '/api/user_groups/search', { organization }, 'groups');
}

export async function getGlobalPermissions(client, organization) {
  return getPaginated(client, '/api/permissions/groups', { organization, ps: 100 }, 'groups');
}

export async function getProjectPermissions(client, projectKey, organization) {
  return getPaginated(client, '/api/permissions/groups', { projectKey, organization, ps: 100 }, 'groups');
}

export async function getPermissionTemplates(client, organization) {
  const response = await client.get('/api/permissions/search_templates', { params: { organization } });
  return response.data;
}

export async function searchIssuesWithComments(client, organization, projectKey, filters = {}) {
  const { searchIssues } = await import('../../api/issues.js');
  return searchIssues(client, organization, projectKey, { additionalFields: 'comments', ...filters });
}

export async function getRuleRepositories(client) {
  try {
    const response = await client.get('/api/rules/repositories');
    const repos = (response.data.repositories || []).map(r => r.key);
    logger.debug(`SonarCloud has ${repos.length} rule repositories`);
    return new Set(repos);
  } catch (error) {
    logger.warn(`Failed to fetch rule repositories: ${error.message}`);
    return new Set();
  }
}
