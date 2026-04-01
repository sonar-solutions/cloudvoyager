import { join } from 'node:path';
import logger from '../../../shared/utils/logger.js';
import { writeAllReports } from '../../../shared/reports/index.js';
import { generateOrgMappings } from '../pipeline/org-migration.js';
import { loadPreExistingData } from './helpers/load-pre-existing-data.js';
import { handleResumePrompt, setupOutputDir } from './helpers/handle-resume-prompt.js';
import { buildMigrationContext } from './helpers/build-migration-context.js';
import { extractAndCacheData } from './helpers/extract-and-cache-data.js';
import { handleDryRun } from './helpers/handle-dry-run.js';
import { applyCsvAndMigrate } from './helpers/apply-csv-and-migrate.js';
import { collectAssigneeData } from './helpers/collect-assignee-data.js';
import { gatherIssuesDelta } from './helpers/gather-issues-delta.js';

// -------- Migrate All --------

/** Main migration pipeline orchestrator. */
export async function migrateAll(options) {
  const migrateConfig = options.migrateConfig || {};
  const outputDir = migrateConfig.outputDir || './migration-output';
  const dryRun = migrateConfig.dryRun || false;

  const { preExistingCsvs, cachedServerData } = await loadPreExistingData(outputDir, dryRun);
  const { migrationJournal, isResume } = await handleResumePrompt(outputDir, dryRun, migrateConfig.forceRestart || false, options.sonarqubeConfig.url);
  await setupOutputDir(outputDir, isResume);
  if (!dryRun) await migrationJournal.initialize({ sonarqubeUrl: options.sonarqubeConfig.url });

  const { results, perfConfig, ctx } = buildMigrationContext(options, migrationJournal);

  try {
    const { allProjects, extractedData } = await extractAndCacheData(ctx, results, perfConfig, cachedServerData);
    logger.info('=== Step 3: Generating organization mappings ===');
    const extraMappingData = dryRun ? await collectAssigneeData(options.sonarqubeConfig, allProjects) : {};
    const { orgMapping, resourceMappings } = await generateOrgMappings(allProjects, extractedData, options.sonarcloudOrgs, outputDir, extraMappingData);
    if (dryRun) return handleDryRun(results, outputDir);

    await applyCsvAndMigrate(orgMapping, resourceMappings, extractedData, preExistingCsvs, results, ctx);
  } finally {
    results.endTime = new Date().toISOString();
    try { await gatherIssuesDelta(results, ctx); }
    catch (e) { logger.warn(`Issues delta report failed: ${e.message}`); }
    try { await writeAllReports(results, join(outputDir, 'reports')); }
    catch (e) { logger.error(`Failed to write migration report: ${e.message}`); }
  }

  return results;
}
