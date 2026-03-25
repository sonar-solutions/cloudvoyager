import logger from '../../../../../shared/utils/logger.js';
import { getPaginated } from './get-paginated.js';

// -------- Component Tree Methods --------

export async function getComponentTree(client, projectKey, branch = null, metricKeys = []) {
  logger.info(`Fetching component tree for project: ${projectKey}`);
  const MAX = 15;
  if (metricKeys.length > MAX) return fetchBatchedTree(client, projectKey, branch, metricKeys, MAX);
  const params = { component: projectKey, metricKeys: metricKeys.join(','), qualifiers: 'DIR,FIL', strategy: 'all' };
  if (branch) params.branch = branch;
  return await getPaginated(client, '/api/measures/component_tree', params, 'components');
}

async function fetchBatchedTree(client, projectKey, branch, metricKeys, max) {
  const componentMap = new Map();
  for (let i = 0; i < metricKeys.length; i += max) {
    const chunk = metricKeys.slice(i, i + max);
    const params = { component: projectKey, metricKeys: chunk.join(','), qualifiers: 'DIR,FIL', strategy: 'all' };
    if (branch) params.branch = branch;
    const components = await getPaginated(client, '/api/measures/component_tree', params, 'components');
    for (const comp of components) {
      if (componentMap.has(comp.key)) {
        const existing = componentMap.get(comp.key);
        existing.measures = (existing.measures || []).concat(comp.measures || []);
      } else {
        componentMap.set(comp.key, { ...comp });
      }
    }
  }
  return Array.from(componentMap.values());
}
