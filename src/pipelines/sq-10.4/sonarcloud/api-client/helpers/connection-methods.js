import { SonarCloudAPIError } from '../../../../../shared/utils/errors.js';
import logger from '../../../../../shared/utils/logger.js';

// -------- Main Logic --------

/**
 * Build connection and project management methods.
 */
export function buildConnectionMethods(client, organization, projectKey) {
  return {
    async testConnection() {
      logger.info('Testing connection to SonarCloud...');
      const response = await client.get('/api/organizations/search', { params: { organizations: organization } });
      const orgs = response.data.organizations || [];
      if (orgs.length === 0) throw new SonarCloudAPIError(`Organization not found: ${organization}`);
      logger.info('Successfully connected to SonarCloud');
      return true;
    },

    async projectExists() {
      try {
        const response = await client.get('/api/projects/search', { params: { projects: projectKey, organization } });
        return (response.data.components || []).length > 0;
      } catch (error) { logger.error(`Failed to check project existence: ${error.message}`); return false; }
    },

    async isProjectKeyTakenGlobally(pk) {
      try {
        const response = await client.get('/api/components/show', { params: { component: pk } });
        return { taken: true, owner: response.data.component?.organization || 'unknown' };
      } catch (error) {
        if (error.statusCode === 404 || error.message?.includes('not found')) return { taken: false, owner: null };
        logger.debug(`Could not check global key availability for ${pk}: ${error.message}`);
        return { taken: true, owner: 'unknown' };
      }
    },

    async ensureProject(projectName = null) {
      logger.info(`Ensuring project exists: ${projectKey}`);
      const exists = await this.projectExists();
      if (exists) { logger.info('Project already exists'); return; }
      const displayName = projectName || projectKey;
      logger.info(`Project does not exist, creating with name: ${displayName}`);
      await client.post('/api/projects/create', null, { params: { project: projectKey, name: displayName, organization } });
      logger.info('Project created successfully');
    },
  };
}
