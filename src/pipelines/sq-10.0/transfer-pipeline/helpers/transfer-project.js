import logger from '../../../../shared/utils/logger.js';
import { checkShutdown } from '../../../../shared/utils/shutdown.js';
import { GracefulShutdownError } from '../../../../shared/utils/errors.js';
import { parseTransferOpts } from './parse-transfer-opts.js';
import { initState } from './init-state.js';
import { initCheckpoints } from './init-checkpoints.js';
import { extractMainData, runExtraction } from './extract-main-data.js';
import { checkMainBranchExcluded } from './resolve-branch-config.js';
import { transferMainBranch } from './transfer-main-branch.js';
import { finalizeTransfer } from './finalize-transfer.js';

// -------- Transfer Project Orchestrator --------

export async function transferProject(opts) {
  const p = parseTransferOpts(opts);
  logger.info(`Starting transfer for project: ${p.projectKey}`);
  const { lockFile, stateTracker } = await initState(p.transferConfig, p.forceUnlock);
  let journal = null, cache = null;
  if (p.checkpointEnabled) {
    ({ journal, cache } = await initCheckpoints(p.transferConfig, p.projectKey, p.forceRestart, p.forceFreshExtract));
  }
  if (p.shutdownCoordinator) {
    p.shutdownCoordinator.register(async () => {
      if (journal) { await journal.markInterrupted(); }
      await stateTracker.save();
      await lockFile.release();
    });
  }
  try {
    const { sonarQubeClient, sonarCloudClient } = await extractMainData({ ...p, journal, cache, stateTracker });
    const earlyReturn = await checkMainBranchExcluded({ ...p, sonarQubeClient, stateTracker, journal, lockFile });
    if (earlyReturn) return earlyReturn;
    checkShutdown(p.shutdownCheck);
    const { extractor, extractedData } = await runExtraction({ sonarQubeClient, ...p, journal, cache, stateTracker });
    checkShutdown(p.shutdownCheck);
    const sonarCloudProfiles = await sonarCloudClient.getQualityProfiles();
    const sonarCloudMainBranch = await sonarCloudClient.getMainBranchName();
    const sonarCloudRepos = await sonarCloudClient.getRuleRepositories();
    const ruleEnrichmentMap = p.prebuiltEnrichmentMap || new Map();
    checkShutdown(p.shutdownCheck);
    const mainResult = await transferMainBranch({ extractedData, sonarcloudConfig: p.sonarcloudConfig, sonarCloudProfiles, sonarCloudMainBranch, wait: p.wait, sonarCloudClient, journal, sonarCloudRepos, ruleEnrichmentMap });
    return await finalizeTransfer({ mainResult, sonarCloudMainBranch, ...p, extractedData, extractor, sonarCloudProfiles, sonarCloudClient, journal, cache, stateTracker, sonarCloudRepos, ruleEnrichmentMap, lockFile });
  } catch (error) {
    if (!(error instanceof GracefulShutdownError) && journal) { await journal.markInterrupted().catch(() => {}); }
    await lockFile.release();
    throw error;
  }
}
