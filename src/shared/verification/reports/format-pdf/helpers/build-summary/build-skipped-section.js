// -------- Build Skipped Checks Section --------

import { collectSkippedChecks } from '../collect-skipped.js';

/**
 * Build the skipped checks sub-section for the PDF summary.
 */
export function buildSkippedSection(results) {
  const skippedChecks = collectSkippedChecks(results);
  if (skippedChecks.length === 0) return [];

  const nodes = [];
  nodes.push({ text: 'Skipped Checks', style: 'subheading' });

  const skipRows = [
    [{ text: 'Check', style: 'tableHeader' }, { text: 'Context', style: 'tableHeader' }, { text: 'Reason', style: 'tableHeader' }],
  ];
  for (const { checkName, context, reason } of skippedChecks) {
    skipRows.push([checkName, context || '', reason]);
  }
  nodes.push({
    table: { headerRows: 1, widths: [80, 100, '*'], body: skipRows },
    layout: 'lightHorizontalLines',
    fontSize: 8,
    margin: [0, 0, 0, 10],
  });

  return nodes;
}
