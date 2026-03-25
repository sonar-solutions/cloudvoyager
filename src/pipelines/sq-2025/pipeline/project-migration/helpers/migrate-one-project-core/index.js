import { SonarQubeClient } from '../../../../sonarqube/api-client.js';
import { SonarCloudClient } from '../../../../sonarcloud/api-client.js';
import { migrateProjectConfig } from '../../../project-config-migrator.js';
import { createJournalHelpers } from './helpers/create-journal-helpers.js';
import { handleScannerReport } from './helpers/handle-scanner-report.js';
import logger from '../../../../../../shared/utils/logger.js';

// -------- Core Project Migration --------

/** Phase 1: upload scanner report + project config. Returns context for Phase 2. */
export async function migrateOneProjectCore(args) {
  const { project, scProjectKey, org, gateMapping, extractedData, results, ctx, builtInProfileMapping } = args;
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

  const { isStepDone, recordStep } = createJournalHelpers(ctx.migrationJournal, org, project);
  const reportUploadOk = await handleScannerReport(project, scProjectKey, org, projectResult, ctx, shouldRun, only, isStepDone, recordStep, projectScClient);

  if (reportUploadOk && !ctx.skipProjectConfig) {
    logger.info(`[${project.key}] Configuring project`);
    await migrateProjectConfig(project, scProjectKey, projectSqClient, projectScClient, gateMapping, extractedData, projectResult, builtInProfileMapping, only, { isStepDone, recordStep });
    logger.info(`[${project.key}] Project configuration complete`);
  } else if (ctx.skipProjectConfig) {
    logger.debug(`Skipping project config for ${scProjectKey}`);
  }

  return { project, scProjectKey, org, ctx, results, projectResult, projectStart, reportUploadOk, projectSqClient, projectScClient, isStepDone, recordStep, shouldRun, only };
}
