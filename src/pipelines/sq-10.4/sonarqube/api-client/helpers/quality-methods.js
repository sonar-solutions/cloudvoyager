import logger from '../../../../../shared/utils/logger.js';

// -------- Main Logic --------

// Build quality gate and profile methods for the SQ client.
export function buildQualityMethods(client, projectKey, getPaginatedFn) {
  return {
    async getQualityGate() {
      logger.info(`Fetching quality gate for project: ${projectKey}`);
      try {
        const response = await client.get('/api/qualitygates/get_by_project', { params: { project: projectKey } });
        return response.data.qualityGate || null;
      } catch (error) {
        if (error.statusCode === 404) { logger.warn('No quality gate found for project'); return null; }
        throw error;
      }
    },
    async getQualityProfiles() {
      logger.info(`Fetching quality profiles for project: ${projectKey}`);
      const response = await client.get('/api/qualityprofiles/search', { params: { project: projectKey } });
      return response.data.profiles || [];
    },
    async getActiveRules(profileKey) {
      logger.debug(`Fetching active rules for profile: ${profileKey}`);
      return await getPaginatedFn('/api/rules/search', { qprofile: profileKey, ps: 100 }, 'rules');
    },
  };
}
