import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { SonarQubeClient } from './sonarqube/api-client.js';
import { resolvePerformanceConfig } from './utils/concurrency.js';
import logger from './utils/logger.js';
import { writeAllReports } from './reports/index.js';
import { createEmptyResults, runFatalStep, logMigrationSummary } from './pipeline/results.js';
import { extractAllProjects, extractServerWideData } from './pipeline/extraction.js';
import { generateOrgMappings, saveServerInfo, migrateOneOrganization, migrateEnterprisePortfolios } from './pipeline/org-migration.js';

export async function migrateAll(options) {
  const {
    sonarqubeConfig,
    sonarcloudOrgs,
    enterpriseConfig,
    migrateConfig = {},
    transferConfig = { mode: 'full', batchSize: 100 },
    rateLimitConfig,
    performanceConfig: rawPerfConfig = {},
    wait = false
  } = options;

  const perfConfig = resolvePerformanceConfig(rawPerfConfig);
  const outputDir = migrateConfig.outputDir || './migration-output';
  const dryRun = migrateConfig.dryRun || false;
  const skipIssueSync = migrateConfig.skipIssueMetadataSync || migrateConfig.skipIssueSync || false;
  const skipHotspotSync = migrateConfig.skipHotspotMetadataSync || migrateConfig.skipHotspotSync || false;
  const skipQualityProfileSync = migrateConfig.skipQualityProfileSync || false;

  logger.info(`Cleaning output directory: ${outputDir}`);
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });
  await mkdir(join(outputDir, 'state'), { recursive: true });
  await mkdir(join(outputDir, 'quality-profiles'), { recursive: true });

  const results = createEmptyResults();
  const ctx = {
    sonarqubeConfig, sonarcloudOrgs, enterpriseConfig, transferConfig, rateLimitConfig,
    perfConfig, outputDir, dryRun, skipIssueSync, skipHotspotSync, skipQualityProfileSync, wait
  };

  try {
    logger.info('=== Step 1: Connecting to SonarQube ===');
    const sqClient = new SonarQubeClient({ url: sonarqubeConfig.url, token: sonarqubeConfig.token });
    await runFatalStep(results, 'Connect to SonarQube', () => sqClient.testConnection());

    logger.info('=== Step 2: Extracting server-wide data from SonarQube ===');
    const allProjects = await extractAllProjects(sqClient, results);
    const extractedData = await extractServerWideData(sqClient, allProjects, results, perfConfig);

    logger.info('=== Step 3: Generating organization mappings ===');
    const { orgMapping, resourceMappings } = await generateOrgMappings(
      allProjects, extractedData, sonarcloudOrgs, outputDir
    );

    if (dryRun) {
      logger.info('=== Dry run complete. Mapping CSVs generated. No data migrated. ===');
      results.dryRun = true;
      return results;
    }

    await saveServerInfo(outputDir, extractedData);

    const mergedProjectKeyMap = new Map();
    for (const assignment of orgMapping.orgAssignments) {
      const projectKeyMap = await migrateOneOrganization(assignment, extractedData, resourceMappings, results, ctx);
      for (const [sqKey, scKey] of projectKeyMap) {
        mergedProjectKeyMap.set(sqKey, scKey);
      }
    }

    await migrateEnterprisePortfolios(extractedData, mergedProjectKeyMap, results, ctx);

    logMigrationSummary(results, outputDir);
  } finally {
    results.endTime = new Date().toISOString();
    try {
      await writeAllReports(results, join(outputDir, 'reports'));
    } catch (reportError) {
      logger.error(`Failed to write migration report: ${reportError.message}`);
    }
  }

  return results;
}
