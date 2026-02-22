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
 * By default all branches discovered in SonarQube are transferred (main
 * branch first, then the rest).  Set `transferConfig.syncAllBranches` to
 * `false` to only transfer the main branch, or populate
 * `transferConfig.excludeBranches` to skip specific branch names.
 *
 * @param {object} options
 * @param {object} options.sonarqubeConfig - { url, token, projectKey }
 * @param {object} options.sonarcloudConfig - { url, token, organization, projectKey }
 * @param {object} options.transferConfig - { mode, stateFile, batchSize, syncAllBranches, excludeBranches }
 * @param {object} [options.performanceConfig] - Performance tuning options (concurrency, workers, memory)
 * @param {boolean} [options.wait=false] - Whether to wait for analysis completion
 * @param {boolean} [options.skipConnectionTest=false] - Skip connection testing
 * @param {string} [options.projectName=null] - Human-readable project name from SonarQube
 * @returns {Promise<object>} Transfer result with stats
 */
export async function transferProject({ sonarqubeConfig, sonarcloudConfig, transferConfig, performanceConfig = {}, wait = false, skipConnectionTest = false, projectName = null }) {
  const projectKey = sonarqubeConfig.projectKey;
  logger.info(`Starting transfer for project: ${projectKey}`);

  // Resolve branch sync settings (default: sync all branches)
  const syncAllBranches = transferConfig.syncAllBranches !== false;
  const excludeBranches = new Set(transferConfig.excludeBranches || []);

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

  // Extract data from SonarQube (main branch)
  logger.info('Starting data extraction from SonarQube (main branch)...');
  const config = { sonarqube: sonarqubeConfig, sonarcloud: sonarcloudConfig, transfer: transferConfig };
  const extractor = new DataExtractor(
    sonarQubeClient,
    config,
    transferConfig.mode === 'incremental' ? stateTracker : null,
    performanceConfig
  );
  const extractedData = await extractor.extractAll();

  // Fetch SonarCloud quality profiles and main branch name
  logger.info('Fetching SonarCloud quality profiles...');
  const sonarCloudProfiles = await sonarCloudClient.getQualityProfiles();
  const sonarCloudMainBranch = await sonarCloudClient.getMainBranchName();

  // --- Transfer main branch ---
  const mainBranchStats = await transferBranch({
    extractedData,
    sonarcloudConfig,
    sonarCloudProfiles,
    branchName: sonarCloudMainBranch,
    referenceBranchName: sonarCloudMainBranch,
    wait,
    sonarCloudClient,
    label: 'main'
  });

  // Track aggregated stats across all branches
  const aggregatedStats = { ...mainBranchStats, branchesTransferred: [sonarCloudMainBranch] };

  if (transferConfig.mode === 'incremental') {
    stateTracker.markBranchCompleted(sonarCloudMainBranch);
  }

  // --- Transfer non-main branches ---
  if (syncAllBranches) {
    const allBranches = extractedData.project.branches || [];
    const nonMainBranches = allBranches.filter(b => !b.isMain && !excludeBranches.has(b.name));

    if (nonMainBranches.length > 0) {
      logger.info(`Syncing ${nonMainBranches.length} additional branch(es): ${nonMainBranches.map(b => b.name).join(', ')}`);

      for (const branch of nonMainBranches) {
        const branchName = branch.name;

        // Skip if already completed in a previous incremental run
        if (transferConfig.mode === 'incremental' && stateTracker.isBranchCompleted(branchName)) {
          logger.info(`Branch '${branchName}' already completed — skipping`);
          continue;
        }

        try {
          logger.info(`--- Extracting branch: ${branchName} ---`);
          const branchData = await extractor.extractBranch(branchName, extractedData);

          const branchStats = await transferBranch({
            extractedData: branchData,
            sonarcloudConfig,
            sonarCloudProfiles,
            branchName,
            referenceBranchName: sonarCloudMainBranch,
            wait,
            sonarCloudClient,
            label: branchName
          });

          // Accumulate stats
          aggregatedStats.issuesTransferred += branchStats.issuesTransferred;
          aggregatedStats.componentsTransferred += branchStats.componentsTransferred;
          aggregatedStats.sourcesTransferred += branchStats.sourcesTransferred;
          aggregatedStats.linesOfCode += branchStats.linesOfCode;
          aggregatedStats.branchesTransferred.push(branchName);

          if (transferConfig.mode === 'incremental') {
            stateTracker.markBranchCompleted(branchName);
          }
        } catch (error) {
          logger.error(`Failed to transfer branch '${branchName}': ${error.message}`);
          logger.warn(`Continuing with remaining branches...`);
        }
      }
    } else {
      logger.info('No additional branches to sync (only the main branch exists)');
    }
  }

  // Record successful transfer in state
  if (transferConfig.mode === 'incremental') {
    await stateTracker.recordTransfer(aggregatedStats);
  }

  logger.info(`Transfer completed for project: ${projectKey} — ${aggregatedStats.branchesTransferred.length} branch(es): ${aggregatedStats.branchesTransferred.join(', ')}`);
  return { projectKey, sonarCloudProjectKey: sonarcloudConfig.projectKey, stats: aggregatedStats };
}

/**
 * Build, encode, and upload a single branch report to SonarCloud.
 *
 * @param {object} options
 * @param {object} options.extractedData - Data from extractAll() or extractBranch()
 * @param {object} options.sonarcloudConfig - SonarCloud config
 * @param {Array}  options.sonarCloudProfiles - SonarCloud quality profiles
 * @param {string} options.branchName - Branch name to set in metadata
 * @param {string} options.referenceBranchName - Reference (main) branch name
 * @param {boolean} options.wait - Whether to wait for analysis completion
 * @param {object} options.sonarCloudClient - SonarCloud API client
 * @param {string} options.label - Human-readable label for logging
 * @returns {Promise<object>} Branch transfer stats
 */
async function transferBranch({ extractedData, sonarcloudConfig, sonarCloudProfiles, branchName, referenceBranchName, wait, sonarCloudClient, label }) {
  // Build protobuf messages
  logger.info(`[${label}] Building protobuf messages...`);
  const builder = new ProtobufBuilder(extractedData, sonarcloudConfig, sonarCloudProfiles, {
    sonarCloudBranchName: branchName,
    referenceBranchName
  });
  const messages = builder.buildAll();

  // Encode to protobuf format
  logger.info(`[${label}] Encoding to protobuf format...`);
  const encoder = new ProtobufEncoder();
  await encoder.loadSchemas();
  const encodedReport = encoder.encodeAll(messages);

  // Upload to SonarCloud
  logger.info(`[${label}] Uploading to SonarCloud...`);
  const uploader = new ReportUploader(sonarCloudClient);
  const metadata = {
    projectKey: sonarcloudConfig.projectKey,
    organization: sonarcloudConfig.organization,
    version: '1.0.0'
  };

  if (wait) {
    await uploader.uploadAndWait(encodedReport, metadata);
    logger.info(`[${label}] Analysis completed successfully`);
  } else {
    const ceTask = await uploader.upload(encodedReport, metadata);
    logger.info(`[${label}] Upload complete. CE Task ID: ${ceTask.id}`);
  }

  // Compute stats for this branch
  const nclocMeasure = (extractedData.measures.measures || []).find(m => m.metric === 'ncloc');
  return {
    issuesTransferred: extractedData.issues.length,
    componentsTransferred: extractedData.components.length,
    sourcesTransferred: extractedData.sources.length,
    linesOfCode: nclocMeasure ? parseInt(nclocMeasure.value, 10) || 0 : 0
  };
}
