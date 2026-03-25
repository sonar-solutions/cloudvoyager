import logger from '../../../../../../shared/utils/logger.js';

// -------- Initialize Journal --------

/** Initialize journal and check for resume state. */
export async function initializeJournal(journal, sqVersionRaw, sonarqubeConfig, projectKey, sonarCloudClient) {
  if (!journal) return;

  const isResume = await journal.initialize({
    sonarQubeVersion: sqVersionRaw, sonarQubeUrl: sonarqubeConfig.url,
    projectKey, cloudvoyagerVersion: process.env.npm_package_version || 'dev',
  });

  if (isResume) {
    logger.info('=== RESUMING FROM CHECKPOINT ===');
    const exists = await sonarCloudClient.projectExists?.() ?? true;
    if (!exists) throw new Error(`SonarCloud project ${sonarCloudClient.projectKey || projectKey} no longer exists.`);
  }
}
