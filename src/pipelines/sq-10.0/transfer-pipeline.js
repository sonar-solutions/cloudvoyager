import { SonarQubeClient } from './sonarqube/api-client.js';
import { SonarCloudClient } from './sonarcloud/api-client.js';
import { DataExtractor } from './sonarqube/extractors/index.js';
import { ProtobufBuilder } from './protobuf/builder.js';
import { ProtobufEncoder } from './protobuf/encoder.js';
import { ReportUploader } from './sonarcloud/uploader.js';
import { StateTracker } from '../../shared/state/tracker.js';
import { CheckpointJournal } from '../../shared/state/checkpoint.js';
import { ExtractionCache } from '../../shared/state/extraction-cache.js';
import { LockFile } from '../../shared/state/lock.js';
import { checkShutdown } from '../../shared/utils/shutdown.js';
import { GracefulShutdownError } from '../../shared/utils/errors.js';
import { dirname, join } from 'node:path';
import logger from '../../shared/utils/logger.js';

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
export async function transferProject({ sonarqubeConfig, sonarcloudConfig, transferConfig, performanceConfig = {}, wait = false, skipConnectionTest = false, projectName = null, ruleEnrichmentMap: prebuiltEnrichmentMap = null, shutdownCoordinator = null, forceRestart = false, forceFreshExtract = false, forceUnlock = false }) {
  const projectKey = sonarqubeConfig.projectKey;
  logger.info(`Starting transfer for project: ${projectKey}`);

  const shutdownCheck = shutdownCoordinator ? shutdownCoordinator.shutdownCheck() : () => false;
  const checkpointEnabled = transferConfig.checkpoint?.enabled !== false;
  const isIncremental = transferConfig.mode === 'incremental';

  // Resolve branch sync settings (default: sync all branches)
  const syncAllBranches = transferConfig.syncAllBranches !== false;
  const excludeBranches = new Set(transferConfig.excludeBranches || []);
  const includeBranches = transferConfig.includeBranches || null; // Set<string> from CSV, or null = all

  // --- Lock file (prevent concurrent runs) ---
  const lockPath = `${transferConfig.stateFile}.lock`;
  const lockFile = new LockFile(lockPath);
  await lockFile.acquire(forceUnlock);

  // --- Initialize state tracker ---
  let stateTracker;
  try {
    stateTracker = new StateTracker(transferConfig.stateFile);
    await stateTracker.initialize();
  } catch (error) {
    await lockFile.release();
    throw error;
  }

  const stateSummary = stateTracker.getSummary();
  if (stateSummary.lastSync) {
    logger.info(`Last sync: ${stateSummary.lastSync}`);
    logger.info(`Previously processed: ${stateSummary.processedIssuesCount} issues`);
  }

  // --- Initialize checkpoint journal ---
  let journal = null;
  let cache = null;

  if (checkpointEnabled) {
    const journalPath = `${transferConfig.stateFile}.journal`;

    if (forceRestart) {
      const tmpJournal = new CheckpointJournal(journalPath);
      if (tmpJournal.exists()) {
        logger.info('--force-restart: clearing existing checkpoint journal');
        await tmpJournal.clear();
      }
    }

    journal = new CheckpointJournal(journalPath);

    const cacheDir = join(dirname(transferConfig.stateFile), '.cache', 'extractions', projectKey.replace(/[^a-zA-Z0-9_-]/g, '_'));
    cache = new ExtractionCache(cacheDir, {
      maxAgeDays: transferConfig.checkpoint?.cacheMaxAgeDays || 7,
    });

    if (forceFreshExtract) {
      logger.info('--force-fresh-extract: clearing extraction cache');
      await cache.clear();
    }

    // Purge stale cache files on startup
    await cache.purgeStale();
  }

  // Register shutdown cleanup (outside checkpoint block — always needed for lock + state)
  if (shutdownCoordinator) {
    shutdownCoordinator.register(async () => {
      if (journal) await journal.markInterrupted();
      await stateTracker.save();
      await lockFile.release();
    });
  }

  try {
    // Create per-project API clients
    const sonarQubeClient = new SonarQubeClient(sonarqubeConfig);
    const sonarCloudClient = new SonarCloudClient(sonarcloudConfig);

    // Test connections (unless skipped)
    if (!skipConnectionTest) {
      await sonarQubeClient.testConnection();
      await sonarCloudClient.testConnection();
    }

    // Initialize journal with session fingerprint
    if (journal) {
      const isResume = await journal.initialize({
        sonarQubeVersion: '10.x',
        sonarQubeUrl: sonarqubeConfig.url,
        projectKey,
        cloudvoyagerVersion: process.env.npm_package_version || 'dev',
      });

      if (isResume) {
        logger.info('=== RESUMING FROM CHECKPOINT ===');

        // Validate SonarCloud project still exists on resume
        const exists = await sonarCloudClient.projectExists?.() ?? true;
        if (!exists) {
          throw new Error(`SonarCloud project ${sonarcloudConfig.projectKey} no longer exists. Cannot resume.`);
        }
      }
    }

    checkShutdown(shutdownCheck);

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
      const sqBranches = await sonarQubeClient.getBranches();
      const sqMainBranch = sqBranches.find(b => b.isMain);
      const sqMainBranchName = sqMainBranch?.name || 'main';
      if (!includeBranches.has(sqMainBranchName)) {
        logger.warn(`Main branch '${sqMainBranchName}' is excluded by CSV for project ${projectKey} — skipping entire project`);
        const zeroStats = { issuesTransferred: 0, hotspotsTransferred: 0, componentsTransferred: 0, sourcesTransferred: 0, linesOfCode: 0, branchesTransferred: [] };
        if (isIncremental) {
          await stateTracker.recordTransfer(zeroStats);
        }
        if (journal) await journal.markCompleted();
        await lockFile.release();
        return {
          projectKey,
          sonarCloudProjectKey: sonarcloudConfig.projectKey,
          stats: { issuesTransferred: 0, componentsTransferred: 0, sourcesTransferred: 0, linesOfCode: 0, branchesTransferred: [] }
        };
      }
    }

    checkShutdown(shutdownCheck);

    // --- Extract data from SonarQube (main branch) ---
    logger.info('Starting data extraction from SonarQube (main branch)...');
    const config = { sonarqube: sonarqubeConfig, sonarcloud: sonarcloudConfig, transfer: transferConfig };
    const extractor = new DataExtractor(
      sonarQubeClient,
      config,
      isIncremental ? stateTracker : null,
      performanceConfig
    );

    // Use checkpoint-aware extraction if journal available, else fallback
    let extractedData;
    if (journal && cache) {
      extractedData = await extractor.extractAllWithCheckpoints(journal, cache, shutdownCheck);
    } else {
      extractedData = await extractor.extractAll();
    }

    checkShutdown(shutdownCheck);

    // Fetch SonarCloud quality profiles and main branch name
    logger.info('Fetching SonarCloud quality profiles...');
    const sonarCloudProfiles = await sonarCloudClient.getQualityProfiles();
    const sonarCloudMainBranch = await sonarCloudClient.getMainBranchName();

    // Fetch SonarCloud rule repositories for auto-detecting external issues
    logger.info('Fetching SonarCloud rule repositories...');
    const sonarCloudRepos = await sonarCloudClient.getRuleRepositories();

    // 10.0+ has native Clean Code taxonomy — no enrichment needed
    const ruleEnrichmentMap = prebuiltEnrichmentMap || new Map();

    checkShutdown(shutdownCheck);

    // --- Transfer main branch ---
    let mainBranchResult;
    const mainBranchCompleted = journal?.getBranchStatus(sonarCloudMainBranch) === 'completed';

    if (mainBranchCompleted) {
      logger.info(`Main branch '${sonarCloudMainBranch}' already completed in journal — skipping`);
      const ceTaskInfo = journal.getUploadedCeTask(sonarCloudMainBranch);
      mainBranchResult = {
        stats: { issuesTransferred: 0, hotspotsTransferred: 0, componentsTransferred: 0, sourcesTransferred: 0, linesOfCode: 0 },
        ceTask: ceTaskInfo ? { id: ceTaskInfo.taskId } : null,
      };
    } else {
      if (journal) await journal.startBranch(sonarCloudMainBranch);

      // Upload deduplication: check if we already uploaded in this session
      const uploader = new ReportUploader(sonarCloudClient);
      const existingUpload = journal ? await uploader.checkExistingUpload(journal.sessionStartTime) : null;

      if (existingUpload) {
        mainBranchResult = {
          stats: { issuesTransferred: 0, hotspotsTransferred: 0, componentsTransferred: 0, sourcesTransferred: 0, linesOfCode: 0 },
          ceTask: existingUpload,
        };
      } else {
        mainBranchResult = await transferBranch({
          extractedData,
          sonarcloudConfig,
          sonarCloudProfiles,
          branchName: sonarCloudMainBranch,
          referenceBranchName: sonarCloudMainBranch,
          wait,
          sonarCloudClient,
          label: 'main',
          isMainBranch: true,
          sonarCloudRepos,
          ruleEnrichmentMap
        });
      }

      if (journal) {
        await journal.recordUpload(sonarCloudMainBranch, mainBranchResult.ceTask?.id);
        await journal.markBranchCompleted(sonarCloudMainBranch, mainBranchResult.ceTask?.id);
      }
    }

    // Track aggregated stats across all branches
    const aggregatedStats = {
      issuesTransferred: mainBranchResult.stats.issuesTransferred || 0,
      hotspotsTransferred: mainBranchResult.stats.hotspotsTransferred || 0,
      componentsTransferred: mainBranchResult.stats.componentsTransferred || 0,
      sourcesTransferred: mainBranchResult.stats.sourcesTransferred || 0,
      linesOfCode: mainBranchResult.stats.linesOfCode || 0,
      branchesTransferred: [sonarCloudMainBranch],
    };

    if (isIncremental) {
      stateTracker.markBranchCompleted(sonarCloudMainBranch);
      await stateTracker.save(); // Save after each branch, not just at the end
    }

    checkShutdown(shutdownCheck);

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
        // SonarCloud requires main branch analysis to complete before non-main branches
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

          // Check shutdown between branches
          if (shutdownCheck()) {
            logger.warn('Shutdown requested — stopping branch transfers');
            break;
          }

          // Skip if already completed (state tracker or journal)
          if (isIncremental && stateTracker.isBranchCompleted(branchName)) {
            logger.info(`Branch '${branchName}' already completed — skipping`);
            continue;
          }
          if (journal?.getBranchStatus(branchName) === 'completed') {
            logger.info(`Branch '${branchName}' already completed in journal — skipping`);
            aggregatedStats.branchesTransferred.push(branchName);
            continue;
          }

          try {
            if (journal) await journal.startBranch(branchName);

            logger.info(`--- Extracting branch: ${branchName} ---`);
            let branchData;
            if (journal && cache) {
              branchData = await extractor.extractBranchWithCheckpoints(branchName, extractedData, journal, cache, shutdownCheck);
            } else {
              branchData = await extractor.extractBranch(branchName, extractedData);
            }

            const branchResult = await transferBranch({
              extractedData: branchData,
              sonarcloudConfig,
              sonarCloudProfiles,
              branchName,
              referenceBranchName: sonarCloudMainBranch,
              wait,
              sonarCloudClient,
              label: branchName,
              sonarCloudRepos,
              ruleEnrichmentMap
            });

            // Accumulate stats
            aggregatedStats.issuesTransferred += branchResult.stats.issuesTransferred || 0;
            aggregatedStats.hotspotsTransferred += branchResult.stats.hotspotsTransferred || 0;
            aggregatedStats.componentsTransferred += branchResult.stats.componentsTransferred || 0;
            aggregatedStats.sourcesTransferred += branchResult.stats.sourcesTransferred || 0;
            aggregatedStats.linesOfCode += branchResult.stats.linesOfCode || 0;
            aggregatedStats.branchesTransferred.push(branchName);

            if (journal) {
              await journal.recordUpload(branchName, branchResult.ceTask?.id);
              await journal.markBranchCompleted(branchName, branchResult.ceTask?.id);
            }

            if (isIncremental) {
              stateTracker.markBranchCompleted(branchName);
              await stateTracker.save(); // Save after each branch
            }
          } catch (error) {
            if (error instanceof GracefulShutdownError) throw error;
            if (journal) await journal.markBranchFailed(branchName, error.message);
            logger.error(`Failed to transfer branch '${branchName}': ${error.message}`);
            logger.warn('Continuing with remaining branches...');
          }
        }
      } else {
        logger.info('No additional branches to sync (only the main branch exists)');
      }
    }

    // Record successful transfer in state
    if (isIncremental) {
      await stateTracker.recordTransfer(aggregatedStats);
    }

    // Mark journal as completed
    if (journal) {
      await journal.markCompleted();
    }

    // Release lock
    await lockFile.release();

    logger.info(`Transfer completed for project: ${projectKey} — ${aggregatedStats.branchesTransferred.length} branch(es): ${aggregatedStats.branchesTransferred.join(', ')}`);
    return { projectKey, sonarCloudProjectKey: sonarcloudConfig.projectKey, stats: aggregatedStats };
  } catch (error) {
    // On graceful shutdown, journal already marked interrupted by cleanup handler
    if (!(error instanceof GracefulShutdownError) && journal) {
      await journal.markInterrupted().catch(() => {});
    }
    await lockFile.release();
    throw error;
  }
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
async function transferBranch({ extractedData, sonarcloudConfig, sonarCloudProfiles, branchName, referenceBranchName, wait, sonarCloudClient, label, isMainBranch = false, sonarCloudRepos = new Set(), ruleEnrichmentMap = new Map() }) {
  // Build protobuf messages
  logger.info(`[${label}] Building protobuf messages...`);
  const builder = new ProtobufBuilder(extractedData, sonarcloudConfig, sonarCloudProfiles, {
    sonarCloudBranchName: branchName,
    referenceBranchName,
    sonarCloudRepos,
    ruleEnrichmentMap,
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
