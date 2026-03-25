import logger from '../../../../../../shared/utils/logger.js';

// -------- Get All Quality Profiles --------

export async function getAllQualityProfiles(client) {
  logger.info('Fetching all quality profiles');
  const response = await client.get('/api/qualityprofiles/search');
  return response.data.profiles || [];
}
