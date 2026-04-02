import { generatePdfBuffer, pdfStyles } from '../pdf-helpers.js';
import { buildHeader } from './helpers/build-header.js';
import { buildSummaryTable } from './helpers/build-summary-table.js';
import { buildProjectSection } from './helpers/build-project-section.js';

// -------- PDF Issues Delta Report --------

/** Generate a PDF buffer for the project issues delta report. */
export async function generateIssuesDeltaPdf(results) {
  if (!results.issuesDeltaData) return null;
  const data = results.issuesDeltaData;

  const projectSections = data.projects.flatMap(p => buildProjectSection(p));

  const content = [
    ...buildHeader(data),
    ...buildSummaryTable(data.summary),
    ...projectSections,
  ];

  const docDefinition = {
    info: { title: 'CloudVoyager — Issues Delta Report', author: 'CloudVoyager', subject: 'Project Issues Delta Report' },
    pageSize: 'A4', pageMargins: [40, 60, 40, 50],
    header: { text: 'CloudVoyager Issues Delta Report', alignment: 'right', margin: [0, 20, 40, 0], fontSize: 8, color: '#999999' },
    footer: (currentPage, pageCount) => ({
      text: `Page ${currentPage} of ${pageCount}`, alignment: 'center', margin: [0, 10, 0, 0], fontSize: 8, color: '#999999',
    }),
    content, styles: pdfStyles, defaultStyle: { fontSize: 10 },
  };

  return generatePdfBuffer(docDefinition);
}
