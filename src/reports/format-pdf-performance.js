/**
 * Performance Report PDF generator.
 * Produces a styled PDF showing timing breakdowns for each migration segment.
 */

import { formatDuration, computeTotalDurationMs } from './shared.js';
import { generatePdfBuffer, pdfStyles, statusStyle, statusText } from './pdf-helpers.js';

/**
 * Generate the performance report as a PDF buffer.
 */
export async function generatePerformanceReportPdf(results) {
  const content = [];

  content.push(...buildHeader(results));
  content.push(...buildOverview(results));
  content.push(...buildServerSteps(results));
  content.push(...buildOrgSteps(results));
  content.push(...buildProjectBreakdown(results));
  content.push(...buildSlowestSteps(results));
  content.push(...buildBottleneckAnalysis(results));

  const docDefinition = {
    info: {
      title: 'CloudVoyager Migration — Performance Report',
      author: 'CloudVoyager',
      subject: 'Migration Performance Breakdown',
    },
    pageSize: 'A4',
    pageOrientation: 'landscape',
    pageMargins: [40, 60, 40, 50],
    header: {
      text: 'CloudVoyager Performance Report',
      alignment: 'right',
      margin: [0, 20, 40, 0],
      fontSize: 8,
      color: '#999999',
    },
    footer: (currentPage, pageCount) => ({
      text: `Page ${currentPage} of ${pageCount}`,
      alignment: 'center',
      margin: [0, 10, 0, 0],
      fontSize: 8,
      color: '#999999',
    }),
    content,
    styles: pdfStyles,
    defaultStyle: { fontSize: 10 },
  };

  return generatePdfBuffer(docDefinition);
}

// --- section builders ---

function buildHeader(results) {
  const durationMs = computeTotalDurationMs(results);
  const nodes = [
    { text: 'CloudVoyager Migration — Performance Report', style: 'title' },
    { text: `Started: ${results.startTime}`, style: 'metadata' },
    { text: `Finished: ${results.endTime || 'In progress'}`, style: 'metadata' },
  ];
  if (durationMs != null) {
    nodes.push({ text: `Total Duration: ${formatDuration(durationMs)}`, style: 'metadata' });
  }
  return nodes;
}

function buildOverview(results) {
  const durationMs = computeTotalDurationMs(results);
  const projectCount = results.projects.length;
  const avgPerProject = projectCount > 0 && durationMs != null
    ? formatDuration(Math.round(durationMs / projectCount))
    : '—';
  const serverTotal = sumDurations(results.serverSteps);

  const body = [
    [h('Metric'), h('Value')],
    ['Total Duration', durationMs != null ? formatDuration(durationMs) : '—'],
    ['Projects Migrated', String(projectCount)],
    ['Average Time per Project', avgPerProject],
    ['Organizations', String((results.orgResults || []).length)],
  ];

  if (serverTotal > 0) {
    body.push(['Server-Wide Extraction', formatDuration(serverTotal)]);
  }
  for (const org of (results.orgResults || [])) {
    if (org.durationMs != null) {
      body.push([`Org: ${org.key} (total)`, formatDuration(org.durationMs)]);
    }
  }

  return [
    { text: 'Overview', style: 'heading' },
    { table: { headerRows: 1, widths: [200, '*'], body }, layout: 'lightHorizontalLines' },
  ];
}

function buildServerSteps(results) {
  if (results.serverSteps.length === 0) return [];

  const body = [[h('Step'), h('Duration'), h('Status')]];
  for (const step of results.serverSteps) {
    body.push([
      c(step.step),
      c(dur(step.durationMs)),
      { text: statusText(step.status), style: statusStyle(step.status) },
    ]);
  }
  const total = sumDurations(results.serverSteps);
  body.push([{ text: 'Total', bold: true, fontSize: 9 }, { text: formatDuration(total), bold: true, fontSize: 9 }, '']);

  return [
    { text: 'Server-Wide Extraction', style: 'heading' },
    { table: { headerRows: 1, widths: ['*', 100, 60], body }, layout: 'lightHorizontalLines' },
  ];
}

function buildOrgSteps(results) {
  if (!results.orgResults || results.orgResults.length === 0) return [];

  const nodes = [];
  for (const org of results.orgResults) {
    nodes.push({ text: `Organization: ${org.key}`, style: 'heading' });
    if (org.durationMs != null) {
      nodes.push({ text: `Total org migration time: ${formatDuration(org.durationMs)}`, style: 'metadata' });
    }

    if (org.steps && org.steps.length > 0) {
      const body = [[h('Step'), h('Duration'), h('Status'), h('Detail')]];
      for (const step of org.steps) {
        body.push([
          c(step.step),
          c(dur(step.durationMs)),
          { text: statusText(step.status), style: statusStyle(step.status) },
          c(step.detail || step.error || ''),
        ]);
      }
      const total = sumDurations(org.steps);
      body.push([{ text: 'Total (org steps)', bold: true, fontSize: 9 }, { text: formatDuration(total), bold: true, fontSize: 9 }, '', '']);
      nodes.push({ table: { headerRows: 1, widths: ['*', 100, 60, '*'], body }, layout: 'lightHorizontalLines' });
    }
  }
  return nodes;
}

function buildProjectBreakdown(results) {
  if (results.projects.length === 0) return [];

  const sorted = [...results.projects].sort((a, b) => (b.durationMs || 0) - (a.durationMs || 0));

  const body = [[h('#'), h('Project'), h('Total'), h('Report Upload'), h('Issue Sync'), h('Hotspot Sync'), h('Config')]];

  sorted.forEach((project, i) => {
    body.push([
      c(String(i + 1)),
      c(project.projectKey),
      c(dur(project.durationMs)),
      c(stepDur(project, 'Upload scanner report')),
      c(stepDur(project, 'Sync issues')),
      c(stepDur(project, 'Sync hotspots')),
      c(configDur(project)),
    ]);
  });

  return [
    { text: 'Per-Project Breakdown', style: 'heading' },
    { text: 'Sorted by total duration (slowest first).', style: 'small', margin: [0, 0, 0, 5] },
    {
      table: { headerRows: 1, widths: [20, '*', 65, 75, 65, 70, 60], body },
      layout: 'lightHorizontalLines',
      pageBreak: results.projects.length > 20 ? 'before' : undefined,
    },
  ];
}

function buildSlowestSteps(results) {
  const allSteps = [];
  for (const project of results.projects) {
    for (const step of project.steps) {
      if (step.durationMs != null && step.durationMs > 0) {
        allSteps.push({ projectKey: project.projectKey, step: step.step, durationMs: step.durationMs, status: step.status });
      }
    }
  }
  if (allSteps.length === 0) return [];

  allSteps.sort((a, b) => b.durationMs - a.durationMs);
  const top = allSteps.slice(0, 10);

  const body = [[h('#'), h('Project'), h('Step'), h('Duration'), h('Status')]];
  top.forEach((entry, i) => {
    body.push([
      c(String(i + 1)),
      c(entry.projectKey),
      c(entry.step),
      c(formatDuration(entry.durationMs)),
      { text: statusText(entry.status), style: statusStyle(entry.status) },
    ]);
  });

  return [
    { text: 'Slowest Individual Steps (Top 10)', style: 'heading' },
    { table: { headerRows: 1, widths: [20, '*', '*', 80, 50], body }, layout: 'lightHorizontalLines' },
  ];
}

function buildBottleneckAnalysis(results) {
  const durationMs = computeTotalDurationMs(results);
  if (durationMs == null || durationMs === 0) return [];

  const stepTypeTotals = new Map();

  for (const project of results.projects) {
    for (const step of project.steps) {
      const d = step.durationMs || 0;
      stepTypeTotals.set(step.step, (stepTypeTotals.get(step.step) || 0) + d);
    }
  }
  for (const step of results.serverSteps) {
    const key = `[Server] ${step.step}`;
    stepTypeTotals.set(key, (stepTypeTotals.get(key) || 0) + (step.durationMs || 0));
  }
  for (const org of (results.orgResults || [])) {
    for (const step of (org.steps || [])) {
      const key = `[Org] ${step.step}`;
      stepTypeTotals.set(key, (stepTypeTotals.get(key) || 0) + (step.durationMs || 0));
    }
  }

  if (stepTypeTotals.size === 0) return [];

  const sorted = [...stepTypeTotals.entries()].sort((a, b) => b[1] - a[1]);
  const totalStepTime = sorted.reduce((sum, [, d]) => sum + d, 0);

  const body = [[h('Step Type'), h('Cumulative Time'), h('% of Step Time')]];
  for (const [stepName, d] of sorted) {
    if (d === 0) continue;
    const pct = totalStepTime > 0 ? ((d / totalStepTime) * 100).toFixed(1) : '0.0';
    body.push([c(stepName), c(formatDuration(d)), c(`${pct}%`)]);
  }
  body.push([
    { text: 'Total', bold: true, fontSize: 9 },
    { text: formatDuration(totalStepTime), bold: true, fontSize: 9 },
    { text: '100%', bold: true, fontSize: 9 },
  ]);

  return [
    { text: 'Bottleneck Analysis', style: 'heading' },
    { text: 'Cumulative time spent on each step type across all projects.', style: 'small', margin: [0, 0, 0, 5] },
    { table: { headerRows: 1, widths: ['*', 120, 100], body }, layout: 'lightHorizontalLines' },
  ];
}

// --- tiny helpers ---

function h(text) { return { text, style: 'tableHeader' }; }
function c(text) { return { text, style: 'tableCell' }; }
function dur(ms) { return ms != null ? formatDuration(ms) : '—'; }
function sumDurations(steps) { return (steps || []).reduce((sum, s) => sum + (s.durationMs || 0), 0); }

function stepDur(project, stepName) {
  const step = project.steps.find(s => s.step === stepName);
  if (!step || step.durationMs == null) return '—';
  if (step.status === 'skipped') return 'skipped';
  return formatDuration(step.durationMs);
}

function configDur(project) {
  const mainSteps = new Set(['Upload scanner report', 'Sync issues', 'Sync hotspots']);
  const total = project.steps.filter(s => !mainSteps.has(s.step)).reduce((sum, s) => sum + (s.durationMs || 0), 0);
  return total > 0 ? formatDuration(total) : '—';
}
