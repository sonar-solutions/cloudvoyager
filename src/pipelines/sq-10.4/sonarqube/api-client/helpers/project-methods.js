import { SonarQubeAPIError } from '../../../../../shared/utils/errors.js';
import logger from '../../../../../shared/utils/logger.js';

// -------- Main Logic --------

// Build project-related methods for the SQ client.
export function buildProjectMethods(client, projectKey) {
  return {
    async getProject() {
      logger.info(`Fetching project: ${projectKey}`);
      const response = await client.get('/api/projects/search', { params: { projects: projectKey } });
      const projects = response.data.components || [];
      if (projects.length === 0) throw new SonarQubeAPIError(`Project not found: ${projectKey}`);
      return projects[0];
    },
    async getBranches(pk = null) {
      const key = pk || projectKey;
      logger.debug(`Fetching branches for project: ${key}`);
      const response = await client.get('/api/project_branches/list', { params: { project: key } });
      return response.data.branches || [];
    },
    async listAllProjects() {
      logger.info('Fetching all projects from SonarQube...');
      return await this.getPaginatedFn('/api/projects/search', {}, 'components');
    },
  };
}
