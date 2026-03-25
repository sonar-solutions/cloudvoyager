import logger from '../../../../../shared/utils/logger.js';

// -------- Main Logic --------

// Build source code and file methods for the SQ client.
export function buildSourceMethods(client, projectKey, getPaginatedFn) {
  return {
    async getSourceCode(fileKey, branch = null) {
      logger.debug(`Fetching source code for: ${fileKey}`);
      const params = { key: fileKey };
      if (branch) params.branch = branch;
      const response = await client.get('/api/sources/raw', { params, responseType: 'text' });
      return response.data;
    },
    async getSourceFiles(branch = null) {
      logger.info(`Fetching source files for project: ${projectKey}`);
      const params = { component: projectKey, qualifiers: 'FIL' };
      if (branch) params.branch = branch;
      return await getPaginatedFn('/api/components/tree', params, 'components');
    },
    async getDuplications(componentKey, branch = null) {
      logger.debug(`Fetching duplications for: ${componentKey}`);
      const params = { key: componentKey };
      if (branch) params.branch = branch;
      const response = await client.get('/api/duplications/show', { params });
      return response.data;
    },
  };
}
