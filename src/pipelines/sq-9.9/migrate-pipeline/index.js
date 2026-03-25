import { parseOptions } from './helpers/parse-options.js';
import { loadPreExistingCsvs } from './helpers/load-pre-existing-csvs.js';
import { loadCachedServerData } from './helpers/load-cached-server-data.js';
import { handleJournalResume } from './helpers/handle-journal-resume.js';
import { setupOutputDirs } from './helpers/setup-output-dirs.js';
import { buildResultsConfig } from './helpers/build-results-config.js';
import { runMigrationSteps } from './helpers/run-migration-steps.js';
import { writeFinalReports } from './helpers/write-final-reports.js';

// -------- Main Migration Orchestrator --------

export async function migrateAll(options) {
  const opts = parseOptions(options);
  const preExistingCsvs = await loadPreExistingCsvs(opts.outputDir, opts.dryRun);
  const cachedServerData = await loadCachedServerData(opts.outputDir, opts.dryRun);
  const { journal, isResume } = await handleJournalResume(opts.outputDir, opts.dryRun, opts.forceRestart, opts.sonarqubeConfig.url);

  await setupOutputDirs(opts.outputDir, isResume);
  if (!opts.dryRun) await journal.initialize({ sonarqubeUrl: opts.sonarqubeConfig.url });

  const results = buildResultsConfig(opts.perfConfig, opts.transferConfig, opts.rateLimitConfig);
  const ctx = buildContext(opts, journal);

  try {
    await runMigrationSteps(opts, ctx, results, preExistingCsvs, cachedServerData);
  } finally {
    await writeFinalReports(results, opts.outputDir);
  }

  return results;
}

function buildContext(opts, journal) {
  return {
    sonarqubeConfig: opts.sonarqubeConfig, sonarcloudOrgs: opts.sonarcloudOrgs, enterpriseConfig: opts.enterpriseConfig,
    transferConfig: opts.transferConfig, rateLimitConfig: opts.rateLimitConfig, perfConfig: opts.perfConfig,
    outputDir: opts.outputDir, dryRun: opts.dryRun, skipIssueSync: opts.skipIssueSync, skipHotspotSync: opts.skipHotspotSync,
    skipQualityProfileSync: opts.skipQualityProfileSync, skipProjectConfig: opts.skipProjectConfig, wait: opts.wait,
    onlyComponents: opts.onlyComponents, projectBranchIncludes: new Map(), migrationJournal: opts.dryRun ? null : journal,
  };
}
