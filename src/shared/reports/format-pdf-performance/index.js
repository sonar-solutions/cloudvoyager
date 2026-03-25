// -------- PDF Performance Report --------
import { generatePdfBuffer, pdfStyles } from '../pdf-helpers.js';
import { buildSlowestSteps, buildBottleneckAnalysis } from '../pdf-perf-sections.js';
import { buildHeader } from './helpers/build-header.js';
import { buildOverview } from './helpers/build-overview.js';
import { buildServerSteps } from './helpers/build-server-steps.js';
import { buildOrgSteps } from './helpers/build-org-steps.js';
import { buildProjectBreakdown } from './helpers/build-project-breakdown.js';
import { buildEnvironment } from './helpers/build-environment.js';
import { buildConfiguration } from './helpers/build-configuration.js';

export async function generatePerformanceReportPdf(results) {
  const content = [
    ...buildHeader(results), ...buildOverview(results),
    ...buildServerSteps(results), ...buildOrgSteps(results),
    ...buildProjectBreakdown(results), ...buildSlowestSteps(results),
    ...buildBottleneckAnalysis(results), ...buildEnvironment(results),
    ...buildConfiguration(results),
  ];
  const docDefinition = {
    info: { title: 'CloudVoyager Migration — Performance Report', author: 'CloudVoyager', subject: 'Migration Performance Breakdown' },
    pageSize: 'A4', pageOrientation: 'landscape', pageMargins: [40, 60, 40, 50],
    header: { text: 'CloudVoyager Performance Report', alignment: 'right', margin: [0, 20, 40, 0], fontSize: 8, color: '#999999' },
    footer: (currentPage, pageCount) => ({
      text: `Page ${currentPage} of ${pageCount}`, alignment: 'center', margin: [0, 10, 0, 0], fontSize: 8, color: '#999999',
    }),
    content, styles: pdfStyles, defaultStyle: { fontSize: 10 },
  };
  return generatePdfBuffer(docDefinition);
}
