import logger from '../../../../../shared/utils/logger.js';

// -------- Measure Methods --------

/** Attach measure-related methods to the client instance. */
export function attachMeasureMethods(inst) {
  inst.getMeasures = async (branch = null, metricKeys = []) => {
    if (!metricKeys || metricKeys.length === 0) {
      logger.info(`No metric keys to fetch for project: ${inst.projectKey}`);
      return { key: inst.projectKey, measures: [] };
    }
    logger.info(`Fetching measures for project: ${inst.projectKey}`);
    const params = { component: inst.projectKey, metricKeys: metricKeys.join(',') };
    if (branch) params.branch = branch;
    const response = await inst.client.get('/api/measures/component', { params });
    return response.data.component || {};
  };

  inst.getComponentTree = async (branch = null, metricKeys = []) => {
    if (!metricKeys || metricKeys.length === 0) {
      logger.info(`No metric keys to fetch for component tree: ${inst.projectKey}`);
      return [];
    }
    logger.info(`Fetching component tree for project: ${inst.projectKey}`);
    const params = { component: inst.projectKey, metricKeys: metricKeys.join(','), qualifiers: 'DIR,FIL', strategy: 'all' };
    if (branch) params.branch = branch;
    return await inst.getPaginated('/api/measures/component_tree', params, 'components');
  };
}
