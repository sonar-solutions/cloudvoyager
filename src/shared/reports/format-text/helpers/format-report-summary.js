// -------- Format Report Summary --------
import { computeProjectStats, formatNumber, computeTotalLoc } from '../../shared.js';

export function formatReportSummary(lines, results, subsep) {
  const { succeeded, partial, failed, total } = computeProjectStats(results);
  lines.push('SUMMARY', subsep);
  if (total > 0) {
    lines.push(`  Projects:         ${succeeded} succeeded, ${partial} partial, ${failed} failed (${total} total)`);
  } else {
    lines.push('  Projects:         0 (no projects migrated)');
  }
  lines.push(
    `  Quality Gates:    ${results.qualityGates} migrated`,
    `  Quality Profiles: ${results.qualityProfiles} migrated`,
    `  Groups:           ${results.groups} created`,
    `  Portfolios:       ${results.portfolios} created`,
    `  Issues:           ${results.issueSyncStats.matched} matched, ${results.issueSyncStats.transitioned} transitioned, ${results.issueSyncStats.assigned} assigned${results.issueSyncStats.assignmentFailed > 0 ? `, ${results.issueSyncStats.assignmentFailed} assignment-failed` : ''}`,
    `  Hotspots:         ${results.hotspotSyncStats.matched} matched, ${results.hotspotSyncStats.statusChanged} status changed`,
  );
  const totalLoc = computeTotalLoc(results);
  if (totalLoc > 0) lines.push(`  Lines of Code:    ${formatNumber(totalLoc)} total`);
  lines.push('');
}
