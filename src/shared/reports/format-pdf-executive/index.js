// -------- PDF Executive Summary Generator --------
import { computeProjectStats, computeOverallStatus } from '../shared.js';
import { generatePdfBuffer, pdfStyles } from '../pdf-helpers.js';
import { buildWarnings, buildActionItems, buildFailedProjects } from '../pdf-exec-sections.js';
import { buildHeader } from './helpers/build-header.js';
import { buildStatusBanner } from './helpers/build-status-banner.js';
import { buildKeyMetrics } from './helpers/build-key-metrics.js';
import { buildFooter } from './helpers/build-footer.js';

export async function generateExecutiveSummaryPdf(results) {
  const stats = computeProjectStats(results);
  const overallStatus = computeOverallStatus(stats);
  const content = [
    ...buildHeader(results), ...buildStatusBanner(stats, overallStatus),
    ...buildKeyMetrics(results, stats), ...buildWarnings(results, stats),
    ...buildActionItems(results, stats), ...buildFailedProjects(results),
    ...buildFooter(),
  ];
  const docDefinition = {
    info: { title: 'CloudVoyager Migration — Executive Summary', author: 'CloudVoyager', subject: 'Migration Executive Summary' },
    pageSize: 'A4', pageMargins: [40, 40, 40, 40],
    content,
    styles: {
      ...pdfStyles,
      bannerSuccess: { fontSize: 14, bold: true, color: '#1b5e20', margin: [0, 10, 0, 5] },
      bannerPartial: { fontSize: 14, bold: true, color: '#e65100', margin: [0, 10, 0, 5] },
      bannerFail: { fontSize: 14, bold: true, color: '#b71c1c', margin: [0, 10, 0, 5] },
      bodyText: { fontSize: 10, margin: [0, 0, 0, 5] },
      actionItem: { fontSize: 10, margin: [10, 2, 0, 2] },
    },
    defaultStyle: { fontSize: 10 },
  };
  return generatePdfBuffer(docDefinition);
}
