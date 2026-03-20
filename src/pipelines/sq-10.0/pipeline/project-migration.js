import { join } from 'node:path';
import { SonarQubeClient } from '../sonarqube/api-client.js';
import { SonarCloudClient } from '../sonarcloud/api-client.js';
import { transferProject } from '../transfer-pipeline.js';
import { extractHotspots } from '../sonarqube/extractors/hotspots.js';
import { extractProjectSettings } from '../sonarqube/extractors/project-settings.js';
import { extractProjectTags } from '../sonarqube/extractors/project-tags.js';
import { extractProjectLinks } from '../sonarqube/extractors/project-links.js';
import { extractNewCodePeriods } from '../sonarqube/extractors/new-code-periods.js';
import { extractProjectPermissions } from '../sonarqube/extractors/permissions.js';
import { assignQualityGatesToProjects } from '../sonarcloud/migrators/quality-gates.js';
import { migrateProjectSettings, migrateProjectTags, migrateProjectLinks, migrateNewCodePeriods, migrateDevOpsBinding } from '../sonarcloud/migrators/project-config.js';
import { migrateProjectPermissions } from '../sonarcloud/migrators/permissions.js';
import { syncIssues } from '../sonarcloud/migrators/issue-sync.js';
import { syncHotspots } from '../sonarcloud/migrators/hotspot-sync.js';
import logger from '../../../shared/utils/logger.js';
import { mapConcurrent, createProgressLogger } from '../../../shared/utils/concurrency.js';
import { finalizeProjectResult, recordProjectOutcome } from './results.js';

/**
 * Full project migration (upload + config + metadata sync).
 * Kept as convenience wrapper for backward compatibility.
 */
export async function migrateOrgProjects(projects, org, scClient, gateMapping, extractedData, results, ctx, builtInProfileMapping) {
  const coreResult = await migrateOrgProjectsCorePhase(projects, org, scClient, gateMapping, extractedData, results, ctx, builtInProfileMapping);
  await migrateOrgProjectsMetadataPhase(coreResult.projectPhase2Contexts, projects, results);
  return { projectKeyMap: coreResult.projectKeyMap, projectKeyWarnings: coreResult.projectKeyWarnings };
}

/**
 * Phase 1: Upload + config for all projects.
 * Returns projectKeyMap and phase2 contexts needed for metadata sync.
 */
export async function migrateOrgProjectsCorePhase(projects, org, scClient, gateMapping, extractedData, results, ctx, builtInProfileMapping) {
  const projectKeyMap = new Map();
  const projectKeyWarnings = [];
  const projectPhase2Contexts = [];
  const migrationJournal = ctx.migrationJournal || null;

  const coreResults = await mapConcurrent(
    projects,
    async (project, i) => {
      // Check if project already completed in migration journal
      if (migrationJournal && migrationJournal.getProjectStatus(org.key, project.key) === 'completed') {
        logger.info(`\n--- Project ${i + 1}/${projects.length}: ${project.key} — already completed, skipping ---`);
        const { scProjectKey } = await resolveProjectKey(project, org, scClient);
        projectKeyMap.set(project.key, scProjectKey);
        return null; // skipped
      }

      const { scProjectKey, warning } = await resolveProjectKey(project, org, scClient);
      if (warning) projectKeyWarnings.push(warning);
      projectKeyMap.set(project.key, scProjectKey);
      logger.info(`\n--- Project ${i + 1}/${projects.length}: ${project.key} -> ${scProjectKey} ---`);

      if (migrationJournal) {
        await migrationJournal.startProject(org.key, project.key);
      }

      const phase2Ctx = await migrateOneProjectCore({ project, scProjectKey, org, gateMapping, extractedData, results, ctx, builtInProfileMapping });
      projectPhase2Contexts.push(phase2Ctx);
      return phase2Ctx.projectResult;
    },
    { concurrency: ctx.perfConfig?.projectMigration?.concurrency || 1, settled: true, onProgress: createProgressLogger('Projects (upload+config)', projects.length) }
  );

  // Aggregate core results
  for (const r of coreResults) {
    if (r.status === 'fulfilled' && r.value) {
      if (r.value.linesOfCode > 0) {
        results.totalLinesOfCode += r.value.linesOfCode;
        results.projectLinesOfCode.push({ projectKey: r.value.projectKey, linesOfCode: r.value.linesOfCode });
      }
    } else if (r.status === 'rejected') {
      logger.error(`Project core migration failed: ${r.reason?.message || r.reason}`);
    }
  }

  return { projectKeyMap, projectKeyWarnings, projectPhase2Contexts };
}

/**
 * Phase 2: Issue + hotspot metadata sync for all projects.
 * Runs after core phase; can execute in parallel with portfolio migration.
 */
export async function migrateOrgProjectsMetadataPhase(projectPhase2Contexts, projects, results) {
  if (projectPhase2Contexts.length === 0) return;

  const concurrency = projectPhase2Contexts[0]?.ctx?.perfConfig?.projectMigration?.concurrency || 1;

  const metadataResults = await mapConcurrent(
    projectPhase2Contexts,
    async (phase2Ctx) => {
      const projectResult = await migrateOneProjectMetadata(phase2Ctx);
      return projectResult;
    },
    { concurrency, settled: true, onProgress: createProgressLogger('Projects (metadata sync)', projectPhase2Contexts.length) }
  );

  // Aggregate final results and record outcomes
  for (const r of metadataResults) {
    if (r.status === 'fulfilled' && r.value) {
      results.projects.push(r.value);
      const origProject = projects.find(p => p.key === r.value.projectKey);
      if (origProject) recordProjectOutcome(origProject, r.value, results);
    } else if (r.status === 'rejected') {
      logger.error(`Project metadata sync failed: ${r.reason?.message || r.reason}`);
    }
  }
}

export async function resolveProjectKey(project, org, scClient) {
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

/**
 * Phase 1 of a single project: upload scanner report + project config.
 * Returns context needed for Phase 2 (metadata sync).
 */
async function migrateOneProjectCore({ project, scProjectKey, org, gateMapping, extractedData, results, ctx, builtInProfileMapping }) {
  const only = ctx.onlyComponents;
  const shouldRun = (comp) => !only || only.includes(comp);
  const projectStart = Date.now();
  const projectResult = { projectKey: project.key, scProjectKey, status: 'success', steps: [], errors: [] };
  const projectSqClient = new SonarQubeClient({ url: ctx.sonarqubeConfig.url, token: ctx.sonarqubeConfig.token, projectKey: project.key });
  const projectScClient = new SonarCloudClient({
    url: org.url || 'https://sonarcloud.io', token: org.token,
    organization: org.key, projectKey: scProjectKey, rateLimit: ctx.rateLimitConfig,
    sharedThrottler: ctx.sharedThrottler || null
  });

  // Migration journal for per-step checkpointing
  const migrationJournal = ctx.migrationJournal || null;
  const STEP_ORDER = [
    'upload_scanner_report',
    'project_settings', 'project_tags', 'project_links', 'new_code_definitions',
    'devops_binding', 'assign_quality_gate', 'assign_quality_profiles', 'project_permissions',
    'sync_issues', 'sync_hotspots'
  ];
  const isStepDone = (step) =>
    migrationJournal && migrationJournal.isProjectStepCompleted(org?.key, project.key, step, STEP_ORDER);
  const recordStep = async (step) => {
    if (migrationJournal) await migrationJournal.completeProjectStep(org?.key, project.key, step);
  };

  // Scanner report upload
  const wantsScanData = shouldRun('scan-data') || shouldRun('scan-data-all-branches');
  let reportUploadOk = false;

  if (wantsScanData) {
    // When --only scan-data (not all-branches), force main branch only
    let syncAllBranchesOverride;
    if (only) {
      if (only.includes('scan-data-all-branches')) {
        syncAllBranchesOverride = undefined; // use default from transferConfig
      } else {
        syncAllBranchesOverride = false; // main branch only
      }
    }
    if (isStepDone('upload_scanner_report')) {
      logger.info(`[${project.key}] Scanner report upload — already completed, skipping`);
      reportUploadOk = true;
      projectResult.steps.push({ step: 'Upload scanner report', status: 'skipped', detail: 'Completed in previous run', durationMs: 0 });
    } else {
      logger.info(`[${project.key}] Starting scanner report upload`);
      reportUploadOk = await uploadScannerReport(project, scProjectKey, org, projectResult, ctx, syncAllBranchesOverride);
      if (reportUploadOk) {
        logger.info(`[${project.key}] Scanner report upload complete`);
        await recordStep('upload_scanner_report');
      }
    }
  } else if (only) {
    projectResult.steps.push({ step: 'Upload scanner report', status: 'skipped', detail: 'Not included in --only', durationMs: 0 });
    // Verify project exists in SonarCloud before attempting downstream operations
    const exists = await projectScClient.projectExists();
    if (exists) {
      reportUploadOk = true;
    } else {
      logger.error(`Project "${scProjectKey}" does not exist in SonarCloud. Skipping all per-project steps. Migrate scan-data first.`);
      projectResult.steps.push({ step: 'Project existence check', status: 'failed', error: `Project "${scProjectKey}" not found in SonarCloud. Run --only scan-data first.`, durationMs: 0 });
      projectResult.errors.push(`Project "${scProjectKey}" not found in SonarCloud`);
      reportUploadOk = false;
    }
  }

  // Project config (component-aware) — skip if project doesn't exist in SonarCloud
  // Also skip if ctx.skipProjectConfig is set (e.g. sync-metadata, since migrate already applied config)
  if (reportUploadOk && !ctx.skipProjectConfig) {
    logger.info(`[${project.key}] Configuring project`);
    await migrateProjectConfig(project, scProjectKey, projectSqClient, projectScClient, gateMapping, extractedData, projectResult, builtInProfileMapping, only, { isStepDone, recordStep });
    logger.info(`[${project.key}] Project configuration complete`);
  } else if (ctx.skipProjectConfig) {
    logger.debug(`Skipping project config for ${scProjectKey} (already applied by migrate)`);
  }

  // Return phase 2 context for metadata sync
  return {
    project, scProjectKey, org, ctx, results, projectResult, projectStart,
    reportUploadOk, projectSqClient, projectScClient,
    isStepDone, recordStep, shouldRun, only,
  };
}

/**
 * Phase 2 of a single project: issue + hotspot metadata sync.
 * Takes the context returned by migrateOneProjectCore.
 */
async function migrateOneProjectMetadata(phase2Ctx) {
  const { project, scProjectKey, org, ctx, results, projectResult, projectStart,
    reportUploadOk, projectSqClient, projectScClient,
    isStepDone, recordStep, shouldRun, only } = phase2Ctx;

  const migrationJournal = ctx.migrationJournal || null;

  // Issue + hotspot metadata sync (parallel)
  await Promise.all([
    (async () => {
      if (shouldRun('issue-metadata')) {
        if (isStepDone('sync_issues')) {
          logger.info(`[${project.key}] Issue sync — already completed, skipping`);
          projectResult.steps.push({ step: 'Sync issues', status: 'skipped', detail: 'Completed in previous run', durationMs: 0 });
        } else {
          await syncProjectIssues(projectResult, results, reportUploadOk, ctx, scProjectKey, projectSqClient, projectScClient, project.key);
          const lastIssueStep = projectResult.steps.at(-1);
          if (lastIssueStep && lastIssueStep.status !== 'failed') await recordStep('sync_issues');
        }
      } else if (only) {
        projectResult.steps.push({ step: 'Sync issues', status: 'skipped', detail: 'Not included in --only', durationMs: 0 });
      }
    })(),
    (async () => {
      if (shouldRun('hotspot-metadata')) {
        if (isStepDone('sync_hotspots')) {
          logger.info(`[${project.key}] Hotspot sync — already completed, skipping`);
          projectResult.steps.push({ step: 'Sync hotspots', status: 'skipped', detail: 'Completed in previous run', durationMs: 0 });
        } else {
          await syncProjectHotspots(projectResult, results, reportUploadOk, ctx, scProjectKey, projectSqClient, projectScClient, project.key);
          const lastHotspotStep = projectResult.steps.at(-1);
          if (lastHotspotStep && lastHotspotStep.status !== 'failed') await recordStep('sync_hotspots');
        }
      } else if (only) {
        projectResult.steps.push({ step: 'Sync hotspots', status: 'skipped', detail: 'Not included in --only', durationMs: 0 });
      }
    })(),
  ]);

  logger.info(`[${project.key}] Project migration complete`);
  finalizeProjectResult(projectResult);
  projectResult.durationMs = Date.now() - projectStart;

  // Update migration journal
  if (migrationJournal) {
    if (projectResult.status === 'success') {
      await migrationJournal.markProjectCompleted(org.key, project.key);
    } else {
      await migrationJournal.markProjectFailed(org.key, project.key, projectResult.errors?.[0] || 'Unknown error');
    }
  }

  return projectResult;
}

async function uploadScannerReport(project, scProjectKey, org, projectResult, ctx, syncAllBranchesOverride) {
  const start = Date.now();
  try {
    const stateFile = join(ctx.outputDir, 'state', `.state.${project.key}.json`);
    const syncAllBranches = syncAllBranchesOverride !== undefined ? syncAllBranchesOverride : ctx.transferConfig.syncAllBranches;
    const includeBranches = ctx.projectBranchIncludes?.get(project.key) || null;
    const transferResult = await transferProject({
      sonarqubeConfig: { url: ctx.sonarqubeConfig.url, token: ctx.sonarqubeConfig.token, projectKey: project.key },
      sonarcloudConfig: { url: org.url || 'https://sonarcloud.io', token: org.token, organization: org.key, projectKey: scProjectKey, rateLimit: ctx.rateLimitConfig },
      transferConfig: { mode: ctx.transferConfig.mode, stateFile, batchSize: ctx.transferConfig.batchSize, syncAllBranches, excludeBranches: ctx.transferConfig.excludeBranches, includeBranches },
      performanceConfig: ctx.perfConfig,
      wait: ctx.wait, skipConnectionTest: true, projectName: project.name,
      ruleEnrichmentMap: ctx.ruleEnrichmentMap || null
    });
    projectResult.linesOfCode = transferResult.stats.linesOfCode || 0;
    projectResult.steps.push({ step: 'Upload scanner report', status: 'success', durationMs: Date.now() - start });
    return true;
  } catch (error) {
    projectResult.linesOfCode = 0;
    projectResult.steps.push({ step: 'Upload scanner report', status: 'failed', error: error.message, durationMs: Date.now() - start });
    projectResult.errors.push(error.message);
    return false;
  }
}

async function syncProjectIssues(projectResult, results, reportUploadOk, ctx, scProjectKey, projectSqClient, projectScClient, projectKey) {
  if (ctx.skipIssueSync) {
    projectResult.steps.push({ step: 'Sync issues', status: 'skipped', detail: 'Disabled by config', durationMs: 0 });
    return;
  }
  if (!reportUploadOk) {
    projectResult.steps.push({ step: 'Sync issues', status: 'skipped', detail: 'Report upload failed', durationMs: 0 });
    return;
  }
  const start = Date.now();
  try {
    logger.info(`[${projectKey}] Syncing issue metadata...`);
    const sqIssues = await projectSqClient.getIssuesWithComments();
    const issueStats = await syncIssues(scProjectKey, sqIssues, projectScClient, { concurrency: ctx.perfConfig.issueSync.concurrency, sqClient: projectSqClient, userMappings: ctx.userMappings });
    logger.info(`[${projectKey}] Issue sync: ${issueStats.matched} matched, ${issueStats.transitioned} transitioned`);
    results.issueSyncStats.matched += issueStats.matched;
    results.issueSyncStats.transitioned += issueStats.transitioned;
    results.issueSyncStats.assigned += issueStats.assigned;
    results.issueSyncStats.assignmentFailed += issueStats.assignmentFailed;
    results.issueSyncStats.failedAssignments.push(...issueStats.failedAssignments);
    const assignDetail = issueStats.assigned > 0 ? `, ${issueStats.assigned} assigned` + (issueStats.assignmentFailed > 0 ? `, ${issueStats.assignmentFailed} assignment-failed` : '') : '';
    projectResult.steps.push({ step: 'Sync issues', status: 'success', detail: `${issueStats.matched} matched, ${issueStats.transitioned} transitioned${assignDetail}`, durationMs: Date.now() - start });
  } catch (error) {
    projectResult.steps.push({ step: 'Sync issues', status: 'failed', error: error.message, durationMs: Date.now() - start });
    projectResult.errors.push(error.message);
  }
}

async function syncProjectHotspots(projectResult, results, reportUploadOk, ctx, scProjectKey, projectSqClient, projectScClient, projectKey) {
  if (ctx.skipHotspotSync) {
    projectResult.steps.push({ step: 'Sync hotspots', status: 'skipped', detail: 'Disabled by config', durationMs: 0 });
    return;
  }
  if (!reportUploadOk) {
    projectResult.steps.push({ step: 'Sync hotspots', status: 'skipped', detail: 'Report upload failed', durationMs: 0 });
    return;
  }
  const start = Date.now();
  try {
    logger.info(`[${projectKey}] Syncing hotspot metadata...`);
    const sqHotspots = await extractHotspots(projectSqClient, null, { concurrency: ctx.perfConfig.hotspotExtraction.concurrency });
    const hotspotStats = await syncHotspots(scProjectKey, sqHotspots, projectScClient, { concurrency: ctx.perfConfig.hotspotSync.concurrency, sonarqubeUrl: projectSqClient.baseURL, sonarqubeProjectKey: projectSqClient.projectKey });
    logger.info(`[${projectKey}] Hotspot sync: ${hotspotStats.matched} matched, ${hotspotStats.statusChanged} status changed`);
    results.hotspotSyncStats.matched += hotspotStats.matched;
    results.hotspotSyncStats.statusChanged += hotspotStats.statusChanged;
    projectResult.steps.push({ step: 'Sync hotspots', status: 'success', detail: `${hotspotStats.matched} matched, ${hotspotStats.statusChanged} status changed`, durationMs: Date.now() - start });
  } catch (error) {
    projectResult.steps.push({ step: 'Sync hotspots', status: 'failed', error: error.message, durationMs: Date.now() - start });
    projectResult.errors.push(error.message);
  }
}

async function runProjectStep(projectResult, stepName, fn) {
  const start = Date.now();
  try {
    const result = await fn();
    const durationMs = Date.now() - start;
    if (result && result.skipped) {
      projectResult.steps.push({ step: stepName, status: 'skipped', detail: result.detail || '', durationMs });
    } else {
      projectResult.steps.push({ step: stepName, status: 'success', durationMs });
    }
  } catch (error) {
    projectResult.steps.push({ step: stepName, status: 'failed', error: error.message, durationMs: Date.now() - start });
    projectResult.errors.push(error.message);
  }
}

async function migrateProjectConfig(project, scProjectKey, projectSqClient, projectScClient, gateMapping, extractedData, projectResult, builtInProfileMapping, onlyComponents, journal = {}) {
  const shouldRun = (comp) => !onlyComponents || onlyComponents.includes(comp);
  const { isStepDone: stepDone, recordStep: recStep } = journal;

  // Journal-guarded project step: skip if already done, record on success
  async function runGuardedStep(stepName, journalKey, fn) {
    if (stepDone && stepDone(journalKey)) {
      logger.info(`${stepName} — already completed, skipping`);
      projectResult.steps.push({ step: stepName, status: 'skipped', detail: 'Completed in previous run', durationMs: 0 });
      return;
    }
    await runProjectStep(projectResult, stepName, fn);
    const lastStep = projectResult.steps.at(-1);
    if (recStep && lastStep && lastStep.status !== 'failed') await recStep(journalKey);
  }

  // Project settings, tags, links, new code definitions, devops binding → 'project-settings' component
  if (shouldRun('project-settings')) {
    await Promise.all([
      runGuardedStep('Project settings', 'project_settings', async () => {
        const projectSettings = await extractProjectSettings(projectSqClient, project.key);
        await migrateProjectSettings(scProjectKey, projectSettings, projectScClient);
      }),
      runGuardedStep('Project tags', 'project_tags', async () => {
        const projectTags = await extractProjectTags(projectSqClient);
        await migrateProjectTags(scProjectKey, projectTags, projectScClient);
      }),
      runGuardedStep('Project links', 'project_links', async () => {
        const projectLinks = await extractProjectLinks(projectSqClient, project.key);
        await migrateProjectLinks(scProjectKey, projectLinks, projectScClient);
      }),
      runGuardedStep('New code definitions', 'new_code_definitions', async () => {
        const newCodePeriods = await extractNewCodePeriods(projectSqClient, project.key);
        return await migrateNewCodePeriods(scProjectKey, newCodePeriods, projectScClient);
      }),
      runGuardedStep('DevOps binding', 'devops_binding', async () => {
        const binding = extractedData.projectBindings.get(project.key);
        await migrateDevOpsBinding(scProjectKey, binding, projectScClient);
      }),
    ]);
  } else if (onlyComponents) {
    for (const step of ['Project settings', 'Project tags', 'Project links', 'New code definitions', 'DevOps binding']) {
      projectResult.steps.push({ step, status: 'skipped', detail: 'Not included in --only', durationMs: 0 });
    }
  }

  // Quality gate, quality profiles, permissions (parallel)
  await Promise.all([
    (async () => {
      if (shouldRun('quality-gates')) {
        await runGuardedStep('Assign quality gate', 'assign_quality_gate', async () => {
          const projectGate = await projectSqClient.getQualityGate();
          if (projectGate && gateMapping.has(projectGate.name)) {
            await assignQualityGatesToProjects(gateMapping, [{ projectKey: scProjectKey, gateName: projectGate.name }], projectScClient);
          }
        });
      } else if (onlyComponents) {
        projectResult.steps.push({ step: 'Assign quality gate', status: 'skipped', detail: 'Not included in --only', durationMs: 0 });
      }
    })(),
    (async () => {
      if (shouldRun('quality-profiles') && builtInProfileMapping && builtInProfileMapping.size > 0) {
        await runGuardedStep('Assign quality profiles', 'assign_quality_profiles', async () => {
          let assigned = 0;
          for (const [language, profileName] of builtInProfileMapping) {
            try {
              await projectScClient.addQualityProfileToProject(language, profileName, scProjectKey);
              assigned++;
            } catch (error) {
              logger.debug(`Could not assign profile "${profileName}" (${language}) to ${scProjectKey}: ${error.message}`);
            }
          }
          return `${assigned} profiles assigned`;
        });
      } else if (onlyComponents && builtInProfileMapping && builtInProfileMapping.size > 0) {
        projectResult.steps.push({ step: 'Assign quality profiles', status: 'skipped', detail: 'Not included in --only', durationMs: 0 });
      }
    })(),
    (async () => {
      if (shouldRun('permissions')) {
        await runGuardedStep('Project permissions', 'project_permissions', async () => {
          const projectPerms = await extractProjectPermissions(projectSqClient, project.key);
          await migrateProjectPermissions(scProjectKey, projectPerms, projectScClient);
        });
      } else if (onlyComponents) {
        projectResult.steps.push({ step: 'Project permissions', status: 'skipped', detail: 'Not included in --only', durationMs: 0 });
      }
    })(),
  ]);
}
