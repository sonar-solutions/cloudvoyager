import logger from '../../../../../shared/utils/logger.js';
import { getPaginated } from './get-paginated.js';

// -------- Quality Profile Methods --------

export async function getQualityProfiles(client, projectKey) {
  logger.info(`Fetching quality profiles for project: ${projectKey}`);
  const response = await client.get('/api/qualityprofiles/search', { params: { project: projectKey } });
  return response.data.profiles || [];
}

export async function getActiveRules(client, profileKey) {
  logger.debug(`Fetching active rules for profile: ${profileKey}`);
  return await getPaginated(client, '/api/rules/search', { qprofile: profileKey, ps: 100 }, 'rules');
}
