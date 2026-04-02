import { generatePdfBuffer, pdfStyles } from '../pdf-helpers.js';
import { buildHeader } from './helpers/build-header.js';
import { buildSummaryTable } from './helpers/build-summary-table.js';
import { buildRuleDiffSections } from './helpers/build-profile-section.js';

// -------- PDF Rules Comparison Report --------

/** Generate a PDF buffer for the full rules comparison report (SQ vs SC). */
export async function generateRulesComparisonPdf(results) {
  if (!results.rulesComparisonData) return null;
  const { summary, onlyInSQ, onlyInSC } = results.rulesComparisonData;

  const content = [
    ...buildHeader(results.rulesComparisonData),
    ...buildSummaryTable(summary),
    ...buildRuleDiffSections(onlyInSQ, onlyInSC),
  ];

  const docDefinition = {
    info: { title: 'CloudVoyager — Rules Comparison Report', author: 'CloudVoyager', subject: 'SonarQube vs SonarCloud Rules Comparison' },
    pageSize: 'A4', pageMargins: [40, 60, 40, 50],
    header: { text: 'CloudVoyager Rules Comparison Report', alignment: 'right', margin: [0, 20, 40, 0], fontSize: 8, color: '#999999' },
    footer: (currentPage, pageCount) => ({
      text: `Page ${currentPage} of ${pageCount}`, alignment: 'center', margin: [0, 10, 0, 0], fontSize: 8, color: '#999999',
    }),
    content, styles: pdfStyles, defaultStyle: { fontSize: 10 },
  };

  return generatePdfBuffer(docDefinition);
}
