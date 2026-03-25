import { join } from 'node:path';
import { writeAllReports } from '../../../../shared/reports/index.js';
import logger from '../../../../shared/utils/logger.js';
import { parseMigrateOpts } from './parse-migrate-opts.js';
import { loadPreExistingCsvs, loadCachedServerData } from './load-pre-existing-data.js';
import { checkResume } from './check-resume.js';
import { prepareOutputDir } from './prepare-output-dir.js';
import { buildResultsConfig } from './build-results-config.js';
import { runMigrationSteps } from './run-migration-steps.js';
import { buildContext } from './build-context.js';

// -------- Main Migration Orchestrator --------

export async function migrateAll(options) {
  const opts = parseMigrateOpts(options);
  const mappingsDir = join(opts.outputDir, 'mappings');
  const cacheFile = join(opts.outputDir, 'cache', 'server-wide-data.json');
  const preExistingCsvs = await loadPreExistingCsvs(mappingsDir, opts.dryRun);
  const cachedServerData = await loadCachedServerData(cacheFile, opts.dryRun);
  const { journal, isResume } = await checkResume(opts.outputDir, opts.dryRun, opts.forceRestart, opts.sonarqubeConfig.url);
  await prepareOutputDir(opts.outputDir, isResume);
  if (!opts.dryRun) await journal.initialize({ sonarqubeUrl: opts.sonarqubeConfig.url });
  const results = buildResultsConfig(opts.perfConfig, opts.transferConfig, opts.rateLimitConfig);
  const ctx = buildContext(opts, journal);
  try {
    await runMigrationSteps(opts, ctx, results, preExistingCsvs, cachedServerData, mappingsDir, journal);
  } finally {
    results.endTime = new Date().toISOString();
    try { await writeAllReports(results, join(opts.outputDir, 'reports')); }
    catch (e) { logger.error(`Failed to write migration report: ${e.message}`); }
  }
  return results;
}
