import logger from '../../../../../shared/utils/logger.js';

// -------- Measure Methods --------

/** Attach measure-related methods to the client instance. */
export function attachMeasureMethods(inst) {
  inst.getMeasures = async (branch = null, metricKeys = []) => {
    logger.info(`Fetching measures for project: ${inst.projectKey}`);
    const params = { component: inst.projectKey, metricKeys: metricKeys.join(',') };
    if (branch) params.branch = branch;
    const response = await inst.client.get('/api/measures/component', { params });
    return response.data.component || {};
  };

  inst.getComponentTree = async (branch = null, metricKeys = []) => {
    logger.info(`Fetching component tree for project: ${inst.projectKey}`);
    const params = { component: inst.projectKey, metricKeys: metricKeys.join(','), qualifiers: 'DIR,FIL', strategy: 'all' };
    if (branch) params.branch = branch;
    return await inst.getPaginated('/api/measures/component_tree', params, 'components');
  };
}
