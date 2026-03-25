import logger from '../../../../../shared/utils/logger.js';
import { SonarQubeClient } from '../../../sonarqube/api-client.js';
import { SonarCloudClient } from '../../../sonarcloud/api-client.js';
import { uploadScannerReport } from './upload-scanner-report.js';
import { migrateProjectConfig } from './migrate-project-config.js';

// -------- Migrate One Project: Core Phase --------

export async function migrateOneProjectCore({ project, scProjectKey, org, gateMapping, extractedData, ctx, builtInProfileMapping }) {
  const only = ctx.onlyComponents;
  const shouldRun = (comp) => !only || only.includes(comp);
  const projectStart = Date.now();
  const projectResult = { projectKey: project.key, scProjectKey, status: 'success', steps: [], errors: [] };
  const projectSqClient = new SonarQubeClient({ url: ctx.sonarqubeConfig.url, token: ctx.sonarqubeConfig.token, projectKey: project.key });
  const projectScClient = new SonarCloudClient({
    url: org.url || 'https://sonarcloud.io', token: org.token,
    organization: org.key, projectKey: scProjectKey, rateLimit: ctx.rateLimitConfig,
    sharedThrottler: ctx.sharedThrottler || null,
  });
  const migrationJournal = ctx.migrationJournal || null;
  const STEP_ORDER = ['upload_scanner_report', 'project_settings', 'project_tags', 'project_links', 'new_code_definitions', 'devops_binding', 'assign_quality_gate', 'assign_quality_profiles', 'project_permissions', 'sync_issues', 'sync_hotspots'];
  const isStepDone = (step) => migrationJournal && migrationJournal.isProjectStepCompleted(org?.key, project.key, step, STEP_ORDER);
  const recordStep = async (step) => { if (migrationJournal) await migrationJournal.completeProjectStep(org?.key, project.key, step); };
  const wantsScanData = shouldRun('scan-data') || shouldRun('scan-data-all-branches');
  let reportUploadOk = false;
  if (wantsScanData) {
    const syncOverride = only ? (only.includes('scan-data-all-branches') ? undefined : false) : undefined;
    if (isStepDone('upload_scanner_report')) {
      logger.info(`[${project.key}] Scanner report upload — already completed, skipping`);
      reportUploadOk = true;
      projectResult.steps.push({ step: 'Upload scanner report', status: 'skipped', detail: 'Completed in previous run', durationMs: 0 });
    } else {
      reportUploadOk = await uploadScannerReport(project, scProjectKey, org, projectResult, ctx, syncOverride);
      if (reportUploadOk) await recordStep('upload_scanner_report');
    }
  } else if (only) {
    projectResult.steps.push({ step: 'Upload scanner report', status: 'skipped', detail: 'Not included in --only', durationMs: 0 });
    const exists = await projectScClient.projectExists();
    if (exists) { reportUploadOk = true; }
    else {
      logger.error(`Project "${scProjectKey}" not in SonarCloud. Run --only scan-data first.`);
      projectResult.errors.push(`Project "${scProjectKey}" not found in SonarCloud`);
    }
  }
  if (reportUploadOk && !ctx.skipProjectConfig) {
    await migrateProjectConfig(project, scProjectKey, projectSqClient, projectScClient, gateMapping, extractedData, projectResult, builtInProfileMapping, only, { isStepDone, recordStep });
  }
  return { project, scProjectKey, org, ctx, projectResult, projectStart, reportUploadOk, projectSqClient, projectScClient, isStepDone, recordStep, shouldRun, only };
}
