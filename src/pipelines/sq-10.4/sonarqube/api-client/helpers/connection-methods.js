import logger from '../../../../../shared/utils/logger.js';

// -------- Main Logic --------

// Build connection and server info methods for the SQ client.
export function buildConnectionMethods(client) {
  return {
    async testConnection() {
      try {
        logger.info('Testing connection to SonarQube...');
        await client.get('/api/system/status');
        logger.info('Successfully connected to SonarQube');
        return true;
      } catch (error) {
        logger.error(`Failed to connect to SonarQube: ${error.message}`);
        throw error;
      }
    },
    async getServerVersion() {
      try {
        const response = await client.get('/api/system/status');
        return response.data.version || 'unknown';
      } catch (error) {
        logger.warn(`Failed to get server version: ${error.message}`);
        return 'unknown';
      }
    },
    async getLatestAnalysisRevision(projectKey) {
      logger.info(`Fetching latest analysis revision for project: ${projectKey}`);
      try {
        const response = await client.get('/api/project_analyses/search', { params: { project: projectKey, ps: 1 } });
        const analyses = response.data.analyses || [];
        if (analyses.length > 0 && analyses[0].revision) {
          logger.info(`Latest SCM revision: ${analyses[0].revision}`);
          return analyses[0].revision;
        }
        logger.warn('No SCM revision found in latest analysis');
        return null;
      } catch (error) {
        logger.warn(`Failed to get analysis revision: ${error.message}`);
        return null;
      }
    },
  };
}
