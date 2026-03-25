import logger from '../../../../../../shared/utils/logger.js';

// -------- Get Quality Profiles --------

export async function getQualityProfiles(client, organization, projectKey) {
  logger.info('Fetching quality profiles from SonarCloud...');
  try {
    const response = await client.get('/api/qualityprofiles/search', { params: { project: projectKey, organization } });
    const profiles = response.data.profiles || [];
    logger.info(`Found ${profiles.length} quality profiles in SonarCloud`);
    return profiles;
  } catch (error) {
    logger.warn(`Failed to fetch quality profiles: ${error.message}`);
    return [];
  }
}
