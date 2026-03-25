import logger from '../../../../../shared/utils/logger.js';

// -------- Issue Methods --------

/** Attach issue and duplication methods to the client instance. */
export function attachIssueMethods(inst) {
  inst.getIssues = async (filters = {}) => {
    const params = { componentKeys: inst.projectKey, issueStatuses: 'OPEN,CONFIRMED,FALSE_POSITIVE,ACCEPTED,FIXED', ...filters };
    logger.info(`Fetching issues for project: ${inst.projectKey}`);
    return await inst.getPaginated('/api/issues/search', params, 'issues');
  };

  inst.getIssuesWithComments = async (filters = {}) => {
    const params = { componentKeys: inst.projectKey, additionalFields: 'comments', issueStatuses: 'OPEN,CONFIRMED,FALSE_POSITIVE,ACCEPTED,FIXED', ...filters };
    logger.info(`Fetching issues with comments for project: ${inst.projectKey}`);
    return await inst.getPaginated('/api/issues/search', params, 'issues');
  };

  inst.getDuplications = async (componentKey, branch = null) => {
    logger.debug(`Fetching duplications for: ${componentKey}`);
    const params = { key: componentKey };
    if (branch) params.branch = branch;
    const response = await inst.client.get('/api/duplications/show', { params });
    return response.data;
  };
}
