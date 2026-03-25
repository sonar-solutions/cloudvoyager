// -------- Format Key Metrics --------
import { formatNumber, computeTotalLoc, computeLocThroughput } from '../../shared.js';

export function formatKeyMetrics(results, stats) {
  const lines = [
    '## Key Metrics\n',
    '| Metric | Value |',
    '|--------|-------|',
    `| Total Projects | ${stats.total} |`,
    `| Fully Migrated | ${stats.succeeded} (${stats.total > 0 ? ((stats.succeeded / stats.total) * 100).toFixed(1) : 0}%) |`,
    `| Partially Migrated | ${stats.partial} (${stats.total > 0 ? ((stats.partial / stats.total) * 100).toFixed(1) : 0}%) |`,
    `| Failed | ${stats.failed} (${stats.total > 0 ? ((stats.failed / stats.total) * 100).toFixed(1) : 0}%) |`,
    `| Quality Profiles Migrated | ${results.qualityProfiles} |`,
    `| Quality Gates Migrated | ${results.qualityGates} |`,
    `| Groups Created | ${results.groups} |`,
    `| Portfolios Created | ${results.portfolios} |`,
    `| Issues Synced | ${results.issueSyncStats.matched} matched, ${results.issueSyncStats.transitioned} transitioned, ${results.issueSyncStats.assigned} assigned${results.issueSyncStats.assignmentFailed > 0 ? `, ${results.issueSyncStats.assignmentFailed} assignment-failed` : ''} |`,
    `| Hotspots Synced | ${results.hotspotSyncStats.matched} matched, ${results.hotspotSyncStats.statusChanged} status changed |`,
  ];
  const totalLoc = computeTotalLoc(results);
  if (totalLoc > 0) {
    lines.push(`| Total Lines of Code | ${formatNumber(totalLoc)} |`);
    const throughput = computeLocThroughput(results);
    if (throughput.locPerMinute != null) {
      lines.push(`| Migration Throughput | ${formatNumber(throughput.locPerMinute)} LOC/min |`);
    }
  }
  lines.push('');
  return lines.join('\n');
}
