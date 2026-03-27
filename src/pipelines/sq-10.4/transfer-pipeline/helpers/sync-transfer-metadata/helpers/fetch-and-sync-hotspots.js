import logger from '../../../../../../shared/utils/logger.js';
import { extractHotspots } from '../../../../sonarqube/extractors/hotspots.js';
import { syncHotspots } from '../../../../sonarcloud/migrators/hotspot-sync.js';

// -------- Fetch SQ Hotspots and Sync Metadata to SC --------

/** Fetch hotspots with details from SQ and sync metadata to SC. */
export async function fetchAndSyncHotspots(opts) {
  const { sonarQubeClient, sonarCloudClient, projectKey,
    performanceConfig = {} } = opts;

  const extractConcurrency = performanceConfig?.hotspotExtraction?.concurrency || 10;
  const syncConcurrency = performanceConfig?.hotspotSync?.concurrency || 3;

  logger.info('Extracting SonarQube hotspots with details...');
  const sqHotspots = await extractHotspots(sonarQubeClient, null, {
    concurrency: extractConcurrency,
  });
  logger.info(`Extracted ${sqHotspots.length} SonarQube hotspots`);

  if (sqHotspots.length === 0) {
    logger.info('No hotspots to sync');
    return null;
  }

  return syncHotspots(projectKey, sqHotspots, sonarCloudClient, {
    concurrency: syncConcurrency,
    sonarqubeUrl: sonarQubeClient.baseURL,
    sonarqubeProjectKey: sonarQubeClient.projectKey,
  });
}
