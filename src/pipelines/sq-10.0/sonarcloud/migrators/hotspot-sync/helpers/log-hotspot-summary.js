import logger from '../../../../../../shared/utils/logger.js';

// -------- Log Hotspot Summary --------

export function logHotspotSummary(stats) {
  logger.info(`Hotspot sync: ${stats.matched} matched, ${stats.statusChanged} status changed, ${stats.commented} comments, ${stats.metadataSyncCommented} metadata-sync-commented, ${stats.sourceLinked} source-linked, ${stats.failed} failed`);
}
