import { join } from 'node:path';
import { transferProject } from '../../../transfer-pipeline.js';
import logger from '../../../../../shared/utils/logger.js';

// -------- Main Logic --------

/**
 * Upload scanner report for a single project.
 *
 * @returns {Promise<boolean>} true on success
 */
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
      performanceConfig: ctx.perfConfig, wait: ctx.wait, skipConnectionTest: true, projectName: project.name,
      ruleEnrichmentMap: ctx.ruleEnrichmentMap || null,
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
