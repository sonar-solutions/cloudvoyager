import logger from '../../../../../shared/utils/logger.js';

// -------- Analysis Revision and Project Listing --------

export async function getLatestAnalysisRevision(client, projectKey) {
  logger.info(`Fetching latest analysis revision for project: ${projectKey}`);
  try {
    const response = await client.get('/api/project_analyses/search', { params: { project: projectKey, ps: 1 } });
    const analyses = response.data.analyses || [];
    if (analyses.length > 0 && analyses[0].revision) {
      logger.info(`Latest SCM revision: ${analyses[0].revision}`);
      return analyses[0].revision;
    }
    logger.warn('No SCM revision found in latest analysis');
    return null;
  } catch (error) { logger.warn(`Failed to get analysis revision: ${error.message}`); return null; }
}

export async function listAllProjects(getPaginated) {
  logger.info('Fetching all projects from SonarQube...');
  return await getPaginated('/api/projects/search', {}, 'components');
}
