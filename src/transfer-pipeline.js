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
  const includeBranches = transferConfig.includeBranches || null; // Set<string> from CSV, or null = all

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

  // If CSV specifies branch includes, verify the main branch is included
  if (includeBranches) {
    // Peek at the SonarQube main branch name to check against the include set
    const sqBranches = await sonarQubeClient.getBranches();
    const sqMainBranch = sqBranches.find(b => b.isMain);
    const sqMainBranchName = sqMainBranch?.name || 'main';
    if (!includeBranches.has(sqMainBranchName)) {
      logger.warn(`Main branch '${sqMainBranchName}' is excluded by CSV for project ${projectKey} — skipping entire project`);
      return {
        projectKey,
        sonarCloudProjectKey: sonarcloudConfig.projectKey,
        stats: { issuesTransferred: 0, componentsTransferred: 0, sourcesTransferred: 0, linesOfCode: 0, branchesTransferred: [] }
      };
    }
  }

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

  // Fetch SonarCloud rule repositories for auto-detecting external issues
  logger.info('Fetching SonarCloud rule repositories...');
  const sonarCloudRepos = await sonarCloudClient.getRuleRepositories();

  // --- Transfer main branch ---
  const mainBranchResult = await transferBranch({
    extractedData,
    sonarcloudConfig,
    sonarCloudProfiles,
    branchName: sonarCloudMainBranch,
    referenceBranchName: sonarCloudMainBranch,
    wait,
    sonarCloudClient,
    label: 'main',
    isMainBranch: true,
    sonarCloudRepos
  });

  // Track aggregated stats across all branches
  const aggregatedStats = { ...mainBranchResult.stats, branchesTransferred: [sonarCloudMainBranch] };

  if (transferConfig.mode === 'incremental') {
    stateTracker.markBranchCompleted(sonarCloudMainBranch);
  }

  // --- Transfer non-main branches ---
  if (syncAllBranches) {
    const allBranches = extractedData.project.branches || [];
    const nonMainBranches = allBranches.filter(b => {
      if (b.isMain) return false;
      if (excludeBranches.has(b.name)) return false;
      if (includeBranches && !includeBranches.has(b.name)) return false;
      return true;
    });

    if (nonMainBranches.length > 0) {
      // SonarCloud requires the main branch analysis to complete before non-main
      // branch reports can be processed (the main branch serves as the reference
      // baseline).  If we haven't already waited (wait=false), poll now.
      if (!wait && mainBranchResult.ceTask?.id) {
        logger.info(`Waiting for main branch CE task ${mainBranchResult.ceTask.id} to complete before syncing non-main branches...`);
        try {
          await sonarCloudClient.waitForAnalysis(mainBranchResult.ceTask.id, 600);
          logger.info('Main branch analysis completed — proceeding with non-main branches');
        } catch (error) {
          logger.error(`Main branch analysis did not complete successfully: ${error.message}`);
          logger.warn('Attempting non-main branch transfers anyway...');
        }
      }

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

          const branchResult = await transferBranch({
            extractedData: branchData,
            sonarcloudConfig,
            sonarCloudProfiles,
            branchName,
            referenceBranchName: sonarCloudMainBranch,
            wait,
            sonarCloudClient,
            label: branchName,
            sonarCloudRepos
          });

          // Accumulate stats
          aggregatedStats.issuesTransferred += branchResult.stats.issuesTransferred;
          aggregatedStats.hotspotsTransferred = (aggregatedStats.hotspotsTransferred || 0) + (branchResult.stats.hotspotsTransferred || 0);
          aggregatedStats.componentsTransferred += branchResult.stats.componentsTransferred;
          aggregatedStats.sourcesTransferred += branchResult.stats.sourcesTransferred;
          aggregatedStats.linesOfCode += branchResult.stats.linesOfCode;
          aggregatedStats.branchesTransferred.push(branchName);

          if (transferConfig.mode === 'incremental') {
            stateTracker.markBranchCompleted(branchName);
          }
        } catch (error) {
          logger.error(`Failed to transfer branch '${branchName}': ${error.message}`);
          logger.warn('Continuing with remaining branches...');
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
 * @returns {Promise<object>} { stats, ceTask } — branch transfer stats and the CE task object
 */
async function transferBranch({ extractedData, sonarcloudConfig, sonarCloudProfiles, branchName, referenceBranchName, wait, sonarCloudClient, label, isMainBranch = false, sonarCloudRepos = new Set() }) {
  // Build protobuf messages
  logger.info(`[${label}] Building protobuf messages...`);
  const builder = new ProtobufBuilder(extractedData, sonarcloudConfig, sonarCloudProfiles, {
    sonarCloudBranchName: branchName,
    referenceBranchName,
    sonarCloudRepos,
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
    version: '1.0.0',
    // Branch name — used by CE endpoint to route analysis to the correct branch.
    // For non-main branches, the uploader sends branch characteristics to the CE endpoint.
    ...(!isMainBranch && branchName ? { branchName } : {})
  };

  let ceTask;
  if (wait) {
    ceTask = await uploader.uploadAndWait(encodedReport, metadata);
    logger.info(`[${label}] Analysis completed successfully`);
  } else {
    ceTask = await uploader.upload(encodedReport, metadata);
    logger.info(`[${label}] Upload complete. CE Task ID: ${ceTask.id}`);
  }

  // Compute stats for this branch
  const nclocMeasure = (extractedData.measures.measures || []).find(m => m.metric === 'ncloc');
  const hotspotCount = extractedData.issues.filter(i => i.type === 'SECURITY_HOTSPOT').length;
  return {
    stats: {
      issuesTransferred: extractedData.issues.length - hotspotCount,
      hotspotsTransferred: hotspotCount,
      componentsTransferred: extractedData.components.length,
      sourcesTransferred: extractedData.sources.length,
      linesOfCode: nclocMeasure ? parseInt(nclocMeasure.value, 10) || 0 : 0
    },
    ceTask
  };
}
