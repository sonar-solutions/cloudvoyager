/**
 * Full PDF report generator.
 * Produces a styled PDF with the same content as the markdown report.
 */

import { formatDuration, computeProjectStats, computeTotalDurationMs, getNewCodePeriodSkippedProjects } from './shared.js';
import { generatePdfBuffer, pdfStyles, statusStyle, statusText } from './pdf-helpers.js';

/**
 * Generate the full migration report as a PDF buffer.
 */
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
  nodes.push({ text: `Started: ${results.startTime}`, style: 'metadata' });
  nodes.push({ text: `Finished: ${results.endTime || 'In progress'}`, style: 'metadata' });
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

  return [
    { text: 'Summary', style: 'heading' },
    {
      table: {
        headerRows: 1,
        widths: [180, '*'],
        body: [
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
        ],
      },
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

function buildServerSteps(results) {
  if (results.serverSteps.length === 0) return [];

  const body = [
    [
      { text: 'Step', style: 'tableHeader' },
      { text: 'Status', style: 'tableHeader' },
      { text: 'Detail', style: 'tableHeader' },
    ],
  ];
  for (const step of results.serverSteps) {
    body.push([
      { text: step.step, style: 'tableCell' },
      { text: statusText(step.status), style: statusStyle(step.status) },
      { text: step.detail || step.error || '', style: 'tableCell' },
    ]);
  }

  return [
    { text: 'Server-Wide Steps', style: 'heading' },
    { table: { headerRows: 1, widths: ['*', 50, '*'], body }, layout: 'lightHorizontalLines' },
  ];
}

function buildOrgResults(results) {
  if (!results.orgResults || results.orgResults.length === 0) return [];

  const nodes = [];
  for (const org of results.orgResults) {
    nodes.push({ text: `Organization: ${org.key} (${org.projectCount} projects)`, style: 'heading' });

    if (org.steps && org.steps.length > 0) {
      const body = [
        [
          { text: 'Step', style: 'tableHeader' },
          { text: 'Status', style: 'tableHeader' },
          { text: 'Detail', style: 'tableHeader' },
        ],
      ];
      for (const step of org.steps) {
        body.push([
          { text: step.step, style: 'tableCell' },
          { text: statusText(step.status), style: statusStyle(step.status) },
          { text: step.detail || step.error || '', style: 'tableCell' },
        ]);
      }
      nodes.push({ table: { headerRows: 1, widths: ['*', 50, '*'], body }, layout: 'lightHorizontalLines' });
    }
  }
  return nodes;
}

function buildProblemProjects(results) {
  const problemProjects = results.projects.filter(p => p.status !== 'success');
  if (problemProjects.length === 0) return [];

  const nodes = [{ text: 'Failed / Partial Projects', style: 'heading' }];

  for (const project of problemProjects) {
    const label = project.status === 'failed' ? 'FAIL' : 'PARTIAL';
    nodes.push({ text: `[${label}] ${project.projectKey} -> ${project.scProjectKey}`, style: 'subheading' });

    const body = [
      [
        { text: 'Step', style: 'tableHeader' },
        { text: 'Status', style: 'tableHeader' },
        { text: 'Detail', style: 'tableHeader' },
      ],
    ];
    for (const step of project.steps) {
      body.push([
        { text: step.step, style: 'tableCell' },
        { text: statusText(step.status), style: statusStyle(step.status) },
        { text: step.error || step.detail || '', style: 'tableCell' },
      ]);
    }
    nodes.push({ table: { headerRows: 1, widths: ['*', 50, '*'], body }, layout: 'lightHorizontalLines' });
  }

  return nodes;
}

function buildAllProjects(results) {
  if (results.projects.length === 0) return [];

  const body = [
    [
      { text: '#', style: 'tableHeader' },
      { text: 'Project Key', style: 'tableHeader' },
      { text: 'Status', style: 'tableHeader' },
      { text: 'Failed Steps', style: 'tableHeader' },
    ],
  ];

  results.projects.forEach((project, i) => {
    const failedSteps = project.steps.filter(s => s.status === 'failed');
    body.push([
      { text: String(i + 1), style: 'tableCell' },
      { text: project.projectKey, style: 'tableCell' },
      { text: statusText(project.status), style: statusStyle(project.status) },
      { text: failedSteps.map(s => s.step).join(', '), style: 'tableCell' },
    ]);
  });

  return [
    { text: 'All Projects', style: 'heading', pageBreak: results.projects.length > 20 ? 'before' : undefined },
    { table: { headerRows: 1, widths: [25, '*', 55, '*'], body }, layout: 'lightHorizontalLines' },
  ];
}
