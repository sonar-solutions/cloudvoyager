import { formatTimestamp, formatDuration, computeTotalDurationMs } from '../../reports/shared.js';
import { generatePdfBuffer, pdfStyles } from '../../reports/pdf-helpers.js';

/**
 * Generate a PDF verification report.
 */
export async function generateVerificationPdf(results) {
  const content = [];

  content.push(...buildHeader(results));
  content.push(...buildSummaryTable(results));
  content.push(...buildOrgResults(results));
  content.push(...buildProjectResults(results));

  const docDefinition = {
    info: {
      title: 'CloudVoyager Verification Report',
      author: 'CloudVoyager',
      subject: 'SonarQube to SonarCloud Migration Verification',
    },
    pageSize: 'A4',
    pageMargins: [40, 60, 40, 50],
    header: {
      text: 'CloudVoyager Verification Report',
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
    styles: {
      ...pdfStyles,
      statusPass: { color: '#2e7d32', fontSize: 9 },
      statusFail: { color: '#c62828', fontSize: 9 },
      statusWarn: { color: '#e65100', fontSize: 9 },
      statusSkip: { color: '#757575', fontSize: 9 },
    },
    defaultStyle: { fontSize: 10 },
  };

  return generatePdfBuffer(docDefinition);
}

function buildHeader(results) {
  const nodes = [];
  nodes.push({ text: 'CloudVoyager Verification Report', style: 'title' });

  const meta = [];
  meta.push(`Started: ${formatTimestamp(results.startTime) || results.startTime}`);
  meta.push(`Finished: ${formatTimestamp(results.endTime) || 'In progress'}`);
  const durationMs = computeTotalDurationMs(results);
  if (durationMs != null) meta.push(`Duration: ${formatDuration(durationMs)}`);

  nodes.push({ text: meta.join('  |  '), style: 'metadata', margin: [0, 0, 0, 10] });
  return nodes;
}

function buildSummaryTable(results) {
  const s = results.summary;
  const overall = s.failed === 0 && s.errors === 0 ? 'ALL CHECKS PASSED' : `${s.failed} FAILED, ${s.errors} ERRORS`;

  return [
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
        ]
      },
      layout: 'lightHorizontalLines',
      margin: [0, 0, 0, 10],
    }
  ];
}

function buildOrgResults(results) {
  if (results.orgResults.length === 0) return [];

  const nodes = [{ text: 'Organization-Level Checks', style: 'heading' }];

  for (const org of results.orgResults) {
    nodes.push({ text: `Organization: ${org.orgKey}`, style: 'subheading' });

    if (org.error) {
      nodes.push({ text: `Error: ${org.error}`, style: 'statusFail' });
      continue;
    }

    const rows = [[
      { text: 'Check', style: 'tableHeader' },
      { text: 'Status', style: 'tableHeader' },
      { text: 'Details', style: 'tableHeader' }
    ]];

    const checks = org.checks || {};
    if (checks.qualityGates) {
      rows.push(['Quality Gates', statusCell(checks.qualityGates.status), `Missing: ${(checks.qualityGates.missing || []).length}`]);
    }
    if (checks.qualityProfiles) {
      rows.push(['Quality Profiles', statusCell(checks.qualityProfiles.status), `Missing: ${(checks.qualityProfiles.missing || []).length}`]);
    }
    if (checks.groups) {
      rows.push(['Groups', statusCell(checks.groups.status), `Missing: ${(checks.groups.missing || []).length}`]);
    }
    if (checks.globalPermissions) {
      rows.push(['Global Permissions', statusCell(checks.globalPermissions.status), `${(checks.globalPermissions.mismatches || []).length} groups with gaps`]);
    }
    if (checks.permissionTemplates) {
      rows.push(['Permission Templates', statusCell(checks.permissionTemplates.status), `Missing: ${(checks.permissionTemplates.missing || []).length}`]);
    }

    if (rows.length > 1) {
      nodes.push({
        table: { headerRows: 1, widths: ['*', 60, '*'], body: rows },
        layout: 'lightHorizontalLines',
        margin: [0, 0, 0, 10],
      });
    }
  }

  return nodes;
}

function buildProjectResults(results) {
  if (results.projectResults.length === 0) return [];

  const nodes = [{ text: 'Per-Project Checks', style: 'heading' }];

  for (const project of results.projectResults) {
    const checks = Object.values(project.checks || {});
    const fails = checks.filter(c => c.status === 'fail').length;
    const statusLabel = fails === 0 ? 'PASS' : 'FAIL';

    nodes.push({ text: `${statusLabel}  ${project.sqProjectKey} → ${project.scProjectKey}`, style: 'subheading' });

    const rows = [[
      { text: 'Check', style: 'tableHeader' },
      { text: 'Status', style: 'tableHeader' },
      { text: 'Details', style: 'tableHeader' }
    ]];

    const c = project.checks;
    if (c.existence) rows.push(['Exists', statusCell(c.existence.status), '']);
    if (c.branches) rows.push(['Branches', statusCell(c.branches.status), `SQ: ${c.branches.sqCount}, SC: ${c.branches.scCount}, Missing: ${(c.branches.missing || []).length}`]);
    if (c.issues) rows.push(['Issues', statusCell(c.issues.status), `Matched: ${c.issues.matched}/${c.issues.sqCount}, Status mismatches: ${(c.issues.statusMismatches || []).length}`]);
    if (c.hotspots) rows.push(['Hotspots', statusCell(c.hotspots.status), `Matched: ${c.hotspots.matched}/${c.hotspots.sqCount}, Status mismatches: ${(c.hotspots.statusMismatches || []).length}`]);
    if (c.measures) rows.push(['Measures', statusCell(c.measures.status), `${c.measures.compared || 0} compared, ${(c.measures.mismatches || []).length} mismatches`]);
    if (c.qualityGate) rows.push(['Quality Gate', statusCell(c.qualityGate.status), `SQ: ${c.qualityGate.sqGate || 'none'}, SC: ${c.qualityGate.scGate || 'none'}`]);
    if (c.qualityProfiles) rows.push(['Quality Profiles', statusCell(c.qualityProfiles.status), `${(c.qualityProfiles.mismatches || []).length} mismatches`]);
    if (c.settings) rows.push(['Settings', statusCell(c.settings.status), `${(c.settings.mismatches || []).length} mismatches`]);
    if (c.tags) rows.push(['Tags', statusCell(c.tags.status), `Missing: ${(c.tags.missing || []).length}`]);
    if (c.links) rows.push(['Links', statusCell(c.links.status), `Missing: ${(c.links.missing || []).length}`]);
    if (c.newCodePeriods) rows.push(['New Code Periods', statusCell(c.newCodePeriods.status), '']);
    if (c.devopsBinding) rows.push(['DevOps Binding', statusCell(c.devopsBinding.status), '']);
    if (c.permissions) rows.push(['Permissions', statusCell(c.permissions.status), `${(c.permissions.mismatches || []).length} groups with gaps`]);

    if (rows.length > 1) {
      nodes.push({
        table: { headerRows: 1, widths: ['*', 50, '*'], body: rows },
        layout: 'lightHorizontalLines',
        margin: [0, 0, 0, 5],
      });
    }

    // Unsyncable note
    const unsyncParts = [];
    if (c.issues?.unsyncable?.typeChanges > 0) unsyncParts.push(`${c.issues.unsyncable.typeChanges} type changes`);
    if (c.issues?.unsyncable?.severityChanges > 0) unsyncParts.push(`${c.issues.unsyncable.severityChanges} severity changes`);
    if (c.hotspots?.unsyncable?.assignments > 0) unsyncParts.push(`${c.hotspots.unsyncable.assignments} hotspot assignments`);
    if (unsyncParts.length > 0) {
      nodes.push({ text: `Unsyncable: ${unsyncParts.join(', ')}`, style: 'statusWarn', margin: [0, 0, 0, 10] });
    }
  }

  return nodes;
}

function statusCell(status) {
  const styleMap = { pass: 'statusPass', fail: 'statusFail', skipped: 'statusSkip', error: 'statusWarn' };
  return { text: (status || '').toUpperCase(), style: styleMap[status] || 'tableCell' };
}
