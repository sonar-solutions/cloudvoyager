import logger from '../../../../../shared/utils/logger.js';
import { fetchAndSyncIssues } from './helpers/fetch-and-sync-issues.js';
import { fetchAndSyncHotspots } from './helpers/fetch-and-sync-hotspots.js';

// -------- Sync Transfer Metadata --------

/** Sync issue and hotspot metadata after scanner report upload. */
export async function syncTransferMetadata(opts) {
  const { sonarQubeClient, sonarCloudClient, sonarcloudConfig,
    transferConfig = {}, performanceConfig = {} } = opts;

  const projectKey = sonarcloudConfig.projectKey;
  logger.info('Starting metadata sync for transferred project...');

  const issueStats = transferConfig.skipIssueMetadataSync
    ? null
    : await fetchAndSyncIssues({ sonarQubeClient, sonarCloudClient, projectKey, performanceConfig });

  const hotspotStats = transferConfig.skipHotspotMetadataSync
    ? null
    : await fetchAndSyncHotspots({ sonarQubeClient, sonarCloudClient, projectKey, performanceConfig });

  logger.info('Metadata sync completed');
  return { issueStats, hotspotStats };
}
