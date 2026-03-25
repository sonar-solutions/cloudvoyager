import logger from '../../../../../shared/utils/logger.js';
import * as iss from '../../api/issues.js';

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
  try {
    const response = await client.get('/api/rules/repositories');
    const repos = (response.data.repositories || []).map(r => r.key);
    logger.debug(`SonarCloud has ${repos.length} rule repositories`);
    return new Set(repos);
  } catch (error) {
    logger.warn(`Failed to fetch SonarCloud rule repositories: ${error.message}`);
    return new Set();
  }
}
