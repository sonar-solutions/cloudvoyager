import { GracefulShutdownError } from '../../../../shared/utils/errors.js';
import { initializeState } from './initialize-state.js';
import { initializeCheckpoint } from './initialize-checkpoint.js';
import { executeTransfer } from './execute-transfer.js';
import logger from '../../../../shared/utils/logger.js';

// -------- Main Logic --------

/**
 * Execute the full transfer pipeline for a single project.
 *
 * @param {object} options - Transfer options
 * @returns {Promise<object>} Transfer result with stats
 */
export async function transferProject(options) {
  const { sonarqubeConfig, transferConfig, shutdownCoordinator = null, forceRestart = false, forceFreshExtract = false, forceUnlock = false } = options;
  const projectKey = sonarqubeConfig.projectKey;
  logger.info(`Starting transfer for project: ${projectKey}`);

  const shutdownCheck = shutdownCoordinator ? shutdownCoordinator.shutdownCheck() : () => false;
  const isIncremental = transferConfig.mode === 'incremental';

  const { lockFile, stateTracker } = await initializeState(transferConfig, forceUnlock);
  const { journal, cache } = await initializeCheckpoint(transferConfig, projectKey, forceRestart, forceFreshExtract);

  if (shutdownCoordinator) {
    shutdownCoordinator.register(async () => {
      if (journal) await journal.markInterrupted();
      await stateTracker.save();
      await lockFile.release();
    });
  }

  try {
    const result = await executeTransfer({ ...options, projectKey, shutdownCheck, isIncremental, lockFile, stateTracker, journal, cache });
    await lockFile.release();
    return result;
  } catch (error) {
    if (!(error instanceof GracefulShutdownError) && journal) await journal.markInterrupted().catch(() => {});
    await lockFile.release();
    throw error;
  }
}
