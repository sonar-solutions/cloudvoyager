import { SonarQubeClient } from './sonarqube/api-client.js';
import { SonarCloudClient } from './sonarcloud/api-client.js';
import { DataExtractor } from './sonarqube/extractors/index.js';
import { ProtobufBuilder } from './protobuf/builder.js';
import { ProtobufEncoder } from './protobuf/encoder.js';
import { ReportUploader } from './sonarcloud/uploader.js';
import { StateTracker } from './state/tracker.js';
import logger from './utils/logger.js';

/**
 * Execute the full transfer pipeline for a single project.
 *
 * @param {object} options
 * @param {object} options.sonarqubeConfig - { url, token, projectKey }
 * @param {object} options.sonarcloudConfig - { url, token, organization, projectKey }
 * @param {object} options.transferConfig - { mode, stateFile, batchSize }
 * @param {object} [options.performanceConfig] - Performance tuning options (concurrency, workers, memory)
 * @param {boolean} [options.wait=false] - Whether to wait for analysis completion
 * @param {boolean} [options.skipConnectionTest=false] - Skip connection testing
 * @param {string} [options.projectName=null] - Human-readable project name from SonarQube
 * @returns {Promise<object>} Transfer result with stats
 */
export async function transferProject({ sonarqubeConfig, sonarcloudConfig, transferConfig, performanceConfig = {}, wait = false, skipConnectionTest = false, projectName = null }) {
  const projectKey = sonarqubeConfig.projectKey;
  logger.info(`Starting transfer for project: ${projectKey}`);

  // Initialize state tracker
  const stateTracker = new StateTracker(transferConfig.stateFile);
  await stateTracker.initialize();

  const stateSummary = stateTracker.getSummary();
  if (stateSummary.lastSync) {
    logger.info(`Last sync: ${stateSummary.lastSync}`);
    logger.info(`Previously processed: ${stateSummary.processedIssuesCount} issues`);
  }

  // Create per-project API clients
  const sonarQubeClient = new SonarQubeClient(sonarqubeConfig);
  const sonarCloudClient = new SonarCloudClient(sonarcloudConfig);

  // Test connections (unless skipped)
  if (!skipConnectionTest) {
    await sonarQubeClient.testConnection();
    await sonarCloudClient.testConnection();
  }

  // If no project name was provided, fetch it from SonarQube
  if (!projectName) {
    try {
      const sqProject = await sonarQubeClient.getProject();
      projectName = sqProject.name || null;
    } catch (error) {
      logger.warn(`Could not fetch project name from SonarQube: ${error.message}`);
    }
  }

  // Ensure SonarCloud project exists (with the original human-readable name)
  await sonarCloudClient.ensureProject(projectName);

  // Extract data from SonarQube
  logger.info('Starting data extraction from SonarQube...');
  const config = { sonarqube: sonarqubeConfig, sonarcloud: sonarcloudConfig, transfer: transferConfig };
  const extractor = new DataExtractor(
    sonarQubeClient,
    config,
    transferConfig.mode === 'incremental' ? stateTracker : null,
    performanceConfig
  );
  const extractedData = await extractor.extractAll();

  // Fetch SonarCloud quality profiles and branch name
  logger.info('Fetching SonarCloud quality profiles...');
  const sonarCloudProfiles = await sonarCloudClient.getQualityProfiles();
  const sonarCloudBranchName = await sonarCloudClient.getMainBranchName();

  // Build protobuf messages
  logger.info('Building protobuf messages...');
  const builder = new ProtobufBuilder(extractedData, sonarcloudConfig, sonarCloudProfiles, { sonarCloudBranchName });
  const messages = builder.buildAll();

  // Encode to protobuf format
  logger.info('Encoding to protobuf format...');
  const encoder = new ProtobufEncoder();
  await encoder.loadSchemas();
  const encodedReport = encoder.encodeAll(messages);

  // Upload to SonarCloud
  logger.info('Uploading to SonarCloud...');
  const uploader = new ReportUploader(sonarCloudClient);
  const metadata = {
    projectKey: sonarcloudConfig.projectKey,
    organization: sonarcloudConfig.organization,
    version: '1.0.0'
  };

  if (wait) {
    await uploader.uploadAndWait(encodedReport, metadata);
    logger.info('Analysis completed successfully');
  } else {
    const ceTask = await uploader.upload(encodedReport, metadata);
    logger.info(`Upload complete. CE Task ID: ${ceTask.id}`);
  }

  // Record successful transfer in state
  const nclocMeasure = (extractedData.measures.measures || []).find(m => m.metric === 'ncloc');
  const stats = {
    issuesTransferred: extractedData.issues.length,
    componentsTransferred: extractedData.components.length,
    sourcesTransferred: extractedData.sources.length,
    linesOfCode: nclocMeasure ? parseInt(nclocMeasure.value, 10) || 0 : 0
  };

  if (transferConfig.mode === 'incremental') {
    await stateTracker.recordTransfer(stats);
  }

  logger.info(`Transfer completed for project: ${projectKey}`);
  return { projectKey, sonarCloudProjectKey: sonarcloudConfig.projectKey, stats };
}
