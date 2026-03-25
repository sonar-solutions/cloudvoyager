import { join } from 'node:path';
import { transferProject } from '../../../../../transfer-pipeline.js';
import logger from '../../../../../../../shared/utils/logger.js';

// -------- Upload Scanner Report --------

/** Upload scanner report via the transfer pipeline. */
export async function uploadScannerReport(project, scProjectKey, org, projectResult, ctx, only, isStepDone, recordStep) {
  let syncAllBranchesOverride;
  if (only) {
    syncAllBranchesOverride = only.includes('scan-data-all-branches') ? undefined : false;
  }

  if (isStepDone('upload_scanner_report')) {
    logger.info(`[${project.key}] Scanner report upload — already completed, skipping`);
    projectResult.steps.push({ step: 'Upload scanner report', status: 'skipped', detail: 'Completed in previous run', durationMs: 0 });
    return true;
  }

  logger.info(`[${project.key}] Starting scanner report upload`);
  const start = Date.now();
  try {
    const stateFile = join(ctx.outputDir, 'state', `.state.${project.key}.json`);
    const syncAllBranches = syncAllBranchesOverride !== undefined ? syncAllBranchesOverride : ctx.transferConfig.syncAllBranches;
    const includeBranches = ctx.projectBranchIncludes?.get(project.key) || null;
    const transferResult = await transferProject({
      sonarqubeConfig: { url: ctx.sonarqubeConfig.url, token: ctx.sonarqubeConfig.token, projectKey: project.key },
      sonarcloudConfig: { url: org.url || 'https://sonarcloud.io', token: org.token, organization: org.key, projectKey: scProjectKey, rateLimit: ctx.rateLimitConfig },
      transferConfig: { mode: ctx.transferConfig.mode, stateFile, batchSize: ctx.transferConfig.batchSize, syncAllBranches, excludeBranches: ctx.transferConfig.excludeBranches, includeBranches },
      performanceConfig: ctx.perfConfig, wait: ctx.wait, skipConnectionTest: true, projectName: project.name,
      ruleEnrichmentMap: ctx.ruleEnrichmentMap || null,
    });
    projectResult.linesOfCode = transferResult.stats.linesOfCode || 0;
    projectResult.steps.push({ step: 'Upload scanner report', status: 'success', durationMs: Date.now() - start });
    await recordStep('upload_scanner_report');
    return true;
  } catch (error) {
    projectResult.linesOfCode = 0;
    projectResult.steps.push({ step: 'Upload scanner report', status: 'failed', error: error.message, durationMs: Date.now() - start });
    projectResult.errors.push(error.message);
    return false;
  }
}
