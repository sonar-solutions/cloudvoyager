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

  const results = {
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
    errors: []
  };

  try {
    // ========================================
    // Step 1: Connect to SonarQube
    // ========================================
    logger.info('=== Step 1: Connecting to SonarQube ===');
    const sqClient = new SonarQubeClient({ url: sonarqubeConfig.url, token: sonarqubeConfig.token });

    try {
      await sqClient.testConnection();
      results.serverSteps.push({ step: 'Connect to SonarQube', status: 'success' });
    } catch (error) {
      results.serverSteps.push({ step: 'Connect to SonarQube', status: 'failed', error: error.message });
      throw error;
    }

    // ========================================
    // Step 2: Extract ALL server-wide data
    // ========================================
    logger.info('=== Step 2: Extracting server-wide data from SonarQube ===');

    // 2a: All projects (FATAL — can't continue without projects)
    let allProjects;
    try {
      logger.info('Extracting all projects...');
      allProjects = await sqClient.listAllProjects();
      logger.info(`Found ${allProjects.length} projects`);
      results.serverSteps.push({ step: 'Extract projects', status: 'success', detail: `${allProjects.length} found` });
    } catch (error) {
      results.serverSteps.push({ step: 'Extract projects', status: 'failed', error: error.message });
      throw error;
    }

    // Remaining extractions are non-fatal — continue with defaults if one fails
    let qualityGates = [];
    let qualityProfiles = [];
    let groups = [];
    let globalPermissions = [];
    let permissionTemplates = { templates: [], defaultTemplates: [] };
    let portfolios = [];
    let almSettings = [];
    let projectBindings = new Map();
    let serverInfo = { system: {}, plugins: [], settings: [] };
    let serverWebhooks = [];

    try {
      logger.info('Extracting quality gates...');
      qualityGates = await extractQualityGates(sqClient);
      results.serverSteps.push({ step: 'Extract quality gates', status: 'success', detail: `${qualityGates.length} found` });
    } catch (error) {
      results.serverSteps.push({ step: 'Extract quality gates', status: 'failed', error: error.message });
      logger.error(`Failed to extract quality gates: ${error.message}`);
    }

    try {
      logger.info('Extracting quality profiles...');
      qualityProfiles = await extractQualityProfiles(sqClient);
      results.serverSteps.push({ step: 'Extract quality profiles', status: 'success', detail: `${qualityProfiles.length} found` });
    } catch (error) {
      results.serverSteps.push({ step: 'Extract quality profiles', status: 'failed', error: error.message });
      logger.error(`Failed to extract quality profiles: ${error.message}`);
    }

    try {
      logger.info('Extracting groups...');
      groups = await extractGroups(sqClient);
      results.serverSteps.push({ step: 'Extract groups', status: 'success', detail: `${groups.length} found` });
    } catch (error) {
      results.serverSteps.push({ step: 'Extract groups', status: 'failed', error: error.message });
      logger.error(`Failed to extract groups: ${error.message}`);
    }

    try {
      logger.info('Extracting global permissions...');
      globalPermissions = await extractGlobalPermissions(sqClient);
      results.serverSteps.push({ step: 'Extract global permissions', status: 'success' });
    } catch (error) {
      results.serverSteps.push({ step: 'Extract global permissions', status: 'failed', error: error.message });
      logger.error(`Failed to extract global permissions: ${error.message}`);
    }

    try {
      logger.info('Extracting permission templates...');
      permissionTemplates = await extractPermissionTemplates(sqClient);
      results.serverSteps.push({ step: 'Extract permission templates', status: 'success' });
    } catch (error) {
      results.serverSteps.push({ step: 'Extract permission templates', status: 'failed', error: error.message });
      logger.error(`Failed to extract permission templates: ${error.message}`);
    }

    try {
      logger.info('Extracting portfolios...');
      portfolios = await extractPortfolios(sqClient);
      results.serverSteps.push({ step: 'Extract portfolios', status: 'success', detail: `${portfolios.length} found` });
    } catch (error) {
      results.serverSteps.push({ step: 'Extract portfolios', status: 'failed', error: error.message });
      logger.error(`Failed to extract portfolios: ${error.message}`);
    }

    try {
      logger.info('Extracting DevOps bindings...');
      almSettings = await extractAlmSettings(sqClient);
      projectBindings = await extractAllProjectBindings(sqClient, allProjects);
      results.serverSteps.push({ step: 'Extract DevOps bindings', status: 'success' });
    } catch (error) {
      results.serverSteps.push({ step: 'Extract DevOps bindings', status: 'failed', error: error.message });
      logger.error(`Failed to extract DevOps bindings: ${error.message}`);
    }

    try {
      logger.info('Extracting server info...');
      serverInfo = await extractServerInfo(sqClient);
      results.serverSteps.push({ step: 'Extract server info', status: 'success' });
    } catch (error) {
      results.serverSteps.push({ step: 'Extract server info', status: 'failed', error: error.message });
      logger.error(`Failed to extract server info: ${error.message}`);
    }

    try {
      logger.info('Extracting server webhooks...');
      serverWebhooks = await extractWebhooks(sqClient);
      results.serverSteps.push({ step: 'Extract webhooks', status: 'success' });
    } catch (error) {
      results.serverSteps.push({ step: 'Extract webhooks', status: 'failed', error: error.message });
      logger.error(`Failed to extract webhooks: ${error.message}`);
    }

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
      results.dryRun = true;
      return results;
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

      const orgResult = {
        key: org.key,
        projectCount: projects.length,
        steps: []
      };
      results.orgResults.push(orgResult);

      const scClient = new SonarCloudClient({
        url: org.url || 'https://sonarcloud.io',
        token: org.token,
        organization: org.key,
        rateLimit: rateLimitConfig
      });

      try {
        await scClient.testConnection();
        orgResult.steps.push({ step: 'Connect to SonarCloud', status: 'success' });
      } catch (error) {
        orgResult.steps.push({ step: 'Connect to SonarCloud', status: 'failed', error: error.message });
        logger.error(`Failed to connect to SonarCloud org ${org.key}: ${error.message}`);
        continue; // Skip this entire org
      }

      // 5a: Create groups
      let groupMapping = new Map();
      try {
        logger.info('Creating groups...');
        groupMapping = await migrateGroups(groups, scClient);
        results.groups += groupMapping.size;
        orgResult.steps.push({ step: 'Create groups', status: 'success', detail: `${groupMapping.size} created` });
      } catch (error) {
        orgResult.steps.push({ step: 'Create groups', status: 'failed', error: error.message });
        logger.error(`Failed to create groups: ${error.message}`);
      }

      // 5b: Set global permissions
      try {
        logger.info('Setting global permissions...');
        await migrateGlobalPermissions(globalPermissions, scClient);
        orgResult.steps.push({ step: 'Set global permissions', status: 'success' });
      } catch (error) {
        orgResult.steps.push({ step: 'Set global permissions', status: 'failed', error: error.message });
        logger.error(`Failed to set global permissions: ${error.message}`);
      }

      // 5c: Create quality gates
      let gateMapping = new Map();
      try {
        logger.info('Creating quality gates...');
        gateMapping = await migrateQualityGates(qualityGates, scClient);
        results.qualityGates += gateMapping.size;
        orgResult.steps.push({ step: 'Create quality gates', status: 'success', detail: `${gateMapping.size} created` });
      } catch (error) {
        orgResult.steps.push({ step: 'Create quality gates', status: 'failed', error: error.message });
        logger.error(`Failed to create quality gates: ${error.message}`);
      }

      // 5d: Restore quality profiles
      let profileMapping = new Map();
      try {
        logger.info('Restoring quality profiles...');
        profileMapping = await migrateQualityProfiles(qualityProfiles, scClient);
        results.qualityProfiles += profileMapping.size;
        orgResult.steps.push({ step: 'Restore quality profiles', status: 'success', detail: `${profileMapping.size} restored` });
      } catch (error) {
        orgResult.steps.push({ step: 'Restore quality profiles', status: 'failed', error: error.message });
        logger.error(`Failed to restore quality profiles: ${error.message}`);
      }

      // 5e: Create permission templates
      try {
        logger.info('Creating permission templates...');
        await migratePermissionTemplates(permissionTemplates, scClient);
        orgResult.steps.push({ step: 'Create permission templates', status: 'success' });
      } catch (error) {
        orgResult.steps.push({ step: 'Create permission templates', status: 'failed', error: error.message });
        logger.error(`Failed to create permission templates: ${error.message}`);
      }

      // 5f: Migrate each project
      const projectKeyMap = new Map();
      for (let i = 0; i < projects.length; i++) {
        const project = projects[i];
        const scProjectKey = `${org.key}_${project.key}`;
        projectKeyMap.set(project.key, scProjectKey);

        logger.info(`\n--- Project ${i + 1}/${projects.length}: ${project.key} -> ${scProjectKey} ---`);

        const projectResult = {
          projectKey: project.key,
          scProjectKey,
          status: 'success',
          steps: [],
          errors: []
        };

        // Create per-project clients
        const projectSqClient = new SonarQubeClient({
          url: sonarqubeConfig.url,
          token: sonarqubeConfig.token,
          projectKey: project.key
        });

        const projectScClient = new SonarCloudClient({
          url: org.url || 'https://sonarcloud.io',
          token: org.token,
          organization: org.key,
          projectKey: scProjectKey,
          rateLimit: rateLimitConfig
        });

        // i. Upload scanner report
        let reportUploadOk = false;
        try {
          const stateFile = join(outputDir, `.state.${project.key}.json`);
          await transferProject({
            sonarqubeConfig: { url: sonarqubeConfig.url, token: sonarqubeConfig.token, projectKey: project.key },
            sonarcloudConfig: { url: org.url || 'https://sonarcloud.io', token: org.token, organization: org.key, projectKey: scProjectKey, rateLimit: rateLimitConfig },
            transferConfig: { mode: transferConfig.mode, stateFile, batchSize: transferConfig.batchSize },
            wait,
            skipConnectionTest: true
          });
          projectResult.steps.push({ step: 'Upload scanner report', status: 'success' });
          reportUploadOk = true;
        } catch (error) {
          projectResult.steps.push({ step: 'Upload scanner report', status: 'failed', error: error.message });
          projectResult.errors.push(error.message);
        }

        // ii. Sync issue statuses, assignments, comments, tags
        if (!skipIssueSync) {
          if (!reportUploadOk) {
            projectResult.steps.push({ step: 'Sync issues', status: 'skipped', detail: 'Report upload failed' });
          } else {
            try {
              logger.info('Syncing issue metadata...');
              const sqIssues = await projectSqClient.getIssuesWithComments();
              const issueStats = await syncIssues(scProjectKey, sqIssues, projectScClient);
              results.issueSyncStats.matched += issueStats.matched;
              results.issueSyncStats.transitioned += issueStats.transitioned;
              projectResult.steps.push({ step: 'Sync issues', status: 'success', detail: `${issueStats.matched} matched, ${issueStats.transitioned} transitioned` });
            } catch (error) {
              projectResult.steps.push({ step: 'Sync issues', status: 'failed', error: error.message });
              projectResult.errors.push(error.message);
            }
          }
        } else {
          projectResult.steps.push({ step: 'Sync issues', status: 'skipped', detail: 'Disabled by config' });
        }

        // iii. Sync hotspot statuses, assignments, comments
        if (!skipHotspotSync) {
          if (!reportUploadOk) {
            projectResult.steps.push({ step: 'Sync hotspots', status: 'skipped', detail: 'Report upload failed' });
          } else {
            try {
              logger.info('Syncing hotspot metadata...');
              const sqHotspots = await extractHotspots(projectSqClient);
              const hotspotStats = await syncHotspots(scProjectKey, sqHotspots, projectScClient);
              results.hotspotSyncStats.matched += hotspotStats.matched;
              results.hotspotSyncStats.statusChanged += hotspotStats.statusChanged;
              projectResult.steps.push({ step: 'Sync hotspots', status: 'success', detail: `${hotspotStats.matched} matched, ${hotspotStats.statusChanged} status changed` });
            } catch (error) {
              projectResult.steps.push({ step: 'Sync hotspots', status: 'failed', error: error.message });
              projectResult.errors.push(error.message);
            }
          }
        } else {
          projectResult.steps.push({ step: 'Sync hotspots', status: 'skipped', detail: 'Disabled by config' });
        }

        // iv. Set project settings
        try {
          const projectSettings = await extractProjectSettings(projectSqClient, project.key);
          await migrateProjectSettings(scProjectKey, projectSettings, projectScClient);
          projectResult.steps.push({ step: 'Project settings', status: 'success' });
        } catch (error) {
          projectResult.steps.push({ step: 'Project settings', status: 'failed', error: error.message });
          projectResult.errors.push(error.message);
        }

        // v. Set project tags
        try {
          const projectTags = await extractProjectTags(projectSqClient);
          await migrateProjectTags(scProjectKey, projectTags, projectScClient);
          projectResult.steps.push({ step: 'Project tags', status: 'success' });
        } catch (error) {
          projectResult.steps.push({ step: 'Project tags', status: 'failed', error: error.message });
          projectResult.errors.push(error.message);
        }

        // vi. Create project links
        try {
          const projectLinks = await extractProjectLinks(projectSqClient, project.key);
          await migrateProjectLinks(scProjectKey, projectLinks, projectScClient);
          projectResult.steps.push({ step: 'Project links', status: 'success' });
        } catch (error) {
          projectResult.steps.push({ step: 'Project links', status: 'failed', error: error.message });
          projectResult.errors.push(error.message);
        }

        // vii. Set new code definitions
        try {
          const newCodePeriods = await extractNewCodePeriods(projectSqClient, project.key);
          await migrateNewCodePeriods(scProjectKey, newCodePeriods, projectScClient);
          projectResult.steps.push({ step: 'New code definitions', status: 'success' });
        } catch (error) {
          projectResult.steps.push({ step: 'New code definitions', status: 'failed', error: error.message });
          projectResult.errors.push(error.message);
        }

        // viii. Set DevOps binding
        try {
          const binding = projectBindings.get(project.key);
          await migrateDevOpsBinding(scProjectKey, binding, projectScClient);
          projectResult.steps.push({ step: 'DevOps binding', status: 'success' });
        } catch (error) {
          projectResult.steps.push({ step: 'DevOps binding', status: 'failed', error: error.message });
          projectResult.errors.push(error.message);
        }

        // ix. Assign quality gate
        try {
          const projectGate = await projectSqClient.getQualityGate();
          if (projectGate && gateMapping.has(projectGate.name)) {
            await assignQualityGatesToProjects(gateMapping, [{ projectKey: scProjectKey, gateName: projectGate.name }], projectScClient);
          }
          projectResult.steps.push({ step: 'Assign quality gate', status: 'success' });
        } catch (error) {
          projectResult.steps.push({ step: 'Assign quality gate', status: 'failed', error: error.message });
          projectResult.errors.push(error.message);
        }

        // x. Set project-level permissions
        try {
          const projectPerms = await extractProjectPermissions(projectSqClient, project.key);
          await migrateProjectPermissions(scProjectKey, projectPerms, projectScClient);
          projectResult.steps.push({ step: 'Project permissions', status: 'success' });
        } catch (error) {
          projectResult.steps.push({ step: 'Project permissions', status: 'failed', error: error.message });
          projectResult.errors.push(error.message);
        }

        // Determine overall project status
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

        results.projects.push(projectResult);

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

      // 5g: Create portfolios and assign projects
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

    // ========================================
    // Summary
    // ========================================
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
    logger.info(`Output: ${outputDir}`);
    logger.info('========================');

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

  lines.push(sep);
  lines.push('CLOUDVOYAGER MIGRATION REPORT');
  lines.push(sep);
  lines.push('');
  lines.push(`Started:  ${results.startTime}`);
  lines.push(`Finished: ${results.endTime || 'In progress'}`);
  if (results.startTime && results.endTime) {
    const durationMs = new Date(results.endTime) - new Date(results.startTime);
    lines.push(`Duration: ${formatDuration(durationMs)}`);
  }
  if (results.dryRun) {
    lines.push('Mode:     DRY RUN (no data migrated)');
  }
  lines.push('');

  // Summary
  const succeeded = results.projects.filter(p => p.status === 'success').length;
  const partial = results.projects.filter(p => p.status === 'partial').length;
  const failed = results.projects.filter(p => p.status === 'failed').length;

  lines.push('SUMMARY');
  lines.push(subsep);
  if (results.projects.length > 0) {
    lines.push(`  Projects:         ${succeeded} succeeded, ${partial} partial, ${failed} failed (${results.projects.length} total)`);
  } else {
    lines.push('  Projects:         0 (no projects migrated)');
  }
  lines.push(`  Quality Gates:    ${results.qualityGates} migrated`);
  lines.push(`  Quality Profiles: ${results.qualityProfiles} migrated`);
  lines.push(`  Groups:           ${results.groups} created`);
  lines.push(`  Portfolios:       ${results.portfolios} created`);
  lines.push(`  Issues:           ${results.issueSyncStats.matched} matched, ${results.issueSyncStats.transitioned} transitioned`);
  lines.push(`  Hotspots:         ${results.hotspotSyncStats.matched} matched, ${results.hotspotSyncStats.statusChanged} status changed`);
  lines.push('');

  // Server-wide steps
  if (results.serverSteps.length > 0) {
    lines.push('SERVER-WIDE STEPS');
    lines.push(subsep);
    for (const step of results.serverSteps) {
      const icon = step.status === 'success' ? 'OK  ' : 'FAIL';
      const detail = step.detail ? ` (${step.detail})` : '';
      lines.push(`  [${icon}] ${step.step}${detail}`);
      if (step.error) {
        lines.push(`         ${step.error}`);
      }
    }
    lines.push('');
  }

  // Per-org results
  for (const org of (results.orgResults || [])) {
    lines.push(`ORGANIZATION: ${org.key} (${org.projectCount} projects)`);
    lines.push(subsep);
    for (const step of (org.steps || [])) {
      const icon = step.status === 'success' ? 'OK  ' : 'FAIL';
      const detail = step.detail ? ` (${step.detail})` : '';
      lines.push(`  [${icon}] ${step.step}${detail}`);
      if (step.error) {
        lines.push(`         ${step.error}`);
      }
    }
    lines.push('');
  }

  // Failed/partial projects — detailed step-by-step view
  const problemProjects = results.projects.filter(p => p.status !== 'success');
  if (problemProjects.length > 0) {
    lines.push('FAILED / PARTIAL PROJECTS (DETAILED)');
    lines.push(subsep);
    for (const project of problemProjects) {
      const statusLabel = project.status === 'failed' ? 'FAIL   ' : 'PARTIAL';
      lines.push(`  [${statusLabel}] ${project.projectKey} -> ${project.scProjectKey}`);
      for (const step of project.steps) {
        if (step.status === 'success') {
          lines.push(`    [OK  ] ${step.step}`);
        } else if (step.status === 'failed') {
          lines.push(`    [FAIL] ${step.step}`);
          lines.push(`           ${step.error}`);
        } else if (step.status === 'skipped') {
          lines.push(`    [SKIP] ${step.step} -- ${step.detail || ''}`);
        }
      }
      lines.push('');
    }
  }

  // All projects — compact summary
  if (results.projects.length > 0) {
    lines.push('ALL PROJECTS');
    lines.push(subsep);
    for (const project of results.projects) {
      const failedSteps = project.steps.filter(s => s.status === 'failed');
      let icon;
      if (project.status === 'success') {
        icon = 'OK     ';
      } else if (project.status === 'partial') {
        icon = 'PARTIAL';
      } else {
        icon = 'FAIL   ';
      }
      const detail = failedSteps.length > 0
        ? ` (failed: ${failedSteps.map(s => s.step).join(', ')})`
        : '';
      lines.push(`  [${icon}] ${project.projectKey}${detail}`);
    }
    lines.push('');
  }

  lines.push(sep);
  return lines.join('\n');
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
