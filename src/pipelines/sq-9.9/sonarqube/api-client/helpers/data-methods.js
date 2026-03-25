import logger from '../../../../../shared/utils/logger.js';

// -------- Data Retrieval Methods (Metrics, Measures, Sources) --------

export async function getMetrics(getPaginated) {
  logger.info('Fetching metrics definitions');
  return await getPaginated('/api/metrics/search', {}, 'metrics');
}

export async function getSourceCode(client, fileKey, branch) {
  logger.debug(`Fetching source code for: ${fileKey}`);
  const params = { key: fileKey };
  if (branch) params.branch = branch;
  const response = await client.get('/api/sources/raw', { params, responseType: 'text' });
  return response.data;
}

export async function getSourceFiles(getPaginated, projectKey, branch) {
  logger.info(`Fetching source files for project: ${projectKey}`);
  const params = { component: projectKey, qualifiers: 'FIL' };
  if (branch) params.branch = branch;
  return await getPaginated('/api/components/tree', params, 'components');
}

export async function getQualityProfiles(client, projectKey) {
  logger.info(`Fetching quality profiles for project: ${projectKey}`);
  const response = await client.get('/api/qualityprofiles/search', { params: { project: projectKey } });
  return response.data.profiles || [];
}

export async function getActiveRules(getPaginated, profileKey) {
  logger.debug(`Fetching active rules for profile: ${profileKey}`);
  return await getPaginated('/api/rules/search', { qprofile: profileKey, ps: 100 }, 'rules');
}

export async function getDuplications(client, componentKey, branch) {
  logger.debug(`Fetching duplications for: ${componentKey}`);
  const params = { key: componentKey };
  if (branch) params.branch = branch;
  const response = await client.get('/api/duplications/show', { params });
  return response.data;
}
