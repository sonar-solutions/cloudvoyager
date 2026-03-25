import { DataExtractor } from '../../sonarqube/extractors/index.js';
import { checkShutdown } from '../../../../shared/utils/shutdown.js';
import logger from '../../../../shared/utils/logger.js';

// -------- Main Logic --------

/**
 * Extract data from SonarQube and fetch SonarCloud metadata.
 *
 * @param {object} opts - Options
 * @returns {Promise<object>} { extractor, extractedData, sonarCloudProfiles, sonarCloudMainBranch, sonarCloudRepos, ruleEnrichmentMap }
 */
export async function extractAndFetchMetadata(opts) {
  const { sonarqubeConfig, sonarcloudConfig, transferConfig, performanceConfig, sonarQubeClient, sonarCloudClient, isIncremental, stateTracker, journal, cache, shutdownCheck, prebuiltEnrichmentMap } = opts;

  logger.info('Starting data extraction from SonarQube (main branch)...');
  const config = { sonarqube: sonarqubeConfig, sonarcloud: sonarcloudConfig, transfer: transferConfig };
  const extractor = new DataExtractor(sonarQubeClient, config, isIncremental ? stateTracker : null, performanceConfig);

  const extractedData = (journal && cache)
    ? await extractor.extractAllWithCheckpoints(journal, cache, shutdownCheck)
    : await extractor.extractAll();

  checkShutdown(shutdownCheck);

  logger.info('Fetching SonarCloud quality profiles...');
  const sonarCloudProfiles = await sonarCloudClient.getQualityProfiles();
  const sonarCloudMainBranch = await sonarCloudClient.getMainBranchName();

  logger.info('Fetching SonarCloud rule repositories...');
  const sonarCloudRepos = await sonarCloudClient.getRuleRepositories();
  const ruleEnrichmentMap = prebuiltEnrichmentMap || new Map();

  return { extractor, extractedData, sonarCloudProfiles, sonarCloudMainBranch, sonarCloudRepos, ruleEnrichmentMap };
}
