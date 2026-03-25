import { SonarQubeAPIError } from '../../../../../shared/utils/errors.js';
import logger from '../../../../../shared/utils/logger.js';

// -------- Project Methods --------

/** Attach project-related methods to the client instance. */
export function attachProjectMethods(inst) {
  inst.getProject = async () => {
    logger.info(`Fetching project: ${inst.projectKey}`);
    const response = await inst.client.get('/api/projects/search', { params: { projects: inst.projectKey } });
    const projects = response.data.components || [];
    if (projects.length === 0) throw new SonarQubeAPIError(`Project not found: ${inst.projectKey}`);
    return projects[0];
  };

  inst.getBranches = async (pk = null) => {
    const projectKey = pk || inst.projectKey;
    logger.debug(`Fetching branches for project: ${projectKey}`);
    const response = await inst.client.get('/api/project_branches/list', { params: { project: projectKey } });
    return response.data.branches || [];
  };

  inst.getQualityGate = async () => {
    logger.info(`Fetching quality gate for project: ${inst.projectKey}`);
    try {
      const response = await inst.client.get('/api/qualitygates/get_by_project', { params: { project: inst.projectKey } });
      return response.data.qualityGate || null;
    } catch (error) {
      if (error.statusCode === 404) { logger.warn('No quality gate found for project'); return null; }
      throw error;
    }
  };

  inst.getMetrics = async () => {
    logger.info('Fetching metrics definitions');
    return await inst.getPaginated('/api/metrics/search', {}, 'metrics');
  };
}
