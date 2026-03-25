import { getPaginated } from './helpers/get-paginated.js';
export { getPaginated } from './helpers/get-paginated.js';
export { listQualityGates, getQualityGateDetails, getQualityGateForProject } from './helpers/quality-gate-queries.js';

// -------- Simple Query Methods --------

/** List all projects in the organization. */
export async function listProjects(client, organization) {
  return getPaginated(client, '/api/projects/search', { organization }, 'components');
}

/** Get branches for a project. */
export async function getProjectBranches(client, projectKey) {
  const response = await client.get('/api/project_branches/list', { params: { project: projectKey } });
  return response.data.branches || [];
}
