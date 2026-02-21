import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { SonarQubeClient } from '../sonarqube/api-client.js';
import { SonarCloudClient } from '../sonarcloud/api-client.js';
import { migrateQualityGates } from '../sonarcloud/migrators/quality-gates.js';
import { migrateQualityProfiles } from '../sonarcloud/migrators/quality-profiles.js';
import { generateQualityProfileDiff } from '../sonarcloud/migrators/quality-profile-diff.js';
import { migrateGroups } from '../sonarcloud/migrators/groups.js';
import { migrateGlobalPermissions, migratePermissionTemplates } from '../sonarcloud/migrators/permissions.js';
import { migratePortfolios } from '../sonarcloud/migrators/portfolios.js';
import { mapProjectsToOrganizations, mapResourcesToOrganizations } from '../mapping/org-mapper.js';
import { generateMappingCsvs } from '../mapping/csv-generator.js';
import logger from '../utils/logger.js';
import { migrateOrgProjects, resolveProjectKey } from './project-migration.js';

export async function generateOrgMappings(allProjects, extractedData, sonarcloudOrgs, outputDir) {
  const orgMapping = mapProjectsToOrganizations(allProjects, extractedData.projectBindings, sonarcloudOrgs);
  const resourceMappings = mapResourcesToOrganizations(extractedData, orgMapping.orgAssignments);

  await generateMappingCsvs({
    orgAssignments: orgMapping.orgAssignments,
    bindingGroups: orgMapping.bindingGroups,
    projectBindings: extractedData.projectBindings,
    projectMetadata: new Map(allProjects.map(p => [p.key, p])),
    resourceMappings,
    extractedData
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

  // Groups and global permissions are part of the 'permissions' component
  if (shouldRun('permissions')) {
    await runOrgStep(orgResult, 'Create groups', async () => {
      logger.info('Creating groups...');
      const groupMapping = await migrateGroups(extractedData.groups, scClient);
      results.groups += groupMapping.size;
      return `${groupMapping.size} created`;
    });

    await runOrgStep(orgResult, 'Set global permissions', async () => {
      logger.info('Setting global permissions...');
      await migrateGlobalPermissions(extractedData.globalPermissions, scClient);
    });
  } else {
    orgResult.steps.push({ step: 'Create groups', status: 'skipped', detail: 'Not included in --only', durationMs: 0 });
    orgResult.steps.push({ step: 'Set global permissions', status: 'skipped', detail: 'Not included in --only', durationMs: 0 });
  }

  if (shouldRun('quality-gates')) {
    await runOrgStep(orgResult, 'Create quality gates', async () => {
      logger.info('Creating quality gates...');
      gateMapping = await migrateQualityGates(extractedData.qualityGates, scClient);
      results.qualityGates += gateMapping.size;
      return `${gateMapping.size} created`;
    });
  } else {
    orgResult.steps.push({ step: 'Create quality gates', status: 'skipped', detail: only ? 'Not included in --only' : undefined, durationMs: 0 });
  }

  if (!shouldRun('quality-profiles') || ctx.skipQualityProfileSync) {
    const reason = !shouldRun('quality-profiles') ? 'Not included in --only' : 'Disabled by --skip-quality-profile-sync';
    orgResult.steps.push({ step: 'Restore quality profiles', status: 'skipped', detail: reason, durationMs: 0 });
    orgResult.steps.push({ step: 'Compare quality profiles', status: 'skipped', detail: reason, durationMs: 0 });
    if (ctx.skipQualityProfileSync && shouldRun('quality-profiles')) {
      logger.info('Skipping quality profile sync (--skip-quality-profile-sync). Projects will use default SonarCloud profiles.');
    }
  } else {
    await runOrgStep(orgResult, 'Restore quality profiles', async () => {
      logger.info('Restoring quality profiles...');
      const migrationResult = await migrateQualityProfiles(extractedData.qualityProfiles, scClient);
      builtInProfileMapping = migrationResult.builtInProfileMapping;
      results.qualityProfiles += migrationResult.profileMapping.size;
      return `${migrationResult.profileMapping.size} restored (${builtInProfileMapping.size} built-in migrated)`;
    });

    await runOrgStep(orgResult, 'Compare quality profiles', async () => {
      logger.info('Comparing quality profiles between SonarQube and SonarCloud...');
      const diffReport = await generateQualityProfileDiff(extractedData.qualityProfiles, sqClient, scClient);
      const diffPath = join(ctx.outputDir, 'quality-profiles', 'quality-profile-diff.json');
      await writeFile(diffPath, JSON.stringify(diffReport, null, 2));
      logger.info(`Quality profile diff report written to ${diffPath}`);
      return `${diffReport.summary.languagesCompared} languages compared, ${diffReport.summary.totalMissingRules} missing rules, ${diffReport.summary.totalAddedRules} added rules`;
    });
  }

  if (shouldRun('permission-templates')) {
    await runOrgStep(orgResult, 'Create permission templates', async () => {
      logger.info('Creating permission templates...');
      await migratePermissionTemplates(extractedData.permissionTemplates, scClient);
    });
  } else {
    orgResult.steps.push({ step: 'Create permission templates', status: 'skipped', detail: only ? 'Not included in --only' : undefined, durationMs: 0 });
  }

  return { gateMapping, builtInProfileMapping };
}

export async function migrateOneOrganization(assignment, extractedData, resourceMappings, results, ctx) {
  const { org, projects } = assignment;
  if (projects.length === 0) {
    logger.info(`Skipping org ${org.key}: no projects assigned`);
    return new Map();
  }

  logger.info('\n========================================');
  logger.info(`=== Migrating to organization: ${org.key} (${projects.length} projects) ===`);
  logger.info('========================================');

  const orgStart = Date.now();
  const orgResult = { key: org.key, projectCount: projects.length, steps: [] };
  results.orgResults.push(orgResult);

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
    return new Map();
  }

  const sqClient = new SonarQubeClient({ url: ctx.sonarqubeConfig.url, token: ctx.sonarqubeConfig.token });
  const { gateMapping, builtInProfileMapping } = await migrateOrgWideResources(extractedData, scClient, sqClient, orgResult, results, ctx);

  const only = ctx.onlyComponents;
  const PROJECT_COMPONENTS = ['scan-data', 'scan-data-all-branches', 'quality-gates', 'quality-profiles', 'permissions', 'issue-metadata', 'hotspot-metadata', 'project-settings'];
  const hasProjectWork = !only || PROJECT_COMPONENTS.some(c => only.includes(c));

  let projectKeyMap = new Map();
  let projectKeyWarnings = [];

  if (hasProjectWork) {
    const result = await migrateOrgProjects(
      projects, org, scClient, gateMapping, extractedData, results, ctx, builtInProfileMapping
    );
    projectKeyMap = result.projectKeyMap;
    projectKeyWarnings = result.projectKeyWarnings;
  } else {
    // Fast path: only resolve project keys (needed for portfolio mapping)
    for (const project of projects) {
      const { scProjectKey } = await resolveProjectKey(project, org, scClient);
      projectKeyMap.set(project.key, scProjectKey);
    }
    logger.info(`Skipping project migration (no project-level components in --only). Resolved ${projectKeyMap.size} project key(s).`);
  }

  results.projectKeyWarnings.push(...projectKeyWarnings);
  orgResult.durationMs = Date.now() - orgStart;

  return projectKeyMap;
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
