import logger from '../../../../shared/utils/logger.js';
import { gatherAllDelta } from '../../sonarcloud/reports/issues-delta/index.js';

// -------- Gather Issues Delta --------

/**
 * Gather post-migration issues delta (SQ vs SC) and attach to results.
 * Called in the finally block of migrateAll before writing final reports.
 */
export async function gatherIssuesDelta(results, ctx) {
  if (ctx.dryRun) return;

  const projectCount = (results.projects || []).filter(p => p.status !== 'failed').length;
  if (projectCount === 0) {
    logger.debug('No eligible projects for issues delta report');
    return;
  }

  logger.info('=== Gathering issues delta report (SQ vs SC) ===');
  results.issuesDeltaData = await gatherAllDelta(results, ctx);

  const { projectsCompared, totalDisappeared, totalAppeared } = results.issuesDeltaData.summary;
  logger.info(`Issues delta: ${projectsCompared} projects, ${totalDisappeared} disappeared, ${totalAppeared} appeared`);
}
