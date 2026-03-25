import logger from '../../../../../shared/utils/logger.js';
import { fetchMeasuresBatched } from './fetch-measures-batched.js';
import { fetchComponentTreeBatched } from './fetch-component-tree-batched.js';

// -------- Main Logic --------

// Build measure and component tree methods for the SQ client.
export function buildMeasureMethods(client, projectKey, getPaginatedFn) {
  return {
    async getMetrics() {
      logger.info('Fetching metrics definitions');
      return await getPaginatedFn('/api/metrics/search', {}, 'metrics');
    },
    async getMeasures(branch = null, metricKeys = []) {
      logger.info(`Fetching measures for project: ${projectKey}`);
      return await fetchMeasuresBatched(client, projectKey, branch, metricKeys);
    },
    async getComponentTree(branch = null, metricKeys = []) {
      logger.info(`Fetching component tree for project: ${projectKey}`);
      return await fetchComponentTreeBatched(client, projectKey, branch, metricKeys, getPaginatedFn);
    },
  };
}
