import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { SonarQubeClient } from '../sonarqube/api-client.js';
import { SonarCloudClient } from '../sonarcloud/api-client.js';
import { migrateQualityGates } from '../sonarcloud/migrators/quality-gates.js';
import { migrateQualityProfiles } from '../sonarcloud/migrators/quality-profiles.js';
import { generateQualityProfileDiff } from '../sonarcloud/migrators/quality-profile-diff.js';
import { migrateGroups } from '../sonarcloud/migrators/groups.js';
import { migrateGlobalPermissions, migratePermissionTemplates } from '../sonarcloud/migrators/permissions.js';
import { migratePortfolios } from '../sonarcloud/migrators/portfolios.js';
import { mapProjectsToOrganizations, mapResourcesToOrganizations } from '../../../shared/mapping/org-mapper.js';
import { generateMappingCsvs } from '../../../shared/mapping/csv-generator.js';
import logger from '../../../shared/utils/logger.js';
import { migrateOrgProjectsCorePhase, migrateOrgProjectsMetadataPhase, resolveProjectKey } from './project-migration.js';

export async function generateOrgMappings(allProjects, extractedData, sonarcloudOrgs, outputDir, extraMappingData = {}) {
  const orgMapping = mapProjectsToOrganizations(allProjects, extractedData.projectBindings, sonarcloudOrgs);
  const resourceMappings = mapResourcesToOrganizations(extractedData, orgMapping.orgAssignments);

  await generateMappingCsvs({
    orgAssignments: orgMapping.orgAssignments,
    bindingGroups: orgMapping.bindingGroups,
    projectBindings: extractedData.projectBindings,
    projectMetadata: new Map(allProjects.map(p => [p.key, p])),
    projectBranches: extractedData.projectBranches || new Map(),
    resourceMappings,
    extractedData,
    ...extraMappingData
  }, join(outputDir, 'mappings'));

  return { orgMapping, resourceMappings };
}

export async function saveServerInfo(outputDir, extractedData) {
  logger.info('=== Step 4: Saving server info (reference) ===');
  const serverInfoDir = join(outputDir, 'server-info');
  await mkdir(serverInfoDir, { recursive: true });
  await writeFile(join(serverInfoDir, 'system.json'), JSON.stringify(extractedData.serverInfo.system, null, 2));
  await writeFile(join(serverInfoDir, 'plugins.json'), JSON.stringify(extractedData.serverInfo.plugins, null, 2));
  await writeFile(join(serverInfoDir, 'settings.json'), JSON.stringify(extractedData.serverInfo.settings, null, 2));
  await writeFile(join(serverInfoDir, 'webhooks.json'), JSON.stringify(extractedData.serverWebhooks, null, 2));
  await writeFile(join(serverInfoDir, 'alm-settings.json'), JSON.stringify(extractedData.almSettings, null, 2));
}

export async function runOrgStep(orgResult, stepName, fn) {
  const start = Date.now();
  try {
    const detail = await fn();
    orgResult.steps.push({ step: stepName, status: 'success', durationMs: Date.now() - start, ...(detail && { detail }) });
  } catch (error) {
    orgResult.steps.push({ step: stepName, status: 'failed', error: error.message, durationMs: Date.now() - start });
    logger.error(`Failed to ${stepName.toLowerCase()}: ${error.message}`);
  }
}

export async function migrateOrgWideResources(extractedData, scClient, sqClient, orgResult, results, ctx) {
  const only = ctx.onlyComponents;
  const shouldRun = (comp) => !only || only.includes(comp);
  let gateMapping = new Map();
  let builtInProfileMapping = new Map();

  // Push skipped-step entries for components not being run
  if (!shouldRun('permissions')) {
    orgResult.steps.push({ step: 'Create groups', status: 'skipped', detail: 'Not included in --only', durationMs: 0 });
    orgResult.steps.push({ step: 'Set global permissions', status: 'skipped', detail: 'Not included in --only', durationMs: 0 });
  }
  if (!shouldRun('quality-gates')) {
    orgResult.steps.push({ step: 'Create quality gates', status: 'skipped', detail: 'Not included in --only', durationMs: 0 });
  }
  if (!shouldRun('quality-profiles') || ctx.skipQualityProfileSync) {
    const reason = !shouldRun('quality-profiles') ? 'Not included in --only' : 'Disabled by --skip-quality-profile-sync';
    orgResult.steps.push({ step: 'Restore quality profiles', status: 'skipped', detail: reason, durationMs: 0 });
    orgResult.steps.push({ step: 'Compare quality profiles', status: 'skipped', detail: reason, durationMs: 0 });
    if (ctx.skipQualityProfileSync && shouldRun('quality-profiles')) {
      logger.info('Skipping quality profile sync (--skip-quality-profile-sync). Projects will use default SonarCloud profiles.');
    }
  }
  if (!shouldRun('permission-templates')) {
    orgResult.steps.push({ step: 'Create permission templates', status: 'skipped', detail: 'Not included in --only', durationMs: 0 });
  }

  // Batch 1: Independent steps run in parallel
  await Promise.all([
    shouldRun('permissions') ? runOrgStep(orgResult, 'Create groups', async () => {
      logger.info('Creating groups...');
      const groupMapping = await migrateGroups(extractedData.groups, scClient);
      results.groups += groupMapping.size;
      return `${groupMapping.size} created`;
    }) : null,
    shouldRun('quality-gates') ? runOrgStep(orgResult, 'Create quality gates', async () => {
      logger.info('Creating quality gates...');
      gateMapping = await migrateQualityGates(extractedData.qualityGates, scClient);
      results.qualityGates += gateMapping.size;
      return `${gateMapping.size} created`;
    }) : null,
    (!shouldRun('quality-profiles') || ctx.skipQualityProfileSync) ? null : runOrgStep(orgResult, 'Restore quality profiles', async () => {
      logger.info('Restoring quality profiles...');
      const migrationResult = await migrateQualityProfiles(extractedData.qualityProfiles, scClient);
      builtInProfileMapping = migrationResult.builtInProfileMapping;
      results.qualityProfiles += migrationResult.profileMapping.size;
      return `${migrationResult.profileMapping.size} restored (${builtInProfileMapping.size} built-in migrated)`;
    }),
    shouldRun('permission-templates') ? runOrgStep(orgResult, 'Create permission templates', async () => {
      logger.info('Creating permission templates...');
      await migratePermissionTemplates(extractedData.permissionTemplates, scClient);
    }) : null,
  ].filter(Boolean));

  // Batch 2: Steps that depend on Batch 1 results, run in parallel with each other
  await Promise.all([
    shouldRun('permissions') ? runOrgStep(orgResult, 'Set global permissions', async () => {
      logger.info('Setting global permissions...');
      await migrateGlobalPermissions(extractedData.globalPermissions, scClient);
    }) : null,
    (!shouldRun('quality-profiles') || ctx.skipQualityProfileSync) ? null : runOrgStep(orgResult, 'Compare quality profiles', async () => {
      logger.info('Comparing quality profiles between SonarQube and SonarCloud...');
      const diffReport = await generateQualityProfileDiff(extractedData.qualityProfiles, sqClient, scClient);
      const diffPath = join(ctx.outputDir, 'quality-profiles', 'quality-profile-diff.json');
      await writeFile(diffPath, JSON.stringify(diffReport, null, 2));
      logger.info(`Quality profile diff report written to ${diffPath}`);
      return `${diffReport.summary.languagesCompared} languages compared, ${diffReport.summary.totalMissingRules} missing rules, ${diffReport.summary.totalAddedRules} added rules`;
    }),
  ].filter(Boolean));

  return { gateMapping, builtInProfileMapping };
}

/**
 * Full org migration (upload + config + metadata sync).
 * Kept as convenience wrapper for backward compatibility.
 */
export async function migrateOneOrganization(assignment, extractedData, resourceMappings, results, ctx) {
  const coreResult = await migrateOneOrganizationCore(assignment, extractedData, resourceMappings, results, ctx);
  if (!coreResult) return new Map();
  await migrateOneOrganizationMetadata(coreResult.orgPhase2Context);
  return coreResult.projectKeyMap;
}

/**
 * Phase 1: Org-wide resources + project upload/config.
 * Returns projectKeyMap and phase2 context for metadata sync.
 */
export async function migrateOneOrganizationCore(assignment, extractedData, resourceMappings, results, ctx) {
  const { org, projects } = assignment;
  if (projects.length === 0) {
    logger.info(`Skipping org ${org.key}: no projects assigned`);
    return null;
  }

  logger.info('\n========================================');
  logger.info(`=== Migrating to organization: ${org.key} (${projects.length} projects) ===`);
  logger.info('========================================');

  const orgStart = Date.now();
  const orgResult = { key: org.key, projectCount: projects.length, steps: [] };
  results.orgResults.push(orgResult);

  const migrationJournal = ctx.migrationJournal || null;
  if (migrationJournal) {
    await migrationJournal.ensureOrg(org.key);
  }

  const scClient = new SonarCloudClient({
    url: org.url || 'https://sonarcloud.io', token: org.token,
    organization: org.key, rateLimit: ctx.rateLimitConfig
  });

  try {
    await scClient.testConnection();
    orgResult.steps.push({ step: 'Connect to SonarCloud', status: 'success' });
  } catch (error) {
    orgResult.steps.push({ step: 'Connect to SonarCloud', status: 'failed', error: error.message });
    logger.error(`Failed to connect to SonarCloud org ${org.key}: ${error.message}`);
    return null;
  }

  const sqClient = new SonarQubeClient({ url: ctx.sonarqubeConfig.url, token: ctx.sonarqubeConfig.token });

  let gateMapping, builtInProfileMapping;

  // Check journal: skip org-wide resources if already completed on a previous run
  const orgWideCachePath = join(ctx.outputDir, 'cache', `org-wide-mappings-${org.key}.json`);
  if (migrationJournal?.isOrgWideCompleted(org.key)) {
    logger.info(`Org-wide resources for ${org.key} already completed — skipping (groups, gates, profiles, templates)`);
    orgResult.steps.push({ step: 'Org-wide resources', status: 'skipped', detail: 'Completed in previous run', durationMs: 0 });

    // Reload cached mappings needed for project migration
    gateMapping = new Map();
    builtInProfileMapping = new Map();
    try {
      const cached = JSON.parse(await readFile(orgWideCachePath, 'utf-8'));
      gateMapping = new Map(cached.gateMapping || []);
      builtInProfileMapping = new Map(cached.builtInProfileMapping || []);
      logger.info(`Loaded cached org-wide mappings (${gateMapping.size} gates, ${builtInProfileMapping.size} profile overrides)`);
    } catch (e) {
      logger.warn(`Could not load cached org-wide mappings: ${e.message}. Org-wide migrators will re-derive mappings.`);
      ({ gateMapping, builtInProfileMapping } = await migrateOrgWideResources(extractedData, scClient, sqClient, orgResult, results, ctx));
    }
  } else {
    ({ gateMapping, builtInProfileMapping } = await migrateOrgWideResources(extractedData, scClient, sqClient, orgResult, results, ctx));

    // Cache mappings for resume and mark org-wide as completed
    if (migrationJournal) {
      try {
        await mkdir(join(ctx.outputDir, 'cache'), { recursive: true });
        await writeFile(orgWideCachePath, JSON.stringify({
          gateMapping: [...gateMapping.entries()],
          builtInProfileMapping: [...builtInProfileMapping.entries()]
        }));
      } catch (e) {
        logger.warn(`Failed to cache org-wide mappings: ${e.message}`);
      }
      await migrationJournal.markOrgWideCompleted(org.key);
    }
  }

  const only = ctx.onlyComponents;
  const PROJECT_COMPONENTS = ['scan-data', 'scan-data-all-branches', 'quality-gates', 'quality-profiles', 'permissions', 'issue-metadata', 'hotspot-metadata', 'project-settings'];
  const hasProjectWork = !only || PROJECT_COMPONENTS.some(c => only.includes(c));

  let projectKeyMap = new Map();
  let projectKeyWarnings = [];
  let projectPhase2Contexts = [];

  // Shared POST throttler for all project-level SC clients within this org
  const sharedThrottler = { _lastPostTime: 0 };

  if (hasProjectWork) {
    const coreResult = await migrateOrgProjectsCorePhase(
      projects, org, scClient, gateMapping, extractedData, results, { ...ctx, sharedThrottler }, builtInProfileMapping
    );
    projectKeyMap = coreResult.projectKeyMap;
    projectKeyWarnings = coreResult.projectKeyWarnings;
    projectPhase2Contexts = coreResult.projectPhase2Contexts;
  } else {
    // Fast path: only resolve project keys (needed for portfolio mapping)
    for (const project of projects) {
      const { scProjectKey } = await resolveProjectKey(project, org, scClient);
      projectKeyMap.set(project.key, scProjectKey);
    }
    logger.info(`Skipping project migration (no project-level components in --only). Resolved ${projectKeyMap.size} project key(s).`);
  }

  results.projectKeyWarnings.push(...projectKeyWarnings);

  return {
    projectKeyMap,
    orgPhase2Context: {
      org, projects, results, orgResult, orgStart, migrationJournal, projectPhase2Contexts,
    },
  };
}

/**
 * Phase 2: Issue + hotspot metadata sync for all projects in an org.
 * Runs after core phase; can execute in parallel with portfolio migration.
 */
export async function migrateOneOrganizationMetadata(orgPhase2Context) {
  const { org, projects, results, orgResult, orgStart, migrationJournal, projectPhase2Contexts } = orgPhase2Context;

  if (projectPhase2Contexts.length > 0) {
    await migrateOrgProjectsMetadataPhase(projectPhase2Contexts, projects, results);
  }

  orgResult.durationMs = Date.now() - orgStart;

  if (migrationJournal) {
    await migrationJournal.markOrgCompleted(org.key);
  }
}

/**
 * Migrate portfolios at the enterprise level (after all orgs are migrated).
 * Uses the V2 Enterprise API since portfolios are enterprise-wide in SonarCloud.
 */
export async function migrateEnterprisePortfolios(extractedData, mergedProjectKeyMap, results, ctx) {
  const enterpriseConfig = ctx.enterpriseConfig;
  if (!enterpriseConfig?.key) {
    logger.info('No enterprise key configured — skipping portfolio migration');
    return;
  }

  const allPortfolios = extractedData.portfolios || [];
  if (allPortfolios.length === 0) {
    logger.info('No portfolios to migrate');
    return;
  }

  if (ctx.onlyComponents && ctx.onlyComponents.includes('portfolios')) {
    logger.warn('Note: --only portfolios requires that projects are already migrated to SonarCloud.');
    logger.warn('If projects have not been migrated yet, portfolio creation may fail or produce empty portfolios.');
  }

  const start = Date.now();
  try {
    logger.info('Creating portfolios via Enterprise V2 API...');
    const orgConfig = ctx.sonarcloudOrgs[0];
    const created = await migratePortfolios(
      allPortfolios, mergedProjectKeyMap, enterpriseConfig, orgConfig, ctx.rateLimitConfig
    );
    results.portfolios += created;
    logger.info(`Enterprise portfolios: ${created} created`);
  } catch (error) {
    logger.error(`Failed to create enterprise portfolios: ${error.message}`);
  }
  logger.debug(`Portfolio migration took ${Date.now() - start}ms`);
}
