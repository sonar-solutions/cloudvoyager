// -------- Get All Quality Profiles --------

import logger from '../../../../../../shared/utils/logger.js';

export async function getAllQualityProfiles(client) {
  logger.info('Fetching all quality profiles');
  const response = await client.get('/api/qualityprofiles/search');
  return response.data.profiles || [];
}
