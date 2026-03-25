import { GracefulShutdownError } from '../../../shared/utils/errors.js';
import { initializeState, initializeCheckpoint } from './helpers/initialize-state.js';
import { executeTransfer } from './helpers/execute-transfer.js';
import { registerShutdown } from './helpers/register-shutdown.js';
import logger from '../../../shared/utils/logger.js';

// -------- Public API --------

/** Execute the full transfer pipeline for a single project. */
export async function transferProject(options) {
  const {
    sonarqubeConfig, sonarcloudConfig, transferConfig, performanceConfig = {},
    wait = false, skipConnectionTest = false, projectName: initialProjectName = null,
    ruleEnrichmentMap: prebuiltEnrichmentMap = null, shutdownCoordinator = null,
    forceRestart = false, forceFreshExtract = false, forceUnlock = false,
  } = options;

  const projectKey = sonarqubeConfig.projectKey;
  logger.info(`Starting transfer for project: ${projectKey}`);

  const shutdownCheck = shutdownCoordinator ? shutdownCoordinator.shutdownCheck() : () => false;
  const isIncremental = transferConfig.mode === 'incremental';
  const syncAllBranches = transferConfig.syncAllBranches !== false;
  const excludeBranches = new Set(transferConfig.excludeBranches || []);
  const includeBranches = transferConfig.includeBranches || null;

  const { lockFile, stateTracker } = await initializeState(transferConfig, forceUnlock);
  const { journal, cache } = await initializeCheckpoint(transferConfig, projectKey, forceRestart, forceFreshExtract);
  registerShutdown(shutdownCoordinator, journal, stateTracker, lockFile);

  try {
    return await executeTransfer({
      sonarqubeConfig, sonarcloudConfig, transferConfig, performanceConfig,
      wait, skipConnectionTest, projectKey, shutdownCheck, isIncremental,
      syncAllBranches, excludeBranches, includeBranches, lockFile,
      stateTracker, journal, cache, prebuiltEnrichmentMap, initialProjectName,
    });
  } catch (error) {
    if (!(error instanceof GracefulShutdownError) && journal) {
      await journal.markInterrupted().catch(() => {});
    }
    await lockFile.release();
    throw error;
  }
}
