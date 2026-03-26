import logger from '../../../../../shared/utils/logger.js';
import * as iss from '../../api/issues.js';
import { FALLBACK_SONARCLOUD_REPOS } from '../../../../../shared/utils/fallback-repos/index.js';

// -------- Read-Only Query Methods (Part 4: Issues, Hotspots, Rules) --------

/** Search issues with comments included. */
export async function searchIssuesWithComments(client, organization, projectKey, filters = {}) {
  return iss.searchIssues(client, organization, projectKey, { additionalFields: 'comments', ...filters });
}

/** Get hotspot details. */
export async function getHotspotDetails(client, hotspotKey) {
  const response = await client.get('/api/hotspots/show', { params: { hotspot: hotspotKey } });
  return response.data;
}

/** Fetch all rule repository keys available in SonarCloud. */
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
