import { join } from 'node:path';
import { SonarQubeClient } from '../../sonarqube/api-client.js';
import { MigrationJournal } from '../../../../shared/state/migration-journal.js';
import { writeAllReports } from '../../../../shared/reports/index.js';
import { runFatalStep, logMigrationSummary } from '../../pipeline/results.js';
import { saveServerInfo } from '../../pipeline/org-migration.js';
import { buildMigrateContext } from './build-migrate-context.js';
import { loadPreExistingData } from './load-pre-existing-data.js';
import { handleJournalResume } from './handle-journal-resume.js';
import { prepareOutputDir } from './prepare-output-dir.js';
import { extractServerData } from './extract-server-data.js';
import { generateMappings } from './generate-mappings.js';
import { handleDryRun } from './handle-dry-run.js';
import { applyPreExistingCsvOverrides } from './apply-csv-overrides.js';
import { runMigrationPhases } from './run-migration-phases.js';
import logger from '../../../../shared/utils/logger.js';

// -------- Main Logic --------

export async function migrateAll(options) {
  const { results, perfConfig, ctx, outputDir, migrateConfig } = buildMigrateContext(options);
  const { preExistingCsvs, cachedServerData } = await loadPreExistingData(outputDir, ctx.dryRun);
  const journalPath = join(outputDir, 'state', 'migration.journal');
  const journal = new MigrationJournal(journalPath);
  const isResume = await handleJournalResume(journal, journalPath, ctx.dryRun, migrateConfig.forceRestart || false, ctx.sonarqubeConfig.url);
  await prepareOutputDir(outputDir, isResume);
  if (!ctx.dryRun) { await journal.initialize({ sonarqubeUrl: ctx.sonarqubeConfig.url }); ctx.migrationJournal = journal; }

  try {
    logger.info('=== Step 1: Connecting to SonarQube ===');
    const sqClient = new SonarQubeClient({ url: ctx.sonarqubeConfig.url, token: ctx.sonarqubeConfig.token });
    await runFatalStep(results, 'Connect to SonarQube', () => sqClient.testConnection());
    logger.info('=== Step 2: Extracting server-wide data from SonarQube ===');
    const { allProjects, extractedData } = await extractServerData(sqClient, results, perfConfig, outputDir, cachedServerData);
    const { orgMapping, resourceMappings } = await generateMappings(sqClient, allProjects, extractedData, ctx.sonarcloudOrgs, outputDir, ctx.dryRun);
    if (ctx.dryRun) return handleDryRun(results, outputDir);

    const effective = applyPreExistingCsvOverrides(preExistingCsvs, extractedData, resourceMappings, orgMapping.orgAssignments, ctx);
    await saveServerInfo(outputDir, extractedData);
    if (journal && !ctx.dryRun) await journal.seedOrganizations(effective.orgAssignments);
    await runMigrationPhases(effective.orgAssignments, effective.extractedData, effective.resourceMappings, results, ctx);
    if (!ctx.dryRun && journal) await journal.markCompleted();
    logMigrationSummary(results, outputDir);
  } finally {
    results.endTime = new Date().toISOString();
    try { await writeAllReports(results, join(outputDir, 'reports')); }
    catch (e) { logger.error(`Failed to write migration report: ${e.message}`); }
  }
  return results;
}
