// -------- Build Key Metrics --------
import { formatNumber, computeTotalLoc, computeLocThroughput } from '../../shared.js';

export function buildKeyMetrics(results, stats) {
  const body = [
    [{ text: 'Metric', style: 'tableHeader' }, { text: 'Value', style: 'tableHeader' }],
    ['Total Projects', String(stats.total)],
    ['Fully Migrated', `${stats.succeeded} (${stats.total > 0 ? ((stats.succeeded / stats.total) * 100).toFixed(1) : 0}%)`],
    ['Partially Migrated', `${stats.partial} (${stats.total > 0 ? ((stats.partial / stats.total) * 100).toFixed(1) : 0}%)`],
    ['Failed', `${stats.failed} (${stats.total > 0 ? ((stats.failed / stats.total) * 100).toFixed(1) : 0}%)`],
    ['Quality Profiles Migrated', String(results.qualityProfiles)],
    ['Quality Gates Migrated', String(results.qualityGates)],
    ['Groups Created', String(results.groups)],
    ['Portfolios Created', String(results.portfolios)],
    ['Issues Synced', `${results.issueSyncStats.matched} matched, ${results.issueSyncStats.transitioned} transitioned`],
    ['Hotspots Synced', `${results.hotspotSyncStats.matched} matched, ${results.hotspotSyncStats.statusChanged} status changed`],
  ];
  const totalLoc = computeTotalLoc(results);
  if (totalLoc > 0) {
    body.push(['Total Lines of Code', formatNumber(totalLoc)]);
    const throughput = computeLocThroughput(results);
    if (throughput.locPerMinute != null) body.push(['Migration Throughput', `${formatNumber(throughput.locPerMinute)} LOC/min`]);
  }
  return [
    { text: 'Key Metrics', style: 'heading' },
    { table: { headerRows: 1, widths: [200, '*'], body }, layout: 'lightHorizontalLines' },
  ];
}
