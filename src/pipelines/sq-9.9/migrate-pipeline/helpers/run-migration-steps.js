import logger from '../../../../shared/utils/logger.js';
import { SonarQubeClient } from '../../sonarqube/api-client.js';
import { runFatalStep, logMigrationSummary } from '../../pipeline/results.js';
import { generateOrgMappings, saveServerInfo } from '../../pipeline/org-migration.js';
import { extractOrLoadServerData } from './extract-or-load-server-data.js';
import { collectAssignees } from './collect-assignees.js';
import { logDryRunComplete } from './log-dry-run-complete.js';
import { applyCsvOverridesStep } from './apply-csv-overrides-step.js';
import { runPhaseOne } from './run-phase-one.js';
import { runPhaseTwo } from './run-phase-two.js';

// -------- Execute All Migration Steps --------

export async function runMigrationSteps(opts, ctx, results, preExistingCsvs, cachedServerData) {
  logger.info('=== Step 1: Connecting to SonarQube ===');
  const sqClient = new SonarQubeClient({ url: opts.sonarqubeConfig.url, token: opts.sonarqubeConfig.token });
  await runFatalStep(results, 'Connect to SonarQube', () => sqClient.testConnection());

  logger.info('=== Step 2: Extracting server-wide data from SonarQube ===');
  const { allProjects, extractedData } = await extractOrLoadServerData(sqClient, cachedServerData, results, opts.perfConfig, opts.outputDir);

  logger.info('=== Step 3: Generating organization mappings ===');
  const extraMappingData = opts.dryRun ? await collectAssignees(sqClient, allProjects) : {};
  const { orgMapping, resourceMappings } = await generateOrgMappings(allProjects, extractedData, opts.sonarcloudOrgs, opts.outputDir, extraMappingData);

  if (opts.dryRun) { logDryRunComplete(opts.outputDir); results.dryRun = true; return; }

  const { effectiveExtractedData, effectiveResourceMappings, effectiveOrgAssignments } =
    applyCsvOverridesStep(preExistingCsvs, extractedData, resourceMappings, orgMapping.orgAssignments, ctx);

  await saveServerInfo(opts.outputDir, extractedData);
  if (ctx.migrationJournal) await ctx.migrationJournal.seedOrganizations(effectiveOrgAssignments);

  const { mergedProjectKeyMap, orgPhase2Contexts } = await runPhaseOne(effectiveOrgAssignments, effectiveExtractedData, effectiveResourceMappings, results, ctx);
  await runPhaseTwo(effectiveExtractedData, mergedProjectKeyMap, orgPhase2Contexts, results, ctx);

  if (ctx.migrationJournal) await ctx.migrationJournal.markCompleted();
  logMigrationSummary(results, opts.outputDir);
}
