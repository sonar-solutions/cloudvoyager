import logger from '../../../../../shared/utils/logger.js';

// -------- Analysis & Quality Gate Methods --------

export async function getQualityGate(client, projectKey) {
  logger.info(`Fetching quality gate for project: ${projectKey}`);
  try {
    const response = await client.get('/api/qualitygates/get_by_project', { params: { project: projectKey } });
    return response.data.qualityGate || null;
  } catch (error) {
    if (error.statusCode === 404) { logger.warn('No quality gate found for project'); return null; }
    throw error;
  }
}

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
  } catch (error) {
    logger.warn(`Failed to get analysis revision: ${error.message}`);
    return null;
  }
}

export async function getDuplications(client, componentKey, branch = null) {
  logger.debug(`Fetching duplications for: ${componentKey}`);
  const params = { key: componentKey };
  if (branch) params.branch = branch;
  const response = await client.get('/api/duplications/show', { params });
  return response.data;
}
