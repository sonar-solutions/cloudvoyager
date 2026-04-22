import logger from '../../../../../shared/utils/logger.js';
import { fetchWithSlicing } from '../../../../../shared/utils/search-slicer/index.js';
import { probeTotal } from './probe-total.js';

// -------- Issue Methods --------

const ISSUE_STATUSES = 'OPEN,CONFIRMED,FALSE_POSITIVE,ACCEPTED,FIXED,IN_SANDBOX';

/** Attach issue and duplication methods to the client instance. */
export function attachIssueMethods(inst) {
  const probeFn = (ep, params, dk) => probeTotal(inst.client, ep, params, dk);

  inst.getIssues = async (filters = {}) => {
    const params = { componentKeys: inst.projectKey, issueStatuses: ISSUE_STATUSES, ...filters };
    logger.info(`Fetching issues for project: ${inst.projectKey}`);
    return await fetchWithSlicing(probeFn, inst.getPaginated.bind(inst), '/api/issues/search', params, 'issues');
  };

  inst.getIssuesWithComments = async (filters = {}) => {
    const params = { componentKeys: inst.projectKey, additionalFields: 'comments', issueStatuses: ISSUE_STATUSES, ...filters };
    logger.info(`Fetching issues with comments for project: ${inst.projectKey}`);
    return await fetchWithSlicing(probeFn, inst.getPaginated.bind(inst), '/api/issues/search', params, 'issues');
  };

  inst.getDuplications = async (componentKey, branch = null) => {
    logger.debug(`Fetching duplications for: ${componentKey}`);
    const params = { key: componentKey };
    if (branch) params.branch = branch;
    const response = await inst.client.get('/api/duplications/show', { params });
    return response.data;
  };
}
