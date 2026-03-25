// -------- Build Migration Context --------

export function buildContext(opts, journal) {
  return {
    sonarqubeConfig: opts.sonarqubeConfig, sonarcloudOrgs: opts.sonarcloudOrgs,
    enterpriseConfig: opts.enterpriseConfig, transferConfig: opts.transferConfig,
    rateLimitConfig: opts.rateLimitConfig, perfConfig: opts.perfConfig,
    outputDir: opts.outputDir, dryRun: opts.dryRun, wait: opts.wait,
    skipIssueSync: opts.skipIssueSync, skipHotspotSync: opts.skipHotspotSync,
    skipQualityProfileSync: opts.skipQualityProfileSync, skipProjectConfig: opts.skipProjectConfig,
    onlyComponents: opts.onlyComponents, projectBranchIncludes: new Map(),
    migrationJournal: opts.dryRun ? null : journal,
  };
}
