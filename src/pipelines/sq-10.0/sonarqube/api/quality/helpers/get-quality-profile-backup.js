// -------- Get Quality Profile Backup --------

import logger from '../../../../../../shared/utils/logger.js';

export async function getQualityProfileBackup(client, language, qualityProfile) {
  logger.debug(`Fetching quality profile backup: ${qualityProfile} (${language})`);
  const response = await client.get('/api/qualityprofiles/backup', {
    params: { language, qualityProfile },
    responseType: 'text'
  });
  return response.data;
}
