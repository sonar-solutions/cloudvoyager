// -------- PDF Report Generator --------
import { generatePdfBuffer, pdfStyles } from '../pdf-helpers.js';
import { buildServerSteps, buildOrgResults, buildProblemProjects, buildAllProjects, buildFailedAssignments } from '../pdf-sections.js';
import { buildHeader } from './helpers/build-header.js';
import { buildSummaryTable } from './helpers/build-summary-table.js';
import { buildKeyConflicts } from './helpers/build-key-conflicts.js';
import { buildNcpWarnings } from './helpers/build-ncp-warnings.js';
import { buildEnvironment } from './helpers/build-environment.js';
import { buildConfiguration } from './helpers/build-configuration.js';

export async function generatePdfReport(results) {
  const content = [
    ...buildHeader(results), ...buildSummaryTable(results),
    ...buildKeyConflicts(results), ...buildNcpWarnings(results),
    ...buildServerSteps(results), ...buildOrgResults(results),
    ...buildProblemProjects(results), ...buildAllProjects(results),
    ...buildFailedAssignments(results), ...buildEnvironment(results),
    ...buildConfiguration(results),
  ];
  const docDefinition = {
    info: { title: 'CloudVoyager Migration Report', author: 'CloudVoyager', subject: 'SonarQube to SonarCloud Migration Report' },
    pageSize: 'A4', pageMargins: [40, 60, 40, 50],
    header: { text: 'CloudVoyager Migration Report', alignment: 'right', margin: [0, 20, 40, 0], fontSize: 8, color: '#999999' },
    footer: (currentPage, pageCount) => ({
      text: `Page ${currentPage} of ${pageCount}`, alignment: 'center', margin: [0, 10, 0, 0], fontSize: 8, color: '#999999',
    }),
    content, styles: pdfStyles, defaultStyle: { fontSize: 10 },
  };
  return generatePdfBuffer(docDefinition);
}
