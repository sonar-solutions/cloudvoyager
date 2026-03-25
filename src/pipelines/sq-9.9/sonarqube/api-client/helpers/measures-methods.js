import logger from '../../../../../shared/utils/logger.js';

// -------- Measures API Methods (with Metric Key Batching) --------

const MAX_METRIC_KEYS = 15;

export async function getMeasures(client, projectKey, branch, metricKeys) {
  logger.info(`Fetching measures for project: ${projectKey}`);
  if (metricKeys.length > MAX_METRIC_KEYS) {
    let mergedMeasures = [];
    for (let i = 0; i < metricKeys.length; i += MAX_METRIC_KEYS) {
      const chunk = metricKeys.slice(i, i + MAX_METRIC_KEYS);
      const params = { component: projectKey, metricKeys: chunk.join(',') };
      if (branch) params.branch = branch;
      const response = await client.get('/api/measures/component', { params });
      mergedMeasures = mergedMeasures.concat((response.data.component || {}).measures || []);
    }
    return { key: projectKey, measures: mergedMeasures };
  }
  const params = { component: projectKey, metricKeys: metricKeys.join(',') };
  if (branch) params.branch = branch;
  const response = await client.get('/api/measures/component', { params });
  return response.data.component || {};
}

export async function getComponentTree(getPaginated, client, projectKey, branch, metricKeys) {
  logger.info(`Fetching component tree for project: ${projectKey}`);
  if (metricKeys.length > MAX_METRIC_KEYS) {
    const componentMap = new Map();
    for (let i = 0; i < metricKeys.length; i += MAX_METRIC_KEYS) {
      const chunk = metricKeys.slice(i, i + MAX_METRIC_KEYS);
      const params = { component: projectKey, metricKeys: chunk.join(','), qualifiers: 'DIR,FIL', strategy: 'all' };
      if (branch) params.branch = branch;
      const components = await getPaginated('/api/measures/component_tree', params, 'components');
      for (const comp of components) {
        if (componentMap.has(comp.key)) {
          componentMap.get(comp.key).measures = (componentMap.get(comp.key).measures || []).concat(comp.measures || []);
        } else { componentMap.set(comp.key, { ...comp }); }
      }
    }
    return Array.from(componentMap.values());
  }
  const params = { component: projectKey, metricKeys: metricKeys.join(','), qualifiers: 'DIR,FIL', strategy: 'all' };
  if (branch) params.branch = branch;
  return await getPaginated('/api/measures/component_tree', params, 'components');
}
