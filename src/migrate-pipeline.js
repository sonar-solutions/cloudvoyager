import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
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
import logger from './utils/logger.js';

/**
 * Execute the full multi-organization migration pipeline
 *
 * @param {object} options
 * @param {object} options.sonarqubeConfig - { url, token }
 * @param {Array} options.sonarcloudOrgs - Array of { key, token, url }
 * @param {object} options.migrateConfig - { outputDir, skipIssueSync, skipHotspotSync, dryRun }
 * @param {object} options.transferConfig - { mode, stateFile, batchSize }
 * @param {boolean} [options.wait=true] - Whether to wait for analysis completion
 * @returns {Promise<object>} Migration results
 */
export async function migrateAll(options) {
  const {
    sonarqubeConfig,
    sonarcloudOrgs,
    migrateConfig = {},
    transferConfig = { mode: 'full', batchSize: 100 },
    rateLimitConfig,
    wait = true
  } = options;

  const outputDir = migrateConfig.outputDir || './migration-output';
  const dryRun = migrateConfig.dryRun || false;
  const skipIssueSync = migrateConfig.skipIssueSync || false;
  const skipHotspotSync = migrateConfig.skipHotspotSync || false;

  const startTime = Date.now();
  const results = {
    projects: [],
    qualityGates: 0,
    qualityProfiles: 0,
    groups: 0,
    portfolios: 0,
    issueSyncStats: { matched: 0, transitioned: 0 },
    hotspotSyncStats: { matched: 0, statusChanged: 0 },
    errors: []
  };

  // ========================================
  // Step 1: Connect to SonarQube
  // ========================================
  logger.info('=== Step 1: Connecting to SonarQube ===');
  const sqClient = new SonarQubeClient({ url: sonarqubeConfig.url, token: sonarqubeConfig.token });
  await sqClient.testConnection();

  // ========================================
  // Step 2: Extract ALL server-wide data
  // ========================================
  logger.info('=== Step 2: Extracting server-wide data from SonarQube ===');

  // 2a: All projects
  logger.info('Extracting all projects...');
  const allProjects = await sqClient.listAllProjects();
  logger.info(`Found ${allProjects.length} projects`);

  // 2b: Quality gates
  logger.info('Extracting quality gates...');
  const qualityGates = await extractQualityGates(sqClient);

  // 2c: Quality profiles
  logger.info('Extracting quality profiles...');
  const qualityProfiles = await extractQualityProfiles(sqClient);

  // 2d: Groups
  logger.info('Extracting groups...');
  const groups = await extractGroups(sqClient);

  // 2e: Global permissions
  logger.info('Extracting global permissions...');
  const globalPermissions = await extractGlobalPermissions(sqClient);

  // 2f: Permission templates
  logger.info('Extracting permission templates...');
  const permissionTemplates = await extractPermissionTemplates(sqClient);

  // 2g: Portfolios
  logger.info('Extracting portfolios...');
  const portfolios = await extractPortfolios(sqClient);

  // 2h: ALM/DevOps settings and project bindings
  logger.info('Extracting DevOps bindings...');
  const almSettings = await extractAlmSettings(sqClient);
  const projectBindings = await extractAllProjectBindings(sqClient, allProjects);

  // 2i: Server info (for documentation)
  logger.info('Extracting server info...');
  const serverInfo = await extractServerInfo(sqClient);

  // 2j: Server-level webhooks
  logger.info('Extracting server webhooks...');
  const serverWebhooks = await extractWebhooks(sqClient);

  const extractedData = {
    projects: allProjects,
    qualityGates,
    qualityProfiles,
    groups,
    globalPermissions,
    permissionTemplates,
    portfolios,
    almSettings,
    projectBindings,
    serverInfo,
    serverWebhooks
  };

  // ========================================
  // Step 3: Generate organization mappings
  // ========================================
  logger.info('=== Step 3: Generating organization mappings ===');

  const orgMapping = mapProjectsToOrganizations(allProjects, projectBindings, sonarcloudOrgs);
  const resourceMappings = mapResourcesToOrganizations(extractedData, orgMapping.orgAssignments);

  // Generate CSV files
  await generateMappingCsvs({
    orgAssignments: orgMapping.orgAssignments,
    bindingGroups: orgMapping.bindingGroups,
    projectBindings,
    projectMetadata: new Map(allProjects.map(p => [p.key, p])),
    resourceMappings
  }, outputDir);

  if (dryRun) {
    logger.info('=== Dry run complete. Mapping CSVs generated. No data migrated. ===');
    return { ...results, dryRun: true };
  }

  // ========================================
  // Step 4: Save server info (reference only)
  // ========================================
  logger.info('=== Step 4: Saving server info (reference) ===');
  const serverInfoDir = join(outputDir, 'server-info');
  await mkdir(serverInfoDir, { recursive: true });
  await writeFile(join(serverInfoDir, 'system.json'), JSON.stringify(serverInfo.system, null, 2));
  await writeFile(join(serverInfoDir, 'plugins.json'), JSON.stringify(serverInfo.plugins, null, 2));
  await writeFile(join(serverInfoDir, 'settings.json'), JSON.stringify(serverInfo.settings, null, 2));
  await writeFile(join(serverInfoDir, 'webhooks.json'), JSON.stringify(serverWebhooks, null, 2));
  await writeFile(join(serverInfoDir, 'alm-settings.json'), JSON.stringify(almSettings, null, 2));

  // ========================================
  // Step 5: Migrate to each target organization
  // ========================================
  for (const assignment of orgMapping.orgAssignments) {
    const { org, projects } = assignment;
    if (projects.length === 0) {
      logger.info(`Skipping org ${org.key}: no projects assigned`);
      continue;
    }

    logger.info(`\n========================================`);
    logger.info(`=== Migrating to organization: ${org.key} (${projects.length} projects) ===`);
    logger.info(`========================================`);

    const scClient = new SonarCloudClient({
      url: org.url || 'https://sonarcloud.io',
      token: org.token,
      organization: org.key,
      rateLimit: rateLimitConfig
    });

    await scClient.testConnection();

    // 5a: Create groups
    logger.info('Creating groups...');
    const groupMapping = await migrateGroups(groups, scClient);
    results.groups += groupMapping.size;

    // 5b: Set global permissions
    logger.info('Setting global permissions...');
    await migrateGlobalPermissions(globalPermissions, scClient);

    // 5c: Create quality gates
    logger.info('Creating quality gates...');
    const gateMapping = await migrateQualityGates(qualityGates, scClient);
    results.qualityGates += gateMapping.size;

    // 5d: Restore quality profiles
    logger.info('Restoring quality profiles...');
    const profileMapping = await migrateQualityProfiles(qualityProfiles, scClient);
    results.qualityProfiles += profileMapping.size;

    // 5e: Create permission templates
    logger.info('Creating permission templates...');
    await migratePermissionTemplates(permissionTemplates, scClient);

    // 5f: Migrate each project
    const projectKeyMap = new Map();
    for (let i = 0; i < projects.length; i++) {
      const project = projects[i];
      const scProjectKey = `${org.key}_${project.key}`;
      projectKeyMap.set(project.key, scProjectKey);

      logger.info(`\n--- Project ${i + 1}/${projects.length}: ${project.key} -> ${scProjectKey} ---`);

      try {
        // Create per-project SQ client
        const projectSqClient = new SonarQubeClient({
          url: sonarqubeConfig.url,
          token: sonarqubeConfig.token,
          projectKey: project.key
        });

        // Create per-project SC client
        const projectScClient = new SonarCloudClient({
          url: org.url || 'https://sonarcloud.io',
          token: org.token,
          organization: org.key,
          projectKey: scProjectKey,
          rateLimit: rateLimitConfig
        });

        // i. Upload scanner report (existing pipeline)
        const stateFile = join(outputDir, `.state.${project.key}.json`);
        await transferProject({
          sonarqubeConfig: { url: sonarqubeConfig.url, token: sonarqubeConfig.token, projectKey: project.key },
          sonarcloudConfig: { url: org.url || 'https://sonarcloud.io', token: org.token, organization: org.key, projectKey: scProjectKey, rateLimit: rateLimitConfig },
          transferConfig: { mode: transferConfig.mode, stateFile, batchSize: transferConfig.batchSize },
          wait,
          skipConnectionTest: true
        });

        // ii. Sync issue statuses, assignments, comments, tags
        if (!skipIssueSync) {
          logger.info('Syncing issue metadata...');
          const sqIssues = await projectSqClient.getIssuesWithComments();
          const issueStats = await syncIssues(scProjectKey, sqIssues, projectScClient);
          results.issueSyncStats.matched += issueStats.matched;
          results.issueSyncStats.transitioned += issueStats.transitioned;
        }

        // iii. Sync hotspot statuses, assignments, comments
        if (!skipHotspotSync) {
          logger.info('Syncing hotspot metadata...');
          const sqHotspots = await extractHotspots(projectSqClient);
          const hotspotStats = await syncHotspots(scProjectKey, sqHotspots, projectScClient);
          results.hotspotSyncStats.matched += hotspotStats.matched;
          results.hotspotSyncStats.statusChanged += hotspotStats.statusChanged;
        }

        // iv. Set project settings
        const projectSettings = await extractProjectSettings(projectSqClient, project.key);
        await migrateProjectSettings(scProjectKey, projectSettings, projectScClient);

        // v. Set project tags
        const projectTags = await extractProjectTags(projectSqClient);
        await migrateProjectTags(scProjectKey, projectTags, projectScClient);

        // vi. Create project links
        const projectLinks = await extractProjectLinks(projectSqClient, project.key);
        await migrateProjectLinks(scProjectKey, projectLinks, projectScClient);

        // vii. Set new code definitions
        const newCodePeriods = await extractNewCodePeriods(projectSqClient, project.key);
        await migrateNewCodePeriods(scProjectKey, newCodePeriods, projectScClient);

        // viii. Set DevOps binding
        const binding = projectBindings.get(project.key);
        await migrateDevOpsBinding(scProjectKey, binding, projectScClient);

        // ix. Assign quality gate
        const projectGate = await projectSqClient.getQualityGate();
        if (projectGate && gateMapping.has(projectGate.name)) {
          await assignQualityGatesToProjects(gateMapping, [{ projectKey: scProjectKey, gateName: projectGate.name }], projectScClient);
        }

        // x. Set project-level permissions
        const projectPerms = await extractProjectPermissions(projectSqClient, project.key);
        await migrateProjectPermissions(scProjectKey, projectPerms, projectScClient);

        results.projects.push({ projectKey: project.key, scProjectKey, success: true });
        logger.info(`Project ${project.key} migrated successfully`);
      } catch (error) {
        logger.error(`Project ${project.key} FAILED: ${error.message}`);
        results.projects.push({ projectKey: project.key, scProjectKey, success: false, error: error.message });
        results.errors.push({ project: project.key, error: error.message });
      }
    }

    // 5g: Create portfolios and assign projects
    logger.info('Creating portfolios...');
    const portfolioMapping = await migratePortfolios(
      resourceMappings.portfoliosByOrg.get(org.key) || [],
      projectKeyMap,
      scClient
    );
    results.portfolios += portfolioMapping.size;
  }

  // ========================================
  // Summary
  // ========================================
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  const succeeded = results.projects.filter(p => p.success).length;
  const failed = results.projects.filter(p => !p.success).length;

  logger.info('\n=== Migration Summary ===');
  logger.info(`Duration: ${duration}s`);
  logger.info(`Projects: ${succeeded} succeeded, ${failed} failed, ${results.projects.length} total`);
  logger.info(`Quality Gates: ${results.qualityGates} migrated`);
  logger.info(`Quality Profiles: ${results.qualityProfiles} migrated`);
  logger.info(`Groups: ${results.groups} created`);
  logger.info(`Portfolios: ${results.portfolios} created`);
  logger.info(`Issues synced: ${results.issueSyncStats.matched} matched, ${results.issueSyncStats.transitioned} transitioned`);
  logger.info(`Hotspots synced: ${results.hotspotSyncStats.matched} matched, ${results.hotspotSyncStats.statusChanged} status changed`);
  logger.info(`Output: ${outputDir}`);
  logger.info('========================');

  return results;
}
