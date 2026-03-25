import logger from '../../../../shared/utils/logger.js';

// -------- Initialize Journal Session --------

export async function initJournalSession(journal, sonarqubeConfig, projectKey, sonarCloudClient) {
  if (!journal) return;

  const isResume = await journal.initialize({
    sonarQubeVersion: '9.9',
    sonarQubeUrl: sonarqubeConfig.url,
    projectKey,
    cloudvoyagerVersion: process.env.npm_package_version || 'dev',
  });

  if (isResume) {
    logger.info('=== RESUMING FROM CHECKPOINT ===');
    const exists = await sonarCloudClient.projectExists?.() ?? true;
    if (!exists) {
      throw new Error(`SonarCloud project ${sonarCloudClient.config?.projectKey} no longer exists. Cannot resume.`);
    }
  }
}
