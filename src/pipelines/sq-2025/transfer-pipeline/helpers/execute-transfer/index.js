import { checkShutdown } from '../../../../../shared/utils/shutdown.js';
import { connectAndVerify } from './helpers/connect-and-verify.js';
import { initializeJournal } from './helpers/initialize-journal.js';
import { checkMainBranchIncluded } from './helpers/check-main-branch-included.js';
import { extractData } from './helpers/extract-data.js';
import { runTransferPhases } from './helpers/run-transfer-phases.js';
import { fetchCloudContext } from './helpers/fetch-cloud-context.js';

// -------- Core Transfer Execution --------

/** Core transfer logic: connect, extract, build, upload. */
export async function executeTransfer(opts) {
  const { sonarqubeConfig, sonarcloudConfig, transferConfig, performanceConfig,
    wait, skipConnectionTest, projectKey, shutdownCheck, isIncremental,
    syncAllBranches, excludeBranches, includeBranches, lockFile,
    stateTracker, journal, cache, prebuiltEnrichmentMap, initialProjectName } = opts;

  const { sonarQubeClient, sonarCloudClient, sqVersionRaw } = await connectAndVerify(sonarqubeConfig, sonarcloudConfig, skipConnectionTest);
  await initializeJournal(journal, sqVersionRaw, sonarqubeConfig, projectKey, sonarCloudClient);
  checkShutdown(shutdownCheck);

  if (includeBranches) {
    const earlyExit = await checkMainBranchIncluded(sonarQubeClient, includeBranches, projectKey, isIncremental, stateTracker, journal, lockFile, sonarcloudConfig);
    if (earlyExit) return earlyExit;
  }
  checkShutdown(shutdownCheck);

  const { extractedData, extractor } = await extractData(sonarQubeClient, sonarqubeConfig, sonarcloudConfig, transferConfig, isIncremental, stateTracker, performanceConfig, journal, cache, shutdownCheck);
  checkShutdown(shutdownCheck);

  const { sonarCloudProfiles, sonarCloudMainBranch, sonarCloudRepos } = await fetchCloudContext(sonarQubeClient, sonarCloudClient, initialProjectName);
  const ruleEnrichmentMap = prebuiltEnrichmentMap || new Map();
  checkShutdown(shutdownCheck);

  return runTransferPhases({
    sonarqubeConfig, sonarcloudConfig, transferConfig, sonarCloudProfiles, wait, shutdownCheck,
    isIncremental, syncAllBranches, excludeBranches, includeBranches,
    lockFile, stateTracker, journal, cache, ruleEnrichmentMap,
    sonarQubeClient, sonarCloudClient, sonarCloudMainBranch, sonarCloudRepos,
    extractedData, extractor, projectKey, performanceConfig,
  });
}
