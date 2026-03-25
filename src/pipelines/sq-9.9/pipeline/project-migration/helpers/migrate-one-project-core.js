import { SonarQubeClient } from '../../../sonarqube/api-client.js';
import { SonarCloudClient } from '../../../sonarcloud/api-client.js';
import { handleScannerReport } from './handle-scanner-report.js';
import { migrateProjectConfig } from './migrate-project-config.js';
import logger from '../../../../../shared/utils/logger.js';

// -------- Phase 1: Single Project Core Migration --------

export async function migrateOneProjectCore({ project, scProjectKey, org, gateMapping, extractedData, results, ctx, builtInProfileMapping }) {
  const only = ctx.onlyComponents;
  const shouldRun = (comp) => !only || only.includes(comp);
  const projectStart = Date.now();
  const projectResult = { projectKey: project.key, scProjectKey, status: 'success', steps: [], errors: [] };

  const projectSqClient = new SonarQubeClient({ url: ctx.sonarqubeConfig.url, token: ctx.sonarqubeConfig.token, projectKey: project.key });
  const projectScClient = new SonarCloudClient({ url: org.url || 'https://sonarcloud.io', token: org.token, organization: org.key, projectKey: scProjectKey, rateLimit: ctx.rateLimitConfig, sharedThrottler: ctx.sharedThrottler || null });

  const migrationJournal = ctx.migrationJournal || null;
  const STEP_ORDER = ['upload_scanner_report', 'project_settings', 'project_tags', 'project_links', 'new_code_definitions', 'devops_binding', 'assign_quality_gate', 'assign_quality_profiles', 'project_permissions', 'sync_issues', 'sync_hotspots'];
  const isStepDone = (step) => migrationJournal?.isProjectStepCompleted(org?.key, project.key, step, STEP_ORDER);
  const recordStep = async (step) => { if (migrationJournal) await migrationJournal.completeProjectStep(org?.key, project.key, step); };

  const reportUploadOk = await handleScannerReport({ project, scProjectKey, org, projectResult, ctx, projectScClient, shouldRun, only, isStepDone, recordStep });

  if (reportUploadOk && !ctx.skipProjectConfig) {
    logger.info(`[${project.key}] Configuring project`);
    await migrateProjectConfig(project, scProjectKey, projectSqClient, projectScClient, gateMapping, extractedData, projectResult, builtInProfileMapping, only, { isStepDone, recordStep });
    logger.info(`[${project.key}] Project configuration complete`);
  } else if (ctx.skipProjectConfig) {
    logger.debug(`Skipping project config for ${scProjectKey}`);
  }

  return { project, scProjectKey, org, ctx, results, projectResult, projectStart, reportUploadOk, projectSqClient, projectScClient, isStepDone, recordStep, shouldRun, only };
}
