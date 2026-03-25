import logger from '../../../../../shared/utils/logger.js';

// -------- Analysis Methods --------

/** Attach analysis and connection methods to the client instance. */
export function attachAnalysisMethods(inst) {
  inst.getLatestAnalysisRevision = async () => {
    logger.info(`Fetching latest analysis revision for project: ${inst.projectKey}`);
    try {
      const response = await inst.client.get('/api/project_analyses/search', { params: { project: inst.projectKey, ps: 1 } });
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
  };

  inst.listAllProjects = async () => {
    logger.info('Fetching all projects from SonarQube...');
    return await inst.getPaginated('/api/projects/search', {}, 'components');
  };

  inst.testConnection = async () => {
    try {
      logger.info('Testing connection to SonarQube...');
      await inst.client.get('/api/system/status');
      logger.info('Successfully connected to SonarQube');
      return true;
    } catch (error) {
      logger.error(`Failed to connect to SonarQube: ${error.message}`);
      throw error;
    }
  };

  inst.getServerVersion = async () => {
    try {
      const response = await inst.client.get('/api/system/status');
      return response.data.version || 'unknown';
    } catch (error) {
      logger.warn(`Failed to get server version: ${error.message}`);
      return 'unknown';
    }
  };
}
