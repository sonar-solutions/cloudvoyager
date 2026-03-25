import logger from '../../../../../../../shared/utils/logger.js';

// -------- Quality Gate Queries --------

/** List quality gates in the organization. */
export async function listQualityGates(client, organization) {
  const response = await client.get('/api/qualitygates/list', { params: { organization } });
  return response.data;
}

/** Get quality gate details by ID. */
export async function getQualityGateDetails(client, id, organization) {
  const response = await client.get('/api/qualitygates/show', { params: { id, organization } });
  return response.data;
}

/** Get quality gate assigned to a project. */
export async function getQualityGateForProject(client, projectKey, organization) {
  try {
    const response = await client.get('/api/qualitygates/get_by_project', { params: { project: projectKey, organization } });
    return response.data.qualityGate || null;
  } catch (error) {
    logger.debug(`Failed to get quality gate for project ${projectKey}: ${error.message}`);
    return null;
  }
}
