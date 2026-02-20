import { formatDuration, formatTimestamp, computeProjectStats, computeTotalDurationMs, getNewCodePeriodSkippedProjects, formatNumber, computeTotalLoc } from './shared.js';
import { generatePdfBuffer, pdfStyles } from './pdf-helpers.js';
import { buildServerSteps, buildOrgResults, buildProblemProjects, buildAllProjects } from './pdf-sections.js';

export async function generatePdfReport(results) {
  const content = [];
  content.push(...buildHeader(results));
  content.push(...buildSummaryTable(results));
  content.push(...buildKeyConflicts(results));
  content.push(...buildNcpWarnings(results));
  content.push(...buildServerSteps(results));
  content.push(...buildOrgResults(results));
  content.push(...buildProblemProjects(results));
  content.push(...buildAllProjects(results));
  content.push(...buildEnvironment(results));
  content.push(...buildConfiguration(results));

  const docDefinition = {
    info: {
      title: 'CloudVoyager Migration Report',
      author: 'CloudVoyager',
      subject: 'SonarQube to SonarCloud Migration Report',
    },
    pageSize: 'A4',
    pageMargins: [40, 60, 40, 50],
    header: {
      text: 'CloudVoyager Migration Report',
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

function buildHeader(results) {
  const nodes = [];
  nodes.push({ text: 'CloudVoyager Migration Report', style: 'title' });
  const durationMs = computeTotalDurationMs(results);
  nodes.push({ text: `Started: ${formatTimestamp(results.startTime) || results.startTime}`, style: 'metadata' });
  nodes.push({ text: `Finished: ${formatTimestamp(results.endTime) || 'In progress'}`, style: 'metadata' });
  if (durationMs != null) {
    nodes.push({ text: `Duration: ${formatDuration(durationMs)}`, style: 'metadata' });
  }
  if (results.dryRun) {
    nodes.push({ text: 'Mode: DRY RUN (no data migrated)', style: 'metadata', bold: true });
  }
  return nodes;
}

function buildSummaryTable(results) {
  const { succeeded, partial, failed, total } = computeProjectStats(results);
  const projectLine = total > 0
    ? `${succeeded} succeeded, ${partial} partial, ${failed} failed (${total} total)`
    : '0 (no projects migrated)';
  const body = [
    [
      { text: 'Resource', style: 'tableHeader' },
      { text: 'Result', style: 'tableHeader' },
    ],
    ['Projects', projectLine],
    ['Quality Gates', `${results.qualityGates} migrated`],
    ['Quality Profiles', `${results.qualityProfiles} migrated`],
    ['Groups', `${results.groups} created`],
    ['Portfolios', `${results.portfolios} created`],
    ['Issues', `${results.issueSyncStats.matched} matched, ${results.issueSyncStats.transitioned} transitioned`],
    ['Hotspots', `${results.hotspotSyncStats.matched} matched, ${results.hotspotSyncStats.statusChanged} status changed`],
  ];
  const totalLoc = computeTotalLoc(results);
  if (totalLoc > 0) {
    body.push(['Lines of Code', `${formatNumber(totalLoc)} total`]);
  }
  return [
    { text: 'Summary', style: 'heading' },
    {
      table: { headerRows: 1, widths: [180, '*'], body },
      layout: 'lightHorizontalLines',
    },
  ];
}

function buildKeyConflicts(results) {
  const keyWarnings = results.projectKeyWarnings || [];
  if (keyWarnings.length === 0) return [];
  const body = [
    [
      { text: 'SonarQube Key', style: 'tableHeader' },
      { text: 'SonarCloud Key', style: 'tableHeader' },
      { text: 'Taken By', style: 'tableHeader' },
    ],
  ];
  for (const w of keyWarnings) {
    body.push([w.sqKey, w.scKey, w.owner]);
  }
  return [
    { text: 'Project Key Conflicts', style: 'heading' },
    { text: `${keyWarnings.length} project(s) could not use the original SonarQube key because the key is already taken by another organization on SonarCloud.`, style: 'small', margin: [0, 0, 0, 5] },
    { table: { headerRows: 1, widths: ['*', '*', '*'], body }, layout: 'lightHorizontalLines' },
  ];
}

function buildNcpWarnings(results) {
  const ncpSkipped = getNewCodePeriodSkippedProjects(results);
  if (ncpSkipped.length === 0) return [];
  const body = [
    [
      { text: 'Project', style: 'tableHeader' },
      { text: 'Reason', style: 'tableHeader' },
    ],
  ];
  for (const { projectKey, detail } of ncpSkipped) {
    body.push([projectKey, { text: detail, fontSize: 8 }]);
  }
  return [
    { text: 'New Code Period Not Set', style: 'heading' },
    { text: `${ncpSkipped.length} project(s) use unsupported new code period types. Please configure these manually in SonarCloud.`, style: 'small', margin: [0, 0, 0, 5] },
    { table: { headerRows: 1, widths: [150, '*'], body }, layout: 'lightHorizontalLines' },
  ];
}

function buildEnvironment(results) {
  const env = results.environment;
  if (!env) return [];
  const body = [
    [{ text: 'Property', style: 'tableHeader' }, { text: 'Value', style: 'tableHeader' }],
    ['Platform', `${env.platform} (${env.arch})`],
    ['CPU', `${env.cpuModel} (${env.cpuCores} cores)`],
    ['Memory', `${formatNumber(env.totalMemoryMB)} MB`],
    ['Node.js', env.nodeVersion],
    ['Heap Limit', `${formatNumber(env.heapLimitMB)} MB`],
  ];
  return [
    { text: 'Runtime Environment', style: 'heading' },
    { table: { headerRows: 1, widths: [180, '*'], body }, layout: 'lightHorizontalLines' },
  ];
}

function buildConfiguration(results) {
  const cfg = results.configuration;
  if (!cfg) return [];
  const body = [
    [{ text: 'Setting', style: 'tableHeader' }, { text: 'Value', style: 'tableHeader' }],
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
    { table: { headerRows: 1, widths: [180, '*'], body }, layout: 'lightHorizontalLines' },
  ];
}
