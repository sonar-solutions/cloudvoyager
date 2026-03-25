import logger from '../../../../../shared/utils/logger.js';
import { getNewCodePeriodSkippedProjects } from '../../../../../shared/reports/shared.js';

// -------- Log Migration Summary --------

export function logMigrationSummary(results, outputDir) {
  const duration = ((Date.now() - new Date(results.startTime).getTime()) / 1000).toFixed(2);
  const succeeded = results.projects.filter(p => p.status === 'success').length;
  const partial = results.projects.filter(p => p.status === 'partial').length;
  const failed = results.projects.filter(p => p.status === 'failed').length;

  logger.info('\n=== Migration Summary ===');
  logger.info(`Duration: ${duration}s`);
  if (results.totalLinesOfCode > 0) logger.info(`Lines of Code: ${results.totalLinesOfCode.toLocaleString()}`);
  logger.info(`Projects: ${succeeded} succeeded, ${partial} partial, ${failed} failed, ${results.projects.length} total`);
  logger.info(`Quality Gates: ${results.qualityGates} migrated`);
  logger.info(`Quality Profiles: ${results.qualityProfiles} migrated`);
  logger.info(`Groups: ${results.groups} created`);
  logger.info(`Portfolios: ${results.portfolios} created`);
  logger.info(`Issues synced: ${results.issueSyncStats.matched} matched, ${results.issueSyncStats.transitioned} transitioned, ${results.issueSyncStats.assigned} assigned, ${results.issueSyncStats.assignmentFailed} assignment-failed`);
  logger.info(`Hotspots synced: ${results.hotspotSyncStats.matched} matched, ${results.hotspotSyncStats.statusChanged} status changed`);

  if (results.projectKeyWarnings.length > 0) {
    logger.warn(`Project key conflicts: ${results.projectKeyWarnings.length} project(s) could not use the original SonarQube key on SonarCloud`);
    for (const w of results.projectKeyWarnings) logger.warn(`  "${w.sqKey}" -> "${w.scKey}" (key taken by org "${w.owner}")`);
  }

  const ncpSkipped = getNewCodePeriodSkippedProjects(results);
  if (ncpSkipped.length > 0) {
    logger.warn(`New code period NOT set: ${ncpSkipped.length} project(s) have unsupported new code period types`);
    for (const { projectKey, detail } of ncpSkipped) logger.warn(`  ${projectKey}: ${detail}`);
  }

  logger.info(`Output: ${outputDir}`);
  logger.info('========================');
}
