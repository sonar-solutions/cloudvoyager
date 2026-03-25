import logger from '../../../../../../shared/utils/logger.js';

// -------- Log Issue Sync Summary --------

export function logSyncSummary(stats) {
  const mappingDetail = stats.assignmentMapped > 0 ? `, ${stats.assignmentMapped} mapped` : '';
  const skipDetail = stats.assignmentSkipped > 0 ? `, ${stats.assignmentSkipped} assignment-skipped` : '';
  logger.info(
    `Issue sync: ${stats.matched} matched, ${stats.transitioned} transitioned, ${stats.assigned} assigned${mappingDetail}, ` +
    `${stats.assignmentFailed} assignment-failed${skipDetail}, ${stats.commented} comments, ${stats.tagged} tagged, ` +
    `${stats.metadataSyncTagged} metadata-sync-tagged, ${stats.sourceLinked} source-linked, ${stats.failed} failed`,
  );
}
