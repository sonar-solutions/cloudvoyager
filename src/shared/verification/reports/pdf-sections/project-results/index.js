// -------- PDF Project Results --------

import { buildDetailSections } from '../detail-sections.js';
import { buildPdfCheckRows } from './helpers/build-check-rows.js';
import { buildUnsyncableNote } from './helpers/build-unsyncable-note.js';

/**
 * Build PDF nodes for all per-project check results.
 */
export function buildProjectResults(results, statusCell) {
  if (results.projectResults.length === 0) return [];

  const nodes = [{ text: 'Per-Project Checks', style: 'heading' }];

  for (const project of results.projectResults) {
    const checks = Object.values(project.checks || {});
    const fails = checks.filter(c => c.status === 'fail').length;
    nodes.push({ text: `${fails === 0 ? 'PASS' : 'FAIL'}  ${project.sqProjectKey} → ${project.scProjectKey}`, style: 'subheading' });

    const headerRow = [
      [{ text: 'Check', style: 'tableHeader' }, { text: 'Status', style: 'tableHeader' }, { text: 'Details', style: 'tableHeader' }],
    ];
    const dataRows = buildPdfCheckRows(project.checks, statusCell);

    if (dataRows.length > 0) {
      nodes.push({
        table: { headerRows: 1, widths: ['*', 50, '*'], body: [...headerRow, ...dataRows] },
        layout: 'lightHorizontalLines',
        margin: [0, 0, 0, 5],
      });
    }

    const unsyncNote = buildUnsyncableNote(project.checks);
    if (unsyncNote) nodes.push(unsyncNote);

    buildDetailSections(project.checks, nodes);
    nodes.push({ text: '', margin: [0, 0, 0, 10] });
  }

  return nodes;
}
