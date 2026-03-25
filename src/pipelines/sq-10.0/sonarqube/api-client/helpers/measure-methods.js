import logger from '../../../../../shared/utils/logger.js';
import { getPaginated } from './get-paginated.js';

// -------- Measure & Component Tree Methods --------

export async function getMetrics(client) {
  logger.info('Fetching metrics definitions');
  return await getPaginated(client, '/api/metrics/search', {}, 'metrics');
}

export async function getMeasures(client, projectKey, branch = null, metricKeys = []) {
  logger.info(`Fetching measures for project: ${projectKey}`);
  const MAX = 15;
  if (metricKeys.length > MAX) return fetchBatchedMeasures(client, projectKey, branch, metricKeys, MAX);
  const params = { component: projectKey, metricKeys: metricKeys.join(',') };
  if (branch) params.branch = branch;
  const response = await client.get('/api/measures/component', { params });
  return response.data.component || {};
}

async function fetchBatchedMeasures(client, projectKey, branch, metricKeys, max) {
  let merged = [];
  for (let i = 0; i < metricKeys.length; i += max) {
    const chunk = metricKeys.slice(i, i + max);
    const params = { component: projectKey, metricKeys: chunk.join(',') };
    if (branch) params.branch = branch;
    const response = await client.get('/api/measures/component', { params });
    merged = merged.concat((response.data.component || {}).measures || []);
  }
  return { key: projectKey, measures: merged };
}
