import { writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { SonarQubeClient } from './sonarqube/api-client.js';
import { SonarCloudClient } from './sonarcloud/api-client.js';
import { transferProject } from './transfer-pipeline.js';
import { extractQualityGates } from './sonarqube/extractors/quality-gates.js';
import { extractQualityProfiles } from './sonarqube/extractors/quality-profiles.js';
import { extractGroups } from './sonarqube/extractors/groups.js';
import { extractGlobalPermissions, extractProjectPermissions, extractPermissionTemplates } from './sonarqube/extractors/permissions.js';
import { extractPortfolios } from './sonarqube/extractors/portfolios.js';
import { extractServerInfo } from './sonarqube/extractors/server-info.js';
import { extractHotspots } from './sonarqube/extractors/hotspots.js';
import { extractProjectSettings } from './sonarqube/extractors/project-settings.js';
import { extractProjectTags } from './sonarqube/extractors/project-tags.js';
import { extractProjectLinks } from './sonarqube/extractors/project-links.js';
import { extractNewCodePeriods } from './sonarqube/extractors/new-code-periods.js';
import { extractWebhooks } from './sonarqube/extractors/webhooks.js';
import { extractAlmSettings, extractAllProjectBindings } from './sonarqube/extractors/devops-bindings.js';
import { migrateQualityGates, assignQualityGatesToProjects } from './sonarcloud/migrators/quality-gates.js';
import { migrateQualityProfiles } from './sonarcloud/migrators/quality-profiles.js';
import { migrateGroups } from './sonarcloud/migrators/groups.js';
import { migrateGlobalPermissions, migrateProjectPermissions, migratePermissionTemplates } from './sonarcloud/migrators/permissions.js';
import { migrateProjectSettings, migrateProjectTags, migrateProjectLinks, migrateNewCodePeriods, migrateDevOpsBinding } from './sonarcloud/migrators/project-config.js';
import { syncIssues } from './sonarcloud/migrators/issue-sync.js';
import { syncHotspots } from './sonarcloud/migrators/hotspot-sync.js';
import { migratePortfolios } from './sonarcloud/migrators/portfolios.js';
import { mapProjectsToOrganizations, mapResourcesToOrganizations } from './mapping/org-mapper.js';
import { generateMappingCsvs } from './mapping/csv-generator.js';
import { resolvePerformanceConfig } from './utils/concurrency.js';
import logger from './utils/logger.js';

/**
 * Execute the full multi-organization migration pipeline
 *
 * @param {object} options
 * @param {object} options.sonarqubeConfig - { url, token }
 * @param {Array} options.sonarcloudOrgs - Array of { key, token, url }
 * @param {object} options.migrateConfig - { outputDir, skipIssueSync, skipHotspotSync, dryRun }
 * @param {object} options.transferConfig - { mode, stateFile, batchSize }
 * @param {object} [options.performanceConfig] - Performance tuning options (concurrency, workers, memory)
 * @param {boolean} [options.wait=false] - Whether to wait for analysis completion
 * @returns {Promise<object>} Migration results
 */
export async function migrateAll(options) {
  const {
    sonarqubeConfig,
    sonarcloudOrgs,
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

  // Clean output directory from previous runs
  logger.info(`Cleaning output directory: ${outputDir}`);
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });

  const results = createEmptyResults();

  const ctx = {
    sonarqubeConfig, sonarcloudOrgs, transferConfig, rateLimitConfig,
    perfConfig, outputDir, dryRun, skipIssueSync, skipHotspotSync, wait
  };

  try {
    // Step 1: Connect to SonarQube
    logger.info('=== Step 1: Connecting to SonarQube ===');
    const sqClient = new SonarQubeClient({ url: sonarqubeConfig.url, token: sonarqubeConfig.token });
    await runFatalStep(results, 'Connect to SonarQube', () => sqClient.testConnection());

    // Step 2: Extract server-wide data
    logger.info('=== Step 2: Extracting server-wide data from SonarQube ===');
    const allProjects = await extractAllProjects(sqClient, results);
    const extractedData = await extractServerWideData(sqClient, allProjects, results, perfConfig);

    // Step 3: Generate organization mappings
    logger.info('=== Step 3: Generating organization mappings ===');
    const { orgMapping, resourceMappings } = await generateOrgMappings(
      allProjects, extractedData, sonarcloudOrgs, outputDir
    );

    if (dryRun) {
      logger.info('=== Dry run complete. Mapping CSVs generated. No data migrated. ===');
      results.dryRun = true;
      return results;
    }

    // Step 4: Save server info
    await saveServerInfo(outputDir, extractedData);

    // Step 5: Migrate to each target organization
    for (const assignment of orgMapping.orgAssignments) {
      await migrateOneOrganization(assignment, extractedData, resourceMappings, results, ctx);
    }

    logMigrationSummary(results, outputDir);

  } finally {
    results.endTime = new Date().toISOString();
    try {
      await writeMigrationReport(results, outputDir);
    } catch (reportError) {
      logger.error(`Failed to write migration report: ${reportError.message}`);
    }
  }

  return results;
}

function createEmptyResults() {
  return {
    startTime: new Date().toISOString(),
    endTime: null,
    dryRun: false,
    serverSteps: [],
    orgResults: [],
    projects: [],
    qualityGates: 0,
    qualityProfiles: 0,
    groups: 0,
    portfolios: 0,
    issueSyncStats: { matched: 0, transitioned: 0 },
    hotspotSyncStats: { matched: 0, statusChanged: 0 },
    projectKeyWarnings: [],
    errors: []
  };
}

async function runFatalStep(results, stepName, fn) {
  try {
    const result = await fn();
    results.serverSteps.push({ step: stepName, status: 'success' });
    return result;
  } catch (error) {
    results.serverSteps.push({ step: stepName, status: 'failed', error: error.message });
    throw error;
  }
}

async function extractAllProjects(sqClient, results) {
  try {
    logger.info('Extracting all projects...');
    const allProjects = await sqClient.listAllProjects();
    logger.info(`Found ${allProjects.length} projects`);
    results.serverSteps.push({ step: 'Extract projects', status: 'success', detail: `${allProjects.length} found` });
    return allProjects;
  } catch (error) {
    results.serverSteps.push({ step: 'Extract projects', status: 'failed', error: error.message });
    throw error;
  }
}

async function runNonFatalExtraction(results, stepName, fn, detailFn) {
  try {
    logger.info(`Extracting ${stepName}...`);
    const data = await fn();
    const detail = detailFn ? detailFn(data) : undefined;
    results.serverSteps.push({ step: `Extract ${stepName}`, status: 'success', ...(detail && { detail }) });
    return data;
  } catch (error) {
    results.serverSteps.push({ step: `Extract ${stepName}`, status: 'failed', error: error.message });
    logger.error(`Failed to extract ${stepName}: ${error.message}`);
    return undefined;
  }
}

async function extractServerWideData(sqClient, allProjects, results, perfConfig) {
  const qualityGates = await runNonFatalExtraction(results, 'quality gates',
    () => extractQualityGates(sqClient), d => `${d.length} found`) || [];

  const qualityProfiles = await runNonFatalExtraction(results, 'quality profiles',
    () => extractQualityProfiles(sqClient), d => `${d.length} found`) || [];

  const groups = await runNonFatalExtraction(results, 'groups',
    () => extractGroups(sqClient), d => `${d.length} found`) || [];

  const globalPermissions = await runNonFatalExtraction(results, 'global permissions',
    () => extractGlobalPermissions(sqClient)) || [];

  const permissionTemplates = await runNonFatalExtraction(results, 'permission templates',
    () => extractPermissionTemplates(sqClient)) || { templates: [], defaultTemplates: [] };

  const portfolios = await runNonFatalExtraction(results, 'portfolios',
    () => extractPortfolios(sqClient), d => `${d.length} found`) || [];

  let almSettings = [];
  let projectBindings = new Map();
  const bindingsResult = await runNonFatalExtraction(results, 'DevOps bindings', async () => {
    const alm = await extractAlmSettings(sqClient);
    const bindings = await extractAllProjectBindings(sqClient, allProjects, {
      concurrency: perfConfig.maxConcurrency
    });
    return { alm, bindings };
  });
  if (bindingsResult) {
    almSettings = bindingsResult.alm;
    projectBindings = bindingsResult.bindings;
  }

  const serverInfo = await runNonFatalExtraction(results, 'server info',
    () => extractServerInfo(sqClient)) || { system: {}, plugins: [], settings: [] };

  const serverWebhooks = await runNonFatalExtraction(results, 'webhooks',
    () => extractWebhooks(sqClient)) || [];

  return {
    projects: allProjects, qualityGates, qualityProfiles, groups,
    globalPermissions, permissionTemplates, portfolios, almSettings,
    projectBindings, serverInfo, serverWebhooks
  };
}

async function generateOrgMappings(allProjects, extractedData, sonarcloudOrgs, outputDir) {
  const orgMapping = mapProjectsToOrganizations(allProjects, extractedData.projectBindings, sonarcloudOrgs);
  const resourceMappings = mapResourcesToOrganizations(extractedData, orgMapping.orgAssignments);

  await generateMappingCsvs({
    orgAssignments: orgMapping.orgAssignments,
    bindingGroups: orgMapping.bindingGroups,
    projectBindings: extractedData.projectBindings,
    projectMetadata: new Map(allProjects.map(p => [p.key, p])),
    resourceMappings
  }, outputDir);

  return { orgMapping, resourceMappings };
}

async function saveServerInfo(outputDir, extractedData) {
  logger.info('=== Step 4: Saving server info (reference) ===');
  const serverInfoDir = join(outputDir, 'server-info');
  await mkdir(serverInfoDir, { recursive: true });
  await writeFile(join(serverInfoDir, 'system.json'), JSON.stringify(extractedData.serverInfo.system, null, 2));
  await writeFile(join(serverInfoDir, 'plugins.json'), JSON.stringify(extractedData.serverInfo.plugins, null, 2));
  await writeFile(join(serverInfoDir, 'settings.json'), JSON.stringify(extractedData.serverInfo.settings, null, 2));
  await writeFile(join(serverInfoDir, 'webhooks.json'), JSON.stringify(extractedData.serverWebhooks, null, 2));
  await writeFile(join(serverInfoDir, 'alm-settings.json'), JSON.stringify(extractedData.almSettings, null, 2));
}

async function migrateOneOrganization(assignment, extractedData, resourceMappings, results, ctx) {
  const { org, projects } = assignment;
  if (projects.length === 0) {
    logger.info(`Skipping org ${org.key}: no projects assigned`);
    return;
  }

  logger.info(`\n========================================`);
  logger.info(`=== Migrating to organization: ${org.key} (${projects.length} projects) ===`);
  logger.info(`========================================`);

  const orgResult = { key: org.key, projectCount: projects.length, steps: [] };
  results.orgResults.push(orgResult);

  const scClient = new SonarCloudClient({
    url: org.url || 'https://sonarcloud.io',
    token: org.token,
    organization: org.key,
    rateLimit: ctx.rateLimitConfig
  });

  try {
    await scClient.testConnection();
    orgResult.steps.push({ step: 'Connect to SonarCloud', status: 'success' });
  } catch (error) {
    orgResult.steps.push({ step: 'Connect to SonarCloud', status: 'failed', error: error.message });
    logger.error(`Failed to connect to SonarCloud org ${org.key}: ${error.message}`);
    return;
  }

  const gateMapping = await migrateOrgWideResources(extractedData, scClient, orgResult, results);

  // Migrate each project
  const { projectKeyMap, projectKeyWarnings } = await migrateOrgProjects(
    projects, org, scClient, gateMapping, extractedData, results, ctx
  );

  results.projectKeyWarnings.push(...projectKeyWarnings);

  // Create portfolios
  await migrateOrgPortfolios(org, resourceMappings, projectKeyMap, scClient, orgResult, results);
}

async function migrateOrgWideResources(extractedData, scClient, orgResult, results) {
  // Create groups
  let gateMapping = new Map();

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

  await runOrgStep(orgResult, 'Create quality gates', async () => {
    logger.info('Creating quality gates...');
    gateMapping = await migrateQualityGates(extractedData.qualityGates, scClient);
    results.qualityGates += gateMapping.size;
    return `${gateMapping.size} created`;
  });

  await runOrgStep(orgResult, 'Restore quality profiles', async () => {
    logger.info('Restoring quality profiles...');
    const profileMapping = await migrateQualityProfiles(extractedData.qualityProfiles, scClient);
    results.qualityProfiles += profileMapping.size;
    return `${profileMapping.size} restored`;
  });

  await runOrgStep(orgResult, 'Create permission templates', async () => {
    logger.info('Creating permission templates...');
    await migratePermissionTemplates(extractedData.permissionTemplates, scClient);
  });

  return gateMapping;
}

async function runOrgStep(orgResult, stepName, fn) {
  try {
    const detail = await fn();
    orgResult.steps.push({ step: stepName, status: 'success', ...(detail && { detail }) });
  } catch (error) {
    orgResult.steps.push({ step: stepName, status: 'failed', error: error.message });
    logger.error(`Failed to ${stepName.toLowerCase()}: ${error.message}`);
  }
}

async function migrateOrgProjects(projects, org, scClient, gateMapping, extractedData, results, ctx) {
  const projectKeyMap = new Map();
  const projectKeyWarnings = [];

  for (let i = 0; i < projects.length; i++) {
    const project = projects[i];

    const { scProjectKey, warning } = await resolveProjectKey(project, org, scClient);
    if (warning) projectKeyWarnings.push(warning);
    projectKeyMap.set(project.key, scProjectKey);

    logger.info(`\n--- Project ${i + 1}/${projects.length}: ${project.key} -> ${scProjectKey} ---`);

    const projectResult = await migrateOneProject({
      project, scProjectKey, org, gateMapping, extractedData, results, ctx
    });

    results.projects.push(projectResult);
    recordProjectOutcome(project, projectResult, results);
  }

  return { projectKeyMap, projectKeyWarnings };
}

async function resolveProjectKey(project, org, scClient) {
  let scProjectKey = project.key;
  let warning = null;

  const globalCheck = await scClient.isProjectKeyTakenGlobally(project.key);
  if (globalCheck.taken && globalCheck.owner !== org.key) {
    scProjectKey = `${org.key}_${project.key}`;
    logger.warn(`Project key "${project.key}" is already taken by organization "${globalCheck.owner}" on SonarCloud. Using prefixed key "${scProjectKey}" instead.`);
    warning = { sqKey: project.key, scKey: scProjectKey, owner: globalCheck.owner };
  }

  return { scProjectKey, warning };
}

async function migrateOneProject({ project, scProjectKey, org, gateMapping, extractedData, results, ctx }) {
  const projectResult = { projectKey: project.key, scProjectKey, status: 'success', steps: [], errors: [] };

  const projectSqClient = new SonarQubeClient({
    url: ctx.sonarqubeConfig.url, token: ctx.sonarqubeConfig.token, projectKey: project.key
  });
  const projectScClient = new SonarCloudClient({
    url: org.url || 'https://sonarcloud.io', token: org.token,
    organization: org.key, projectKey: scProjectKey, rateLimit: ctx.rateLimitConfig
  });

  // i. Upload scanner report
  const reportUploadOk = await uploadScannerReport(project, scProjectKey, org, projectResult, ctx);

  // ii. Sync issues
  await syncProjectIssues(projectResult, results, reportUploadOk, ctx, scProjectKey, projectSqClient, projectScClient);

  // iii. Sync hotspots
  await syncProjectHotspots(projectResult, results, reportUploadOk, ctx, scProjectKey, projectSqClient, projectScClient);

  // iv-x. Migrate project config
  await migrateProjectConfig(project, scProjectKey, projectSqClient, projectScClient, gateMapping, extractedData, projectResult);

  // Determine overall status
  finalizeProjectResult(projectResult);

  return projectResult;
}

async function uploadScannerReport(project, scProjectKey, org, projectResult, ctx) {
  try {
    const stateFile = join(ctx.outputDir, `.state.${project.key}.json`);
    await transferProject({
      sonarqubeConfig: { url: ctx.sonarqubeConfig.url, token: ctx.sonarqubeConfig.token, projectKey: project.key },
      sonarcloudConfig: { url: org.url || 'https://sonarcloud.io', token: org.token, organization: org.key, projectKey: scProjectKey, rateLimit: ctx.rateLimitConfig },
      transferConfig: { mode: ctx.transferConfig.mode, stateFile, batchSize: ctx.transferConfig.batchSize },
      performanceConfig: ctx.perfConfig,
      wait: ctx.wait,
      skipConnectionTest: true,
      projectName: project.name
    });
    projectResult.steps.push({ step: 'Upload scanner report', status: 'success' });
    return true;
  } catch (error) {
    projectResult.steps.push({ step: 'Upload scanner report', status: 'failed', error: error.message });
    projectResult.errors.push(error.message);
    return false;
  }
}

async function syncProjectIssues(projectResult, results, reportUploadOk, ctx, scProjectKey, projectSqClient, projectScClient) {
  if (ctx.skipIssueSync) {
    projectResult.steps.push({ step: 'Sync issues', status: 'skipped', detail: 'Disabled by config' });
    return;
  }
  if (!reportUploadOk) {
    projectResult.steps.push({ step: 'Sync issues', status: 'skipped', detail: 'Report upload failed' });
    return;
  }

  try {
    logger.info('Syncing issue metadata...');
    const sqIssues = await projectSqClient.getIssuesWithComments();
    const issueStats = await syncIssues(scProjectKey, sqIssues, projectScClient, {
      concurrency: ctx.perfConfig.issueSync.concurrency
    });
    results.issueSyncStats.matched += issueStats.matched;
    results.issueSyncStats.transitioned += issueStats.transitioned;
    projectResult.steps.push({ step: 'Sync issues', status: 'success', detail: `${issueStats.matched} matched, ${issueStats.transitioned} transitioned` });
  } catch (error) {
    projectResult.steps.push({ step: 'Sync issues', status: 'failed', error: error.message });
    projectResult.errors.push(error.message);
  }
}

async function syncProjectHotspots(projectResult, results, reportUploadOk, ctx, scProjectKey, projectSqClient, projectScClient) {
  if (ctx.skipHotspotSync) {
    projectResult.steps.push({ step: 'Sync hotspots', status: 'skipped', detail: 'Disabled by config' });
    return;
  }
  if (!reportUploadOk) {
    projectResult.steps.push({ step: 'Sync hotspots', status: 'skipped', detail: 'Report upload failed' });
    return;
  }

  try {
    logger.info('Syncing hotspot metadata...');
    const sqHotspots = await extractHotspots(projectSqClient, null, {
      concurrency: ctx.perfConfig.hotspotExtraction.concurrency
    });
    const hotspotStats = await syncHotspots(scProjectKey, sqHotspots, projectScClient, {
      concurrency: ctx.perfConfig.hotspotSync.concurrency
    });
    results.hotspotSyncStats.matched += hotspotStats.matched;
    results.hotspotSyncStats.statusChanged += hotspotStats.statusChanged;
    projectResult.steps.push({ step: 'Sync hotspots', status: 'success', detail: `${hotspotStats.matched} matched, ${hotspotStats.statusChanged} status changed` });
  } catch (error) {
    projectResult.steps.push({ step: 'Sync hotspots', status: 'failed', error: error.message });
    projectResult.errors.push(error.message);
  }
}

async function runProjectStep(projectResult, stepName, fn) {
  try {
    await fn();
    projectResult.steps.push({ step: stepName, status: 'success' });
  } catch (error) {
    projectResult.steps.push({ step: stepName, status: 'failed', error: error.message });
    projectResult.errors.push(error.message);
  }
}

async function migrateProjectConfig(project, scProjectKey, projectSqClient, projectScClient, gateMapping, extractedData, projectResult) {
  await runProjectStep(projectResult, 'Project settings', async () => {
    const projectSettings = await extractProjectSettings(projectSqClient, project.key);
    await migrateProjectSettings(scProjectKey, projectSettings, projectScClient);
  });

  await runProjectStep(projectResult, 'Project tags', async () => {
    const projectTags = await extractProjectTags(projectSqClient);
    await migrateProjectTags(scProjectKey, projectTags, projectScClient);
  });

  await runProjectStep(projectResult, 'Project links', async () => {
    const projectLinks = await extractProjectLinks(projectSqClient, project.key);
    await migrateProjectLinks(scProjectKey, projectLinks, projectScClient);
  });

  await runProjectStep(projectResult, 'New code definitions', async () => {
    const newCodePeriods = await extractNewCodePeriods(projectSqClient, project.key);
    await migrateNewCodePeriods(scProjectKey, newCodePeriods, projectScClient);
  });

  await runProjectStep(projectResult, 'DevOps binding', async () => {
    const binding = extractedData.projectBindings.get(project.key);
    await migrateDevOpsBinding(scProjectKey, binding, projectScClient);
  });

  await runProjectStep(projectResult, 'Assign quality gate', async () => {
    const projectGate = await projectSqClient.getQualityGate();
    if (projectGate && gateMapping.has(projectGate.name)) {
      await assignQualityGatesToProjects(gateMapping, [{ projectKey: scProjectKey, gateName: projectGate.name }], projectScClient);
    }
  });

  await runProjectStep(projectResult, 'Project permissions', async () => {
    const projectPerms = await extractProjectPermissions(projectSqClient, project.key);
    await migrateProjectPermissions(scProjectKey, projectPerms, projectScClient);
  });
}

function finalizeProjectResult(projectResult) {
  const failedSteps = projectResult.steps.filter(s => s.status === 'failed');
  const nonSkippedSteps = projectResult.steps.filter(s => s.status !== 'skipped');

  if (failedSteps.length === 0) {
    projectResult.status = 'success';
  } else if (failedSteps.length === nonSkippedSteps.length) {
    projectResult.status = 'failed';
  } else {
    projectResult.status = 'partial';
  }
  projectResult.success = projectResult.status === 'success';
}

function recordProjectOutcome(project, projectResult, results) {
  const failedSteps = projectResult.steps.filter(s => s.status === 'failed');

  if (failedSteps.length > 0) {
    results.errors.push({
      project: project.key,
      failedSteps: failedSteps.map(s => ({ step: s.step, error: s.error }))
    });
  }

  if (projectResult.status === 'success') {
    logger.info(`Project ${project.key} migrated successfully`);
  } else if (projectResult.status === 'partial') {
    logger.warn(`Project ${project.key} partially migrated (${failedSteps.length} step(s) failed: ${failedSteps.map(s => s.step).join(', ')})`);
  } else {
    logger.error(`Project ${project.key} FAILED (${failedSteps.length} step(s) failed: ${failedSteps.map(s => s.step).join(', ')})`);
  }
}

async function migrateOrgPortfolios(org, resourceMappings, projectKeyMap, scClient, orgResult, results) {
  try {
    logger.info('Creating portfolios...');
    const portfolioMapping = await migratePortfolios(
      resourceMappings.portfoliosByOrg.get(org.key) || [],
      projectKeyMap,
      scClient
    );
    results.portfolios += portfolioMapping.size;
    orgResult.steps.push({ step: 'Create portfolios', status: 'success', detail: `${portfolioMapping.size} created` });
  } catch (error) {
    orgResult.steps.push({ step: 'Create portfolios', status: 'failed', error: error.message });
    logger.error(`Failed to create portfolios: ${error.message}`);
  }
}

function logMigrationSummary(results, outputDir) {
  const duration = ((Date.now() - new Date(results.startTime).getTime()) / 1000).toFixed(2);
  const succeeded = results.projects.filter(p => p.status === 'success').length;
  const partial = results.projects.filter(p => p.status === 'partial').length;
  const failed = results.projects.filter(p => p.status === 'failed').length;

  logger.info('\n=== Migration Summary ===');
  logger.info(`Duration: ${duration}s`);
  logger.info(`Projects: ${succeeded} succeeded, ${partial} partial, ${failed} failed, ${results.projects.length} total`);
  logger.info(`Quality Gates: ${results.qualityGates} migrated`);
  logger.info(`Quality Profiles: ${results.qualityProfiles} migrated`);
  logger.info(`Groups: ${results.groups} created`);
  logger.info(`Portfolios: ${results.portfolios} created`);
  logger.info(`Issues synced: ${results.issueSyncStats.matched} matched, ${results.issueSyncStats.transitioned} transitioned`);
  logger.info(`Hotspots synced: ${results.hotspotSyncStats.matched} matched, ${results.hotspotSyncStats.statusChanged} status changed`);
  if (results.projectKeyWarnings.length > 0) {
    logger.warn(`Project key conflicts: ${results.projectKeyWarnings.length} project(s) could not use the original SonarQube key on SonarCloud`);
    for (const w of results.projectKeyWarnings) {
      logger.warn(`  "${w.sqKey}" -> "${w.scKey}" (key taken by org "${w.owner}")`);
    }
  }
  logger.info(`Output: ${outputDir}`);
  logger.info('========================');
}

// ============================================================
// Migration Report Generation
// ============================================================

/**
 * Write migration report files (JSON for programmatic use + TXT for humans)
 */
async function writeMigrationReport(results, outputDir) {
  await mkdir(outputDir, { recursive: true });

  const jsonPath = join(outputDir, 'migration-report.json');
  await writeFile(jsonPath, JSON.stringify(results, null, 2));

  const txtPath = join(outputDir, 'migration-report.txt');
  await writeFile(txtPath, formatTextReport(results));

  logger.info(`Migration report saved to: ${txtPath}`);
}

/**
 * Format results as a human-readable text report
 */
function formatTextReport(results) {
  const lines = [];
  const sep = '='.repeat(70);
  const subsep = '-'.repeat(70);

  formatReportHeader(lines, results, sep);
  formatReportSummary(lines, results, subsep);
  formatKeyConflicts(lines, results, subsep);
  formatServerSteps(lines, results, subsep);
  formatOrgResults(lines, results, subsep);
  formatProblemProjects(lines, results, subsep);
  formatAllProjects(lines, results, subsep);

  lines.push(sep);
  return lines.join('\n');
}

function formatReportHeader(lines, results, sep) {
  lines.push(sep, 'CLOUDVOYAGER MIGRATION REPORT', sep, '',
    `Started:  ${results.startTime}`, `Finished: ${results.endTime || 'In progress'}`);
  if (results.startTime && results.endTime) {
    const durationMs = new Date(results.endTime) - new Date(results.startTime);
    lines.push(`Duration: ${formatDuration(durationMs)}`);
  }
  if (results.dryRun) {
    lines.push('Mode:     DRY RUN (no data migrated)');
  }
  lines.push('');
}

function formatReportSummary(lines, results, subsep) {
  const succeeded = results.projects.filter(p => p.status === 'success').length;
  const partial = results.projects.filter(p => p.status === 'partial').length;
  const failed = results.projects.filter(p => p.status === 'failed').length;

  lines.push('SUMMARY', subsep);
  if (results.projects.length > 0) {
    lines.push(`  Projects:         ${succeeded} succeeded, ${partial} partial, ${failed} failed (${results.projects.length} total)`);
  } else {
    lines.push('  Projects:         0 (no projects migrated)');
  }
  lines.push(
    `  Quality Gates:    ${results.qualityGates} migrated`,
    `  Quality Profiles: ${results.qualityProfiles} migrated`,
    `  Groups:           ${results.groups} created`,
    `  Portfolios:       ${results.portfolios} created`,
    `  Issues:           ${results.issueSyncStats.matched} matched, ${results.issueSyncStats.transitioned} transitioned`,
    `  Hotspots:         ${results.hotspotSyncStats.matched} matched, ${results.hotspotSyncStats.statusChanged} status changed`,
    '',
  );
}

function formatKeyConflicts(lines, results, subsep) {
  const keyWarnings = results.projectKeyWarnings || [];
  if (keyWarnings.length === 0) return;

  lines.push(
    'PROJECT KEY CONFLICTS',
    subsep,
    `  ${keyWarnings.length} project(s) could not use the original SonarQube key because`,
    '  the key is already taken by another organization on SonarCloud.',
    '  The migration tool uses the original SonarQube project key by default.',
    '  When a conflict is detected, it falls back to a prefixed key ({org}_{key}).',
    '',
  );
  for (const w of keyWarnings) {
    lines.push(`  [WARN] "${w.sqKey}" -> "${w.scKey}" (taken by org "${w.owner}")`);
  }
  lines.push('');
}

function formatStepLine(lines, step) {
  const icon = step.status === 'success' ? 'OK  ' : 'FAIL';
  const detail = step.detail ? ` (${step.detail})` : '';
  lines.push(`  [${icon}] ${step.step}${detail}`);
  if (step.error) {
    lines.push(`         ${step.error}`);
  }
}

function formatServerSteps(lines, results, subsep) {
  if (results.serverSteps.length === 0) return;

  lines.push('SERVER-WIDE STEPS', subsep);
  for (const step of results.serverSteps) {
    formatStepLine(lines, step);
  }
  lines.push('');
}

function formatOrgResults(lines, results, subsep) {
  for (const org of (results.orgResults || [])) {
    lines.push(`ORGANIZATION: ${org.key} (${org.projectCount} projects)`, subsep);
    for (const step of (org.steps || [])) {
      formatStepLine(lines, step);
    }
    lines.push('');
  }
}

function formatProblemProjects(lines, results, subsep) {
  const problemProjects = results.projects.filter(p => p.status !== 'success');
  if (problemProjects.length === 0) return;

  lines.push('FAILED / PARTIAL PROJECTS (DETAILED)', subsep);
  for (const project of problemProjects) {
    formatProblemProjectDetail(lines, project);
  }
}

function formatProblemProjectDetail(lines, project) {
  const statusLabel = project.status === 'failed' ? 'FAIL   ' : 'PARTIAL';
  lines.push(`  [${statusLabel}] ${project.projectKey} -> ${project.scProjectKey}`);
  for (const step of project.steps) {
    if (step.status === 'success') {
      lines.push(`    [OK  ] ${step.step}`);
    } else if (step.status === 'failed') {
      lines.push(`    [FAIL] ${step.step}`, `           ${step.error}`);
    } else if (step.status === 'skipped') {
      lines.push(`    [SKIP] ${step.step} -- ${step.detail || ''}`);
    }
  }
  lines.push('');
}

function formatAllProjects(lines, results, subsep) {
  if (results.projects.length === 0) return;

  lines.push('ALL PROJECTS', subsep);
  for (const project of results.projects) {
    formatProjectSummaryLine(lines, project);
  }
  lines.push('');
}

function getProjectStatusIcon(status) {
  if (status === 'success') return 'OK     ';
  if (status === 'partial') return 'PARTIAL';
  return 'FAIL   ';
}

function formatProjectSummaryLine(lines, project) {
  const failedSteps = project.steps.filter(s => s.status === 'failed');
  const icon = getProjectStatusIcon(project.status);
  const detail = failedSteps.length > 0
    ? ` (failed: ${failedSteps.map(s => s.step).join(', ')})`
    : '';
  lines.push(`  [${icon}] ${project.projectKey}${detail}`);
}

/**
 * Format milliseconds as human-readable duration
 */
function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}
