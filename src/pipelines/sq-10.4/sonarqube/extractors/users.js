import logger from '../../../../shared/utils/logger.js';

/**
 * Extract unique issue assignees across all projects using the assignees facet.
 * This is lightweight — it doesn't fetch full issues, just the facet counts.
 *
 * @param {import('../api-client.js').SonarQubeClient} sqClient - SonarQube client (no projectKey needed)
 * @param {string[]} projectKeys - List of project keys to scan
 * @returns {Promise<Map<string, number>>} Map of assignee login → total issue count
 */
export async function extractUniqueAssignees(sqClient, projectKeys) {
  const assigneeCounts = new Map();

  for (const projectKey of projectKeys) {
    try {
      const response = await sqClient.client.get('/api/issues/search', {
        params: {
          componentKeys: projectKey,
          facets: 'assignees',
          ps: 1 // we only need facets, not actual issues
        }
      });

      const facets = response.data.facets || [];
      const assigneeFacet = facets.find(f => f.property === 'assignees');
      if (assigneeFacet) {
        for (const entry of assigneeFacet.values) {
          if (entry.val && entry.val !== '') {
            const current = assigneeCounts.get(entry.val) || 0;
            assigneeCounts.set(entry.val, current + entry.count);
          }
        }
      }
    } catch (error) {
      logger.debug(`Failed to get assignee facet for project ${projectKey}: ${error.message}`);
    }
  }

  logger.info(`Found ${assigneeCounts.size} unique assignees across ${projectKeys.length} projects`);
  return assigneeCounts;
}

/**
 * Enrich assignee logins with display name and email from SonarQube user API.
 *
 * @param {import('../api-client.js').SonarQubeClient} sqClient
 * @param {string[]} logins - List of assignee logins
 * @returns {Promise<Map<string, { name: string, email: string }>>}
 */
export async function enrichAssigneeDetails(sqClient, logins) {
  const details = new Map();

  // SQ /api/users/search supports a `q` param for search — batch by chunks
  for (const login of logins) {
    try {
      const response = await sqClient.client.get('/api/users/search', {
        params: { q: login, ps: 10 }
      });
      const users = response.data.users || [];
      const match = users.find(u => u.login === login);
      if (match) {
        details.set(login, { name: match.name || '', email: match.email || '' });
      } else {
        details.set(login, { name: '', email: '' });
      }
    } catch (error) {
      logger.debug(`Failed to get user details for ${login}: ${error.message}`);
      details.set(login, { name: '', email: '' });
    }
  }

  return details;
}
