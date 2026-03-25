import logger from '../../../../shared/utils/logger.js';
import { SonarQubeClient } from '../../sonarqube/api-client.js';
import { SonarCloudClient } from '../../sonarcloud/api-client.js';
import { DataExtractor } from '../../sonarqube/extractors/index.js';
import { checkShutdown } from '../../../../shared/utils/shutdown.js';

// -------- Create Clients & Extract Main Branch Data --------

export async function extractMainData({ sonarqubeConfig, sonarcloudConfig, transferConfig, performanceConfig, skipConnectionTest, projectName, journal, cache, shutdownCheck, stateTracker }) {
  const sonarQubeClient = new SonarQubeClient(sonarqubeConfig);
  const sonarCloudClient = new SonarCloudClient(sonarcloudConfig);
  if (!skipConnectionTest) { await sonarQubeClient.testConnection(); await sonarCloudClient.testConnection(); }
  if (journal) {
    const isResume = await journal.initialize({
      sonarQubeVersion: '10.x', sonarQubeUrl: sonarqubeConfig.url,
      projectKey: sonarqubeConfig.projectKey, cloudvoyagerVersion: process.env.npm_package_version || 'dev',
    });
    if (isResume) {
      logger.info('=== RESUMING FROM CHECKPOINT ===');
      const exists = await sonarCloudClient.projectExists?.() ?? true;
      if (!exists) throw new Error(`SonarCloud project ${sonarcloudConfig.projectKey} no longer exists.`);
    }
  }
  checkShutdown(shutdownCheck);
  if (!projectName) {
    try { const p = await sonarQubeClient.getProject(); projectName = p.name || null; }
    catch (e) { logger.warn(`Could not fetch project name: ${e.message}`); }
  }
  await sonarCloudClient.ensureProject(projectName);
  return { sonarQubeClient, sonarCloudClient };
}

export async function runExtraction({ sonarQubeClient, sonarqubeConfig, sonarcloudConfig, transferConfig, performanceConfig, journal, cache, shutdownCheck, stateTracker }) {
  const isIncremental = transferConfig.mode === 'incremental';
  const config = { sonarqube: sonarqubeConfig, sonarcloud: sonarcloudConfig, transfer: transferConfig };
  const extractor = new DataExtractor(sonarQubeClient, config, isIncremental ? stateTracker : null, performanceConfig);
  const extractedData = (journal && cache)
    ? await extractor.extractAllWithCheckpoints(journal, cache, shutdownCheck)
    : await extractor.extractAll();
  return { extractor, extractedData };
}
