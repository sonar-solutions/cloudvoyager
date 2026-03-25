import { GracefulShutdownError } from '../../../../shared/utils/errors.js';
import { initState } from './init-state.js';
import { registerShutdownCleanup } from './register-shutdown-cleanup.js';
import { executeTransfer } from './execute-transfer.js';
import logger from '../../../../shared/utils/logger.js';

// -------- Transfer Project Orchestrator --------

export async function transferProject(opts) {
  const { sonarqubeConfig, sonarcloudConfig, transferConfig, performanceConfig = {}, wait = false, skipConnectionTest = false, ruleEnrichmentMap: prebuiltEnrichmentMap = null, shutdownCoordinator = null, forceRestart = false, forceFreshExtract = false, forceUnlock = false } = opts;
  const projectName = opts.projectName || null;
  const projectKey = sonarqubeConfig.projectKey;
  logger.info(`Starting transfer for project: ${projectKey}`);

  const shutdownCheck = shutdownCoordinator ? shutdownCoordinator.shutdownCheck() : () => false;
  const isIncremental = transferConfig.mode === 'incremental';
  const excludeBranches = new Set(transferConfig.excludeBranches || []);
  const includeBranches = transferConfig.includeBranches || null;

  const { lockFile, stateTracker, journal, cache } = await initState({ transferConfig, projectKey, forceRestart, forceFreshExtract, forceUnlock });
  registerShutdownCleanup(shutdownCoordinator, { journal, stateTracker, lockFile });

  try {
    return await executeTransfer({ sonarqubeConfig, sonarcloudConfig, transferConfig, performanceConfig, wait, skipConnectionTest, projectName, prebuiltEnrichmentMap, projectKey, shutdownCheck, isIncremental, excludeBranches, includeBranches, lockFile, stateTracker, journal, cache });
  } catch (error) {
    if (!(error instanceof GracefulShutdownError) && journal) await journal.markInterrupted().catch(() => {});
    await lockFile.release();
    throw error;
  }
}
