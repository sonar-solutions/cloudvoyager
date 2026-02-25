import { existsSync } from 'node:fs';
import { mkdir, rm, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { SonarQubeClient } from './sonarqube/api-client.js';
import { resolvePerformanceConfig, collectEnvironmentInfo } from './utils/concurrency.js';
import logger from './utils/logger.js';
import { writeAllReports } from './reports/index.js';
import { createEmptyResults, runFatalStep, logMigrationSummary } from './pipeline/results.js';
import { extractAllProjects, extractServerWideData } from './pipeline/extraction.js';
import { generateOrgMappings, saveServerInfo, migrateOneOrganization, migrateEnterprisePortfolios } from './pipeline/org-migration.js';
import { loadMappingCsvs } from './mapping/csv-reader.js';
import { applyCsvOverrides } from './mapping/csv-applier.js';

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
  const skipProjectConfig = migrateConfig.skipProjectConfig || false;
  const onlyComponents = migrateConfig.onlyComponents || null;

  // Read existing CSVs and cached server-wide data BEFORE wiping output dir
  const mappingsDir = join(outputDir, 'mappings');
  let preExistingCsvs = null;
  if (!dryRun && existsSync(mappingsDir)) {
    try {
      preExistingCsvs = await loadMappingCsvs(mappingsDir);
      if (preExistingCsvs.size > 0) {
        logger.info(`Found ${preExistingCsvs.size} existing mapping CSV(s) from a previous dry-run`);
        logger.info('These will be used as the source of truth for filtering/overrides');
      } else {
        preExistingCsvs = null;
      }
    } catch (e) {
      logger.warn(`Failed to read existing CSVs: ${e.message}. Proceeding without overrides.`);
    }
  }

  const cacheFile = join(outputDir, 'cache', 'server-wide-data.json');
  let cachedServerData = null;
  if (!dryRun && existsSync(cacheFile)) {
    try {
      const raw = JSON.parse(await readFile(cacheFile, 'utf-8'));
      raw.extractedData.projectBindings = new Map(raw.extractedData.projectBindings);
      cachedServerData = raw;
      logger.info('Found cached server-wide data from a previous run — will reuse instead of re-extracting');
    } catch (e) {
      logger.warn(`Failed to read server-wide data cache: ${e.message}. Will re-extract.`);
    }
  }

  logger.info(`Cleaning output directory: ${outputDir}`);
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });
  await mkdir(join(outputDir, 'state'), { recursive: true });
  await mkdir(join(outputDir, 'quality-profiles'), { recursive: true });

  const results = createEmptyResults();
  results.environment = collectEnvironmentInfo();
  results.configuration = {
    transferMode: transferConfig.mode || 'full',
    batchSize: transferConfig.batchSize || 100,
    autoTune: perfConfig.autoTune || false,
    performance: {
      maxConcurrency: perfConfig.maxConcurrency,
      sourceExtraction: { concurrency: perfConfig.sourceExtraction.concurrency },
      hotspotExtraction: { concurrency: perfConfig.hotspotExtraction.concurrency },
      issueSync: { concurrency: perfConfig.issueSync.concurrency },
      hotspotSync: { concurrency: perfConfig.hotspotSync.concurrency },
      projectMigration: { concurrency: perfConfig.projectMigration.concurrency }
    },
    rateLimit: rateLimitConfig ? {
      maxRetries: rateLimitConfig.maxRetries ?? 3,
      baseDelay: rateLimitConfig.baseDelay ?? 1000,
      minRequestInterval: rateLimitConfig.minRequestInterval ?? 0
    } : { maxRetries: 3, baseDelay: 1000, minRequestInterval: 0 }
  };
  const ctx = {
    sonarqubeConfig, sonarcloudOrgs, enterpriseConfig, transferConfig, rateLimitConfig,
    perfConfig, outputDir, dryRun, skipIssueSync, skipHotspotSync, skipQualityProfileSync, skipProjectConfig, wait,
    onlyComponents
  };

  try {
    logger.info('=== Step 1: Connecting to SonarQube ===');
    const sqClient = new SonarQubeClient({ url: sonarqubeConfig.url, token: sonarqubeConfig.token });
    await runFatalStep(results, 'Connect to SonarQube', () => sqClient.testConnection());

    logger.info('=== Step 2: Extracting server-wide data from SonarQube ===');
    let allProjects;
    let extractedData;
    if (cachedServerData) {
      logger.info('Using cached server-wide data (skipping re-extraction)');
      allProjects = cachedServerData.allProjects;
      extractedData = cachedServerData.extractedData;
      results.serverSteps.push({ step: 'Server-wide data', status: 'cached', detail: 'Loaded from previous run' });
    } else {
      allProjects = await extractAllProjects(sqClient, results);
      extractedData = await extractServerWideData(sqClient, allProjects, results, perfConfig);

      // Save cache for subsequent runs (migrate, sync-metadata)
      try {
        const cacheDir = join(outputDir, 'cache');
        await mkdir(cacheDir, { recursive: true });
        const serializable = {
          allProjects,
          extractedData: { ...extractedData, projectBindings: [...extractedData.projectBindings.entries()] }
        };
        await writeFile(join(cacheDir, 'server-wide-data.json'), JSON.stringify(serializable));
        logger.info('Server-wide data cached for subsequent runs');
      } catch (e) {
        logger.warn(`Failed to write server-wide data cache: ${e.message}`);
      }
    }

    logger.info('=== Step 3: Generating organization mappings ===');
    const { orgMapping, resourceMappings } = await generateOrgMappings(
      allProjects, extractedData, sonarcloudOrgs, outputDir
    );

    if (dryRun) {
      logger.info('');
      logger.info('=== Dry run complete ===');
      logger.info(`Mapping CSVs generated in: ${mappingsDir}`);
      logger.info('');
      logger.info('Review and edit the CSV files to customize your migration:');
      logger.info('  - Set Include=no on any row to exclude it from migration');
      logger.info('  - Edit quality gate condition thresholds (Condition Threshold column)');
      logger.info('  - Remove specific permission assignments');
      logger.info('  - Exclude specific portfolio project memberships');
      logger.info('');
      logger.info('When ready, re-run without --dry-run:');
      logger.info('  cloudvoyager migrate -c config.json');
      logger.info('');
      logger.info('The tool will automatically detect and apply your CSV edits.');
      results.dryRun = true;
      return results;
    }

    // Apply CSV overrides from previous dry-run if available
    let effectiveExtractedData = extractedData;
    let effectiveResourceMappings = resourceMappings;
    let effectiveOrgAssignments = orgMapping.orgAssignments;

    if (preExistingCsvs) {
      logger.info('=== Applying CSV overrides from previous dry-run ===');
      const overrideResult = applyCsvOverrides(
        preExistingCsvs, extractedData, resourceMappings, orgMapping.orgAssignments
      );
      effectiveExtractedData = overrideResult.filteredExtractedData;
      effectiveResourceMappings = overrideResult.filteredResourceMappings;
      effectiveOrgAssignments = overrideResult.filteredOrgAssignments;

      const origProjectCount = orgMapping.orgAssignments.reduce((n, a) => n + a.projects.length, 0);
      const filteredProjectCount = effectiveOrgAssignments.reduce((n, a) => n + a.projects.length, 0);
      if (filteredProjectCount < origProjectCount) {
        logger.info(`Projects: ${filteredProjectCount}/${origProjectCount} included after CSV filtering`);
      }
      logger.info('CSV overrides applied successfully');
    }

    await saveServerInfo(outputDir, extractedData);

    const mergedProjectKeyMap = new Map();
    for (const assignment of effectiveOrgAssignments) {
      const projectKeyMap = await migrateOneOrganization(assignment, effectiveExtractedData, effectiveResourceMappings, results, ctx);
      for (const [sqKey, scKey] of projectKeyMap) {
        mergedProjectKeyMap.set(sqKey, scKey);
      }
    }

    if (!onlyComponents || onlyComponents.includes('portfolios')) {
      await migrateEnterprisePortfolios(effectiveExtractedData, mergedProjectKeyMap, results, ctx);
    } else {
      logger.info('Skipping enterprise portfolio migration (not included in --only)');
    }

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
