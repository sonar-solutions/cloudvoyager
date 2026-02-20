import { formatDuration, formatTimestamp, computeTotalDurationMs, formatNumber, computeTotalLoc, computeLocThroughput } from './shared.js';
import { generatePdfBuffer, pdfStyles, statusStyle, statusText } from './pdf-helpers.js';
import { buildSlowestSteps, buildBottleneckAnalysis } from './pdf-perf-sections.js';

export async function generatePerformanceReportPdf(results) {
  const content = [];
  content.push(...buildHeader(results));
  content.push(...buildOverview(results));
  content.push(...buildServerSteps(results));
  content.push(...buildOrgSteps(results));
  content.push(...buildProjectBreakdown(results));
  content.push(...buildSlowestSteps(results));
  content.push(...buildBottleneckAnalysis(results));
  content.push(...buildEnvironment(results));
  content.push(...buildConfiguration(results));

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

function buildHeader(results) {
  const durationMs = computeTotalDurationMs(results);
  const nodes = [
    { text: 'CloudVoyager Migration — Performance Report', style: 'title' },
    { text: `Started: ${formatTimestamp(results.startTime) || results.startTime}`, style: 'metadata' },
    { text: `Finished: ${formatTimestamp(results.endTime) || 'In progress'}`, style: 'metadata' },
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
  const totalLoc = computeTotalLoc(results);
  if (totalLoc > 0) {
    body.push(['Total Lines of Code', formatNumber(totalLoc)]);
    const throughput = computeLocThroughput(results);
    if (throughput.locPerMinute != null) {
      body.push(['LOC per Minute', formatNumber(throughput.locPerMinute)]);
      body.push(['LOC per Second', formatNumber(throughput.locPerSecond)]);
    }
    body.push(['Average LOC per Project', formatNumber(throughput.avgLocPerProject)]);
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
  const body = [[h('#'), h('Project'), h('LOC'), h('Total'), h('Report Upload'), h('Issue Sync'), h('Hotspot Sync'), h('Config')]];
  sorted.forEach((project, i) => {
    const loc = project.linesOfCode > 0 ? Number(project.linesOfCode).toLocaleString('en-US') : '—';
    body.push([
      c(String(i + 1)),
      c(project.projectKey),
      c(loc),
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
      table: { headerRows: 1, widths: [20, '*', 50, 65, 75, 65, 70, 60], body },
      layout: 'lightHorizontalLines',
      pageBreak: results.projects.length > 20 ? 'before' : undefined,
    },
  ];
}

function buildEnvironment(results) {
  const env = results.environment;
  if (!env) return [];
  const body = [
    [h('Property'), h('Value')],
    ['Platform', `${env.platform} (${env.arch})`],
    ['CPU', `${env.cpuModel} (${env.cpuCores} cores)`],
    ['Memory', `${Number(env.totalMemoryMB).toLocaleString('en-US')} MB`],
    ['Node.js', env.nodeVersion],
    ['Heap Limit', `${Number(env.heapLimitMB).toLocaleString('en-US')} MB`],
  ];
  return [
    { text: 'Runtime Environment', style: 'heading' },
    { table: { headerRows: 1, widths: [200, '*'], body }, layout: 'lightHorizontalLines' },
  ];
}

function buildConfiguration(results) {
  const cfg = results.configuration;
  if (!cfg) return [];
  const body = [
    [h('Setting'), h('Value')],
    ['Transfer Mode', cfg.transferMode],
    ['Batch Size', String(cfg.batchSize)],
    ['Auto-Tune', cfg.autoTune ? 'Enabled' : 'Disabled'],
    ['Max Concurrency', String(cfg.performance.maxConcurrency)],
    ['Source Extraction', `${cfg.performance.sourceExtraction.concurrency} concurrent`],
    ['Hotspot Extraction', `${cfg.performance.hotspotExtraction.concurrency} concurrent`],
    ['Issue Sync', `${cfg.performance.issueSync.concurrency} concurrent`],
    ['Hotspot Sync', `${cfg.performance.hotspotSync.concurrency} concurrent`],
    ['Project Migration', `${cfg.performance.projectMigration.concurrency} concurrent`],
  ];
  if (cfg.rateLimit) {
    body.push(['Rate Limit Retries', String(cfg.rateLimit.maxRetries)]);
    body.push(['Rate Limit Base Delay', `${cfg.rateLimit.baseDelay}ms`]);
    body.push(['Min Request Interval', `${cfg.rateLimit.minRequestInterval}ms`]);
  }
  return [
    { text: 'Configuration', style: 'heading' },
    { table: { headerRows: 1, widths: [200, '*'], body }, layout: 'lightHorizontalLines' },
  ];
}
