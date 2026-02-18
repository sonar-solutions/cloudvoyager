/**
 * Executive Summary PDF generator.
 * Produces a polished, concise PDF aimed at engineering leadership.
 */

import { formatDuration, computeProjectStats, computeOverallStatus, computeTotalDurationMs, getNewCodePeriodSkippedProjects } from './shared.js';
import { generatePdfBuffer, pdfStyles } from './pdf-helpers.js';

/**
 * Generate the executive summary as a PDF buffer.
 */
export async function generateExecutiveSummaryPdf(results) {
  const stats = computeProjectStats(results);
  const overallStatus = computeOverallStatus(stats);
  const content = [];

  content.push(...buildHeader(results));
  content.push(...buildStatusBanner(stats, overallStatus));
  content.push(...buildKeyMetrics(results, stats));
  content.push(...buildWarnings(results, stats));
  content.push(...buildActionItems(results, stats));
  content.push(...buildFailedProjects(results));
  content.push(...buildFooter());

  const docDefinition = {
    info: {
      title: 'CloudVoyager Migration — Executive Summary',
      author: 'CloudVoyager',
      subject: 'Migration Executive Summary',
    },
    pageSize: 'A4',
    pageMargins: [40, 40, 40, 40],
    content,
    styles: {
      ...pdfStyles,
      bannerSuccess: { fontSize: 14, bold: true, color: '#1b5e20', margin: [0, 10, 0, 5] },
      bannerPartial: { fontSize: 14, bold: true, color: '#e65100', margin: [0, 10, 0, 5] },
      bannerFail: { fontSize: 14, bold: true, color: '#b71c1c', margin: [0, 10, 0, 5] },
      bodyText: { fontSize: 10, margin: [0, 0, 0, 5] },
      actionItem: { fontSize: 10, margin: [10, 2, 0, 2] },
    },
    defaultStyle: { fontSize: 10 },
  };

  return generatePdfBuffer(docDefinition);
}

function buildHeader(results) {
  const durationMs = computeTotalDurationMs(results);
  const date = results.startTime
    ? new Date(results.startTime).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : 'Unknown';

  const nodes = [
    { text: 'CloudVoyager Migration', style: 'title' },
    { text: 'Executive Summary', fontSize: 14, color: '#666666', margin: [0, 0, 0, 10] },
    { text: `Date: ${date}`, style: 'metadata' },
  ];

  if (durationMs != null) {
    nodes.push({ text: `Duration: ${formatDuration(durationMs)}`, style: 'metadata' });
  }
  if (results.dryRun) {
    nodes.push({ text: 'Mode: DRY RUN (no data migrated)', style: 'metadata', bold: true });
  }
  const orgCount = (results.orgResults || []).length;
  if (orgCount > 0) {
    nodes.push({ text: `Target Organizations: ${orgCount}`, style: 'metadata' });
  }

  return nodes;
}

function buildStatusBanner(stats, overallStatus) {
  const successRate = stats.total > 0
    ? ((stats.succeeded / stats.total) * 100).toFixed(1)
    : '0.0';

  let bannerStyle = 'bannerSuccess';
  if (overallStatus === 'FAILED') bannerStyle = 'bannerFail';
  else if (overallStatus === 'PARTIAL SUCCESS') bannerStyle = 'bannerPartial';

  const nodes = [
    { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: '#cccccc' }], margin: [0, 10, 0, 0] },
    { text: `Overall Status: ${overallStatus}`, style: bannerStyle },
  ];

  if (stats.total === 0) {
    nodes.push({ text: 'No projects were migrated.', style: 'bodyText' });
  } else if (stats.failed === 0 && stats.partial === 0) {
    nodes.push({ text: `Migration of ${stats.total} project(s) completed with a ${successRate}% success rate.`, style: 'bodyText' });
  } else {
    nodes.push({ text: `Migration of ${stats.total} project(s) completed with ${stats.succeeded} fully migrated (${successRate}% success rate).`, style: 'bodyText' });
    if (stats.partial > 0) {
      nodes.push({ text: `${stats.partial} project(s) partially migrated (some steps failed).`, style: 'bodyText' });
    }
    if (stats.failed > 0) {
      nodes.push({ text: `${stats.failed} project(s) failed entirely.`, style: 'bodyText' });
    }
  }

  return nodes;
}

function buildKeyMetrics(results, stats) {
  const body = [
    [
      { text: 'Metric', style: 'tableHeader' },
      { text: 'Value', style: 'tableHeader' },
    ],
    ['Total Projects', String(stats.total)],
    ['Fully Migrated', `${stats.succeeded} (${stats.total > 0 ? ((stats.succeeded / stats.total) * 100).toFixed(1) : 0}%)`],
    ['Partially Migrated', `${stats.partial} (${stats.total > 0 ? ((stats.partial / stats.total) * 100).toFixed(1) : 0}%)`],
    ['Failed', `${stats.failed} (${stats.total > 0 ? ((stats.failed / stats.total) * 100).toFixed(1) : 0}%)`],
    ['Quality Profiles Migrated', String(results.qualityProfiles)],
    ['Quality Gates Migrated', String(results.qualityGates)],
    ['Groups Created', String(results.groups)],
    ['Portfolios Created', String(results.portfolios)],
    ['Issues Synced', `${results.issueSyncStats.matched} matched, ${results.issueSyncStats.transitioned} transitioned`],
    ['Hotspots Synced', `${results.hotspotSyncStats.matched} matched, ${results.hotspotSyncStats.statusChanged} status changed`],
  ];

  return [
    { text: 'Key Metrics', style: 'heading' },
    { table: { headerRows: 1, widths: [200, '*'], body }, layout: 'lightHorizontalLines' },
  ];
}

function buildWarnings(results, stats) {
  const keyWarnings = results.projectKeyWarnings || [];
  const ncpSkipped = getNewCodePeriodSkippedProjects(results);

  if (keyWarnings.length === 0 && ncpSkipped.length === 0 && stats.failed === 0 && stats.partial === 0) {
    return [
      { text: 'Warnings & Risks', style: 'heading' },
      { text: 'No warnings or risks identified.', style: 'bodyText' },
    ];
  }

  const nodes = [{ text: 'Warnings & Risks', style: 'heading' }];

  if (keyWarnings.length > 0) {
    nodes.push({ text: 'Project Key Conflicts', style: 'subheading' });
    nodes.push({ text: `${keyWarnings.length} project(s) required a renamed key on SonarCloud due to global key conflicts. This may affect CI/CD pipeline configurations.`, style: 'bodyText' });
  }

  if (ncpSkipped.length > 0) {
    nodes.push({ text: 'New Code Period Configuration', style: 'subheading' });
    nodes.push({ text: `${ncpSkipped.length} project(s) have unsupported new code period types and require manual configuration in SonarCloud.`, style: 'bodyText' });
  }

  if (stats.failed > 0) {
    nodes.push({ text: 'Failed Projects', style: 'subheading' });
    nodes.push({ text: `${stats.failed} project(s) failed to migrate entirely. Review the detailed migration report for root cause analysis.`, style: 'bodyText' });
  }

  if (stats.partial > 0) {
    nodes.push({ text: 'Partially Migrated Projects', style: 'subheading' });
    nodes.push({ text: `${stats.partial} project(s) had one or more steps fail. These may need manual intervention.`, style: 'bodyText' });
  }

  return nodes;
}

function buildActionItems(results, stats) {
  const keyWarnings = results.projectKeyWarnings || [];
  const ncpSkipped = getNewCodePeriodSkippedProjects(results);
  const items = [];

  if (keyWarnings.length > 0) {
    items.push(`Update CI/CD pipelines for renamed project keys (${keyWarnings.length} project(s))`);
  }
  if (ncpSkipped.length > 0) {
    items.push(`Manually configure new code periods in SonarCloud (${ncpSkipped.length} project(s))`);
  }
  if (stats.failed > 0) {
    items.push(`Investigate and retry failed project migrations (${stats.failed} project(s))`);
  }
  if (stats.partial > 0) {
    items.push(`Review partially migrated projects and fix failed steps (${stats.partial} project(s))`);
  }
  items.push('Review quality profile rule gaps in quality-profile-diff.json');
  items.push('Verify project permissions in SonarCloud dashboard');

  const nodes = [{ text: 'Action Items', style: 'heading' }];
  items.forEach((item, i) => {
    nodes.push({ text: `${i + 1}. ${item}`, style: 'actionItem' });
  });
  return nodes;
}

function buildFailedProjects(results) {
  const failedProjects = results.projects.filter(p => p.status === 'failed');
  if (failedProjects.length === 0) return [];

  const body = [
    [
      { text: 'Project Key', style: 'tableHeader' },
      { text: 'Failed Steps', style: 'tableHeader' },
    ],
  ];
  for (const project of failedProjects) {
    const failedSteps = project.steps.filter(s => s.status === 'failed');
    body.push([project.projectKey, failedSteps.map(s => s.step).join(', ')]);
  }

  return [
    { text: 'Failed Projects', style: 'heading' },
    { table: { headerRows: 1, widths: [200, '*'], body }, layout: 'lightHorizontalLines' },
  ];
}

function buildFooter() {
  return [
    { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: '#cccccc' }], margin: [0, 20, 0, 5] },
    { text: 'Generated by CloudVoyager', style: 'small', alignment: 'center' },
  ];
}
