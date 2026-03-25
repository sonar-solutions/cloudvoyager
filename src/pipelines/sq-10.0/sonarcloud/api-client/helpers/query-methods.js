import logger from '../../../../../shared/utils/logger.js';
import * as iss from '../../api/issues.js';

// -------- Read-Only Query Methods (used by verification) --------

export async function getPaginated(client, endpoint, params = {}, dataKey = 'components') {
  let allResults = [];
  let page = 1;
  const pageSize = params.ps || 500;
  while (true) {
    const response = await client.get(endpoint, { params: { ...params, p: page, ps: pageSize } });
    const results = response.data[dataKey] || [];
    allResults = allResults.concat(results);
    const total = response.data.paging?.total || response.data.total || 0;
    if (page * pageSize >= total || results.length < pageSize) break;
    page++;
  }
  return allResults;
}

export async function getProjectBranches(client, projectKey) {
  const response = await client.get('/api/project_branches/list', { params: { project: projectKey } });
  return response.data.branches || [];
}

export async function listQualityGates(client, organization) {
  const response = await client.get('/api/qualitygates/list', { params: { organization } });
  return response.data;
}

export async function getQualityGateDetails(client, id, organization) {
  const response = await client.get('/api/qualitygates/show', { params: { id, organization } });
  return response.data;
}

export async function getQualityGateForProject(client, projectKey, organization) {
  try {
    const response = await client.get('/api/qualitygates/get_by_project', { params: { project: projectKey, organization } });
    return response.data.qualityGate || null;
  } catch (error) {
    logger.debug(`Failed to get quality gate for ${projectKey}: ${error.message}`);
    return null;
  }
}
