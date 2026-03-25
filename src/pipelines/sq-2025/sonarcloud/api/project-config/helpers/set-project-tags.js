import logger from '../../../../../../shared/utils/logger.js';

// -------- Set Project Tags --------

export async function setProjectTags(client, projectKey, tags) {
  logger.debug(`Setting tags on project ${projectKey}: ${tags.join(', ')}`);
  await client.post('/api/project_tags/set', null, { params: { project: projectKey, tags: tags.join(',') } });
}
