import { checkShutdown } from '../../../../shared/utils/shutdown.js';
import { initClients } from './init-clients.js';
import { initJournalSession } from './init-journal-session.js';
import { resolveProjectName } from './resolve-project-name.js';
import { checkMainBranchIncluded } from './check-main-branch-included.js';
import { runTransferPhases } from './run-transfer-phases.js';
import logger from '../../../../shared/utils/logger.js';

// -------- Execute Transfer (inner logic) --------

export async function executeTransfer(ctx) {
  const { sonarqubeConfig, sonarcloudConfig, transferConfig, performanceConfig, wait, skipConnectionTest, prebuiltEnrichmentMap, projectKey, shutdownCheck, isIncremental, excludeBranches, includeBranches, lockFile, stateTracker, journal, cache } = ctx;
  let { projectName } = ctx;

  const { sonarQubeClient, sonarCloudClient } = await initClients(sonarqubeConfig, sonarcloudConfig, skipConnectionTest);
  await initJournalSession(journal, sonarqubeConfig, projectKey, sonarCloudClient);
  checkShutdown(shutdownCheck);

  projectName = await resolveProjectName(projectName, sonarQubeClient);
  await sonarCloudClient.ensureProject(projectName);

  const earlyReturn = await checkMainBranchIncluded({ includeBranches, sonarQubeClient, projectKey, isIncremental, stateTracker, journal, lockFile });
  if (earlyReturn) { earlyReturn.sonarCloudProjectKey = sonarcloudConfig.projectKey; return earlyReturn; }
  checkShutdown(shutdownCheck);

  const syncAllBranches = transferConfig.syncAllBranches !== false;
  const stats = await runTransferPhases({ sonarQubeClient, sonarCloudClient, sonarqubeConfig, sonarcloudConfig, transferConfig, performanceConfig, wait, isIncremental, syncAllBranches, excludeBranches, includeBranches, stateTracker, journal, cache, shutdownCheck, projectKey, prebuiltEnrichmentMap });

  if (isIncremental) await stateTracker.recordTransfer(stats);
  if (journal) await journal.markCompleted();
  await lockFile.release();

  logger.info(`Transfer completed for project: ${projectKey}`);
  return { projectKey, sonarCloudProjectKey: sonarcloudConfig.projectKey, stats };
}
