import { join } from 'node:path';
import { SonarQubeClient } from '../sonarqube/api-client.js';
import { SonarCloudClient } from '../sonarcloud/api-client.js';
import { transferProject } from '../transfer-pipeline.js';
import { migrateProjectConfig } from './project-config-migrator.js';
import logger from '../../../shared/utils/logger.js';

/**
 * Phase 1 of a single project: upload scanner report + project config.
 * Returns context needed for Phase 2 (metadata sync).
 */
export async function migrateOneProjectCore({ project, scProjectKey, org, gateMapping, extractedData, results, ctx, builtInProfileMapping }) {
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

export async function uploadScannerReport(project, scProjectKey, org, projectResult, ctx, syncAllBranchesOverride) {
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
