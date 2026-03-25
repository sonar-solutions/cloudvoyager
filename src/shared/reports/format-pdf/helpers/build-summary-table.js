// -------- Build Summary Table --------
import { computeProjectStats, formatNumber, computeTotalLoc } from '../../shared.js';

export function buildSummaryTable(results) {
  const { succeeded, partial, failed, total } = computeProjectStats(results);
  const projectLine = total > 0
    ? `${succeeded} succeeded, ${partial} partial, ${failed} failed (${total} total)`
    : '0 (no projects migrated)';
  const body = [
    [{ text: 'Resource', style: 'tableHeader' }, { text: 'Result', style: 'tableHeader' }],
    ['Projects', projectLine],
    ['Quality Gates', `${results.qualityGates} migrated`],
    ['Quality Profiles', `${results.qualityProfiles} migrated`],
    ['Groups', `${results.groups} created`],
    ['Portfolios', `${results.portfolios} created`],
    ['Issues', `${results.issueSyncStats.matched} matched, ${results.issueSyncStats.transitioned} transitioned, ${results.issueSyncStats.assigned} assigned${results.issueSyncStats.assignmentFailed > 0 ? `, ${results.issueSyncStats.assignmentFailed} assignment-failed` : ''}`],
    ['Hotspots', `${results.hotspotSyncStats.matched} matched, ${results.hotspotSyncStats.statusChanged} status changed`],
  ];
  const totalLoc = computeTotalLoc(results);
  if (totalLoc > 0) body.push(['Lines of Code', `${formatNumber(totalLoc)} total`]);
  return [
    { text: 'Summary', style: 'heading' },
    { table: { headerRows: 1, widths: [180, '*'], body }, layout: 'lightHorizontalLines' },
  ];
}
