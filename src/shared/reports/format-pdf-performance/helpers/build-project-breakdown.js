// -------- Build Project Breakdown --------
import { h, c, dur, stepDur, configDur } from './pdf-cell-helpers.js';

export function buildProjectBreakdown(results) {
  if (results.projects.length === 0) return [];
  const sorted = [...results.projects].sort((a, b) => (b.durationMs || 0) - (a.durationMs || 0));
  const body = [[h('#'), h('Project'), h('LOC'), h('Total'), h('Report Upload'), h('Issue Sync'), h('Hotspot Sync'), h('Config')]];
  sorted.forEach((project, i) => {
    const loc = project.linesOfCode > 0 ? Number(project.linesOfCode).toLocaleString('en-US') : '—';
    body.push([
      c(String(i + 1)), c(project.projectKey), c(loc), c(dur(project.durationMs)),
      c(stepDur(project, 'Upload scanner report')), c(stepDur(project, 'Sync issues')),
      c(stepDur(project, 'Sync hotspots')), c(configDur(project)),
    ]);
  });
  return [
    { text: 'Per-Project Breakdown', style: 'heading' },
    { text: 'Sorted by total duration (slowest first).', style: 'small', margin: [0, 0, 0, 5] },
    {
      table: { headerRows: 1, widths: [20, '*', 50, 65, 75, 65, 70, 60], body },
      layout: 'lightHorizontalLines',
      pageBreak: results.projects.length > 20 ? 'before' : undefined,
    },
  ];
}
