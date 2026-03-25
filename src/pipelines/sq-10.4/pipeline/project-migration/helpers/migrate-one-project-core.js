import { SonarQubeClient } from '../../../sonarqube/api-client.js';
import { SonarCloudClient } from '../../../sonarcloud/api-client.js';
import { uploadScannerReport } from './upload-scanner-report.js';
import { migrateProjectConfig } from './migrate-project-config.js';
import { buildJournalHelpers } from './build-journal-helpers.js';
import { handleScanDataUpload } from './handle-scan-data-upload.js';
import logger from '../../../../../shared/utils/logger.js';

// -------- Main Logic --------

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
    sharedThrottler: ctx.sharedThrottler || null,
  });

  const { isStepDone, recordStep } = buildJournalHelpers(ctx, org, project);

  // Scanner report upload
  const reportUploadOk = await handleScanDataUpload(project, scProjectKey, org, projectResult, ctx, projectScClient, only, shouldRun, isStepDone, recordStep);

  // Project config — skip if project doesn't exist or skipProjectConfig is set
  if (reportUploadOk && !ctx.skipProjectConfig) {
    logger.info(`[${project.key}] Configuring project`);
    await migrateProjectConfig(project, scProjectKey, projectSqClient, projectScClient, gateMapping, extractedData, projectResult, builtInProfileMapping, only, { isStepDone, recordStep });
    logger.info(`[${project.key}] Project configuration complete`);
  } else if (ctx.skipProjectConfig) {
    logger.debug(`Skipping project config for ${scProjectKey} (already applied by migrate)`);
  }

  return { project, scProjectKey, org, ctx, results, projectResult, projectStart, reportUploadOk, projectSqClient, projectScClient, isStepDone, recordStep, shouldRun, only };
}
