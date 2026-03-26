import logger from '../../../../../shared/utils/logger.js';
import { getPaginated } from './query-methods.js';
import { FALLBACK_SONARCLOUD_REPOS } from '../../../../../shared/utils/fallback-repos/index.js';

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
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await client.get('/api/rules/repositories');
      const repos = (response.data.repositories || []).map(r => r.key);
      logger.debug(`SonarCloud has ${repos.length} rule repositories`);
      return new Set(repos);
    } catch (error) {
      logger.warn(`Attempt ${attempt}/${maxAttempts} failed to fetch rule repositories: ${error.message}`);
      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, attempt * 1000));
      }
    }
  }
  logger.warn('All retries exhausted — falling back to built-in rule repository list');
  return FALLBACK_SONARCLOUD_REPOS;
}
