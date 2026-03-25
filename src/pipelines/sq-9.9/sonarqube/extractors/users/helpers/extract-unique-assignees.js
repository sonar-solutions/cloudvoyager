import logger from '../../../../../../shared/utils/logger.js';

// -------- Extract Unique Issue Assignees via Facets --------

export async function extractUniqueAssignees(sqClient, projectKeys) {
  const assigneeCounts = new Map();

  for (const projectKey of projectKeys) {
    try {
      const response = await sqClient.client.get('/api/issues/search', {
        params: { componentKeys: projectKey, facets: 'assignees', ps: 1 }
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
