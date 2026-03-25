// -------- PDF Measure Detail Sections --------

import { h, smallTable } from './pdf-table-utils.js';

/**
 * Build measure-related detail PDF nodes.
 */
export function buildMeasureDetails(c, nodes) {
  if (c.measures?.mismatches?.length > 0) {
    nodes.push({ text: `Measure Mismatches (${c.measures.mismatches.length})`, style: 'subheading' });
    const rows = [[h('Metric'), h('SQ Value'), h('SC Value'), h('Delta')]];
    for (const m of c.measures.mismatches) {
      const sqNum = parseFloat(m.sqValue);
      const scNum = parseFloat(m.scValue);
      let deltaStr = 'N/A';
      if (!isNaN(sqNum) && !isNaN(scNum)) {
        const delta = scNum - sqNum;
        deltaStr = delta === 0 ? '0' : (delta > 0 ? `+${delta}` : `${delta}`);
      }
      rows.push([m.metric, String(m.sqValue), String(m.scValue), deltaStr]);
    }
    nodes.push(smallTable(rows, ['*', 80, 80, 80]));
  }

  if (c.measures?.sqOnly?.length > 0) {
    nodes.push({ text: `Measures Only in SonarQube (${c.measures.sqOnly.length})`, style: 'subheading' });
    const rows = [[h('Metric'), h('SQ Value')]];
    for (const m of c.measures.sqOnly) rows.push([m.metric, String(m.sqValue)]);
    nodes.push(smallTable(rows, ['*', 100]));
  }

  if (c.measures?.scOnly?.length > 0) {
    nodes.push({ text: `Measures Only in SonarCloud (${c.measures.scOnly.length})`, style: 'subheading' });
    const rows = [[h('Metric'), h('SC Value')]];
    for (const m of c.measures.scOnly) rows.push([m.metric, String(m.scValue)]);
    nodes.push(smallTable(rows, ['*', 100]));
  }
}
