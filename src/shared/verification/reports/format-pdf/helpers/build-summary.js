// -------- Build PDF Summary Table --------

import { buildSkippedSection } from './build-summary/build-skipped-section.js';

/**
 * Build the PDF summary section.
 * @param {object} results - Verification results
 * @returns {object[]} PDF content nodes
 */
export function buildSummaryTable(results) {
  const s = results.summary;
  const overall = s.failed === 0 && s.errors === 0 ? 'ALL CHECKS PASSED' : `${s.failed} FAILED, ${s.errors} ERRORS`;

  const nodes = [
    { text: 'Summary', style: 'heading' },
    {
      table: {
        headerRows: 1,
        widths: ['*', 80],
        body: [
          [{ text: 'Metric', style: 'tableHeader' }, { text: 'Count', style: 'tableHeader' }],
          ['Total checks', String(s.totalChecks)],
          ['Passed', String(s.passed)],
          ['Failed', String(s.failed)],
          ['Warnings (unsyncable)', String(s.warnings)],
          ['Skipped', String(s.skipped)],
          ['Errors', String(s.errors)],
          [{ text: 'Overall', bold: true }, { text: overall, bold: true }],
        ],
      },
      layout: 'lightHorizontalLines',
      margin: [0, 0, 0, 10],
    },
  ];

  nodes.push(...buildSkippedSection(results));
  return nodes;
}
