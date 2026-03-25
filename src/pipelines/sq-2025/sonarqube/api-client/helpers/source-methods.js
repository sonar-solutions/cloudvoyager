import logger from '../../../../../shared/utils/logger.js';

// -------- Source Methods --------

/** Attach source-related methods to the client instance. */
export function attachSourceMethods(inst) {
  inst.getSourceCode = async (fileKey, branch = null) => {
    logger.debug(`Fetching source code for: ${fileKey}`);
    const params = { key: fileKey };
    if (branch) params.branch = branch;
    const response = await inst.client.get('/api/sources/raw', { params, responseType: 'text' });
    return response.data;
  };

  inst.getSourceFiles = async (branch = null) => {
    logger.info(`Fetching source files for project: ${inst.projectKey}`);
    const params = { component: inst.projectKey, qualifiers: 'FIL' };
    if (branch) params.branch = branch;
    return await inst.getPaginated('/api/components/tree', params, 'components');
  };
}
