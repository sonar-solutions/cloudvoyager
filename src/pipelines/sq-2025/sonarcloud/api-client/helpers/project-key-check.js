import logger from '../../../../../shared/utils/logger.js';

// -------- Project Key Global Check --------

/** Check if a project key is taken globally (across all orgs). */
export async function isProjectKeyTakenGlobally(client, projectKey) {
  try {
    const response = await client.get('/api/components/show', { params: { component: projectKey } });
    return { taken: true, owner: response.data.component?.organization || 'unknown' };
  } catch (error) {
    if (error.statusCode === 404 || error.message?.includes('not found')) return { taken: false, owner: null };
    logger.debug(`Could not check global key availability for ${projectKey}: ${error.message}`);
    return { taken: true, owner: 'unknown' };
  }
}
