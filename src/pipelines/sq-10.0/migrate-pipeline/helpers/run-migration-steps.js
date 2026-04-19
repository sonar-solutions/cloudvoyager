import logger from '../../../../shared/utils/logger.js';
import { SonarQubeClient } from '../../sonarqube/api-client.js';
import { runFatalStep, logMigrationSummary } from '../../pipeline/results.js';
import { generateOrgMappings, saveServerInfo } from '../../pipeline/org-migration.js';
import { extractOrLoadServerData } from './extract-server-data.js';
import { handleDryRun } from './handle-dry-run.js';
import { applyOverrides } from './apply-csv-overrides.js';
import { runPhase1, runPhase2 } from './run-migration-phases.js';
import { collectAssignees } from './collect-assignees.js';

// -------- Run Migration Steps --------

export async function runMigrationSteps(opts, ctx, results, preExistingCsvs, cachedServerData, mappingsDir, journal) {
  logger.info('=== Step 1: Connecting to SonarQube ===');
  const sqClient = new SonarQubeClient({ url: opts.sonarqubeConfig.url, token: opts.sonarqubeConfig.token });
  await runFatalStep(results, 'Connect to SonarQube', () => sqClient.testConnection());

  logger.info('=== Step 2: Extracting server-wide data from SonarQube ===');
  const { allProjects, extractedData } = await extractOrLoadServerData(sqClient, cachedServerData, results, opts.perfConfig, opts.outputDir);

  logger.info('=== Step 3: Generating organization mappings ===');
  const extraMappingData = await collectAssignees(sqClient, allProjects, opts.dryRun);
  const { orgMapping, resourceMappings } = await generateOrgMappings(
    allProjects, extractedData, opts.sonarcloudOrgs, opts.outputDir, extraMappingData,
  );
  if (opts.dryRun) return handleDryRun(results, mappingsDir);

  const effective = applyOverrides(preExistingCsvs, extractedData, resourceMappings, orgMapping.orgAssignments, ctx);
  await saveServerInfo(opts.outputDir, extractedData);
  if (journal && !opts.dryRun) await journal.seedOrganizations(effective.orgAssignments);

  const { mergedProjectKeyMap, orgPhase2Contexts } = await runPhase1(
    effective.orgAssignments, effective.extractedData, effective.resourceMappings, results, ctx,
  );
  await runPhase2(effective.extractedData, mergedProjectKeyMap, orgPhase2Contexts, results, ctx);
  if (!opts.dryRun && journal) await journal.markCompleted();
  logMigrationSummary(results, opts.outputDir);
}
