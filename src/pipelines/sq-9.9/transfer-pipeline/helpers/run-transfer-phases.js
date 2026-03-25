import { DataExtractor } from '../../sonarqube/extractors/index.js';
import { checkShutdown } from '../../../../shared/utils/shutdown.js';
import { fetchCloudContext } from './fetch-cloud-context.js';
import { transferMainBranch } from './transfer-main-branch.js';
import { transferNonMainBranches } from './transfer-non-main-branches.js';
import { aggregateBranchResults } from './aggregate-branch-stats.js';
import logger from '../../../../shared/utils/logger.js';

// -------- Run Transfer Phases (extract, build, upload) --------

export async function runTransferPhases({ sonarQubeClient, sonarCloudClient, sonarqubeConfig, sonarcloudConfig, transferConfig, performanceConfig, wait, isIncremental, syncAllBranches, excludeBranches, includeBranches, stateTracker, journal, cache, shutdownCheck, projectKey, prebuiltEnrichmentMap }) {
  const config = { sonarqube: sonarqubeConfig, sonarcloud: sonarcloudConfig, transfer: transferConfig };
  const extractor = new DataExtractor(sonarQubeClient, config, isIncremental ? stateTracker : null, performanceConfig);

  logger.info('Starting data extraction from SonarQube (main branch)...');
  const extractedData = (journal && cache)
    ? await extractor.extractAllWithCheckpoints(journal, cache, shutdownCheck)
    : await extractor.extractAll();

  checkShutdown(shutdownCheck);

  const { sonarCloudProfiles, sonarCloudMainBranch, sonarCloudRepos, ruleEnrichmentMap } = await fetchCloudContext(sonarCloudClient, prebuiltEnrichmentMap);
  checkShutdown(shutdownCheck);

  const mainBranchResult = await transferMainBranch({ journal, sonarCloudMainBranch, sonarCloudClient, extractedData, sonarcloudConfig, sonarCloudProfiles, wait, sonarCloudRepos, ruleEnrichmentMap });

  const aggregatedStats = {
    issuesTransferred: mainBranchResult.stats.issuesTransferred || 0,
    hotspotsTransferred: mainBranchResult.stats.hotspotsTransferred || 0,
    componentsTransferred: mainBranchResult.stats.componentsTransferred || 0,
    sourcesTransferred: mainBranchResult.stats.sourcesTransferred || 0,
    linesOfCode: mainBranchResult.stats.linesOfCode || 0,
    branchesTransferred: [sonarCloudMainBranch],
  };

  if (isIncremental) { stateTracker.markBranchCompleted(sonarCloudMainBranch); await stateTracker.save(); }
  checkShutdown(shutdownCheck);

  if (syncAllBranches) {
    const branchResults = await transferNonMainBranches({ extractedData, excludeBranches, includeBranches, sonarCloudMainBranch, mainBranchCeTaskId: mainBranchResult.ceTask?.id, wait, sonarCloudClient, extractor, journal, cache, shutdownCheck, sonarcloudConfig, sonarCloudProfiles, sonarCloudRepos, ruleEnrichmentMap, isIncremental, stateTracker, performanceConfig });
    aggregateBranchResults(branchResults, aggregatedStats);
  }

  return aggregatedStats;
}
