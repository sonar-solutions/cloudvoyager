// -------- Parse Transfer Options --------

/**
 * Parse and normalize the transfer project options.
 * @param {object} opts - Raw options from caller
 * @returns {object} Parsed config values
 */
export function parseTransferOpts(opts) {
  const { sonarqubeConfig, sonarcloudConfig, transferConfig, performanceConfig = {}, wait = false, skipConnectionTest = false, shutdownCoordinator = null, forceRestart = false, forceFreshExtract = false, forceUnlock = false } = opts;
  const { projectName = null, ruleEnrichmentMap: prebuiltEnrichmentMap = null } = opts;
  return {
    sonarqubeConfig, sonarcloudConfig, transferConfig, performanceConfig, wait, skipConnectionTest,
    shutdownCoordinator, forceRestart, forceFreshExtract, forceUnlock, projectName, prebuiltEnrichmentMap,
    projectKey: sonarqubeConfig.projectKey,
    shutdownCheck: shutdownCoordinator ? shutdownCoordinator.shutdownCheck() : () => false,
    checkpointEnabled: transferConfig.checkpoint?.enabled !== false,
    isIncremental: transferConfig.mode === 'incremental',
    syncAllBranches: transferConfig.syncAllBranches !== false,
    excludeBranches: new Set(transferConfig.excludeBranches || []),
    includeBranches: transferConfig.includeBranches || null,
  };
}
