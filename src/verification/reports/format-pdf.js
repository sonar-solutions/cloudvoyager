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
    if (c.issues) rows.push(['Issues', statusCell(c.issues.status), `Matched: ${c.issues.matched}/${c.issues.sqCount}, Status mismatches: ${(c.issues.statusMismatches || []).length}, History mismatches: ${(c.issues.statusHistoryMismatches || []).length}`]);
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
      nodes.push({ text: `Unsyncable: ${unsyncParts.join(', ')}`, style: 'statusWarn', margin: [0, 0, 0, 5] });
    }

    // ── ISSUE DETAILS ──

    // Issue Type Breakdown diff
    if (c.issues && (Object.keys(c.issues.typeBreakdown?.sq || {}).length > 0 || Object.keys(c.issues.typeBreakdown?.sc || {}).length > 0)) {
      const allTypes = [...new Set([...Object.keys(c.issues.typeBreakdown.sq || {}), ...Object.keys(c.issues.typeBreakdown.sc || {})])].sort();
      nodes.push({ text: 'Issue Type Breakdown (SQ vs SC)', style: 'subheading' });
      const typeRows = [[h('Type'), h('SQ Count'), h('SC Count'), h('Delta')]];
      for (const type of allTypes) {
        const sq = c.issues.typeBreakdown.sq[type] || 0;
        const sc = c.issues.typeBreakdown.sc[type] || 0;
        const delta = sc - sq;
        const deltaStr = delta === 0 ? '0' : (delta > 0 ? `+${delta}` : `${delta}`);
        typeRows.push([type, String(sq), String(sc), deltaStr]);
      }
      nodes.push(smallTable(typeRows, [120, 80, 80, 80]));
    }

    // Issue Severity Breakdown diff
    if (c.issues && (Object.keys(c.issues.severityBreakdown?.sq || {}).length > 0 || Object.keys(c.issues.severityBreakdown?.sc || {}).length > 0)) {
      const allSeverities = [...new Set([...Object.keys(c.issues.severityBreakdown.sq || {}), ...Object.keys(c.issues.severityBreakdown.sc || {})])].sort();
      nodes.push({ text: 'Issue Severity Breakdown (SQ vs SC)', style: 'subheading' });
      const sevRows = [[h('Severity'), h('SQ Count'), h('SC Count'), h('Delta')]];
      for (const sev of allSeverities) {
        const sq = c.issues.severityBreakdown.sq[sev] || 0;
        const sc = c.issues.severityBreakdown.sc[sev] || 0;
        const delta = sc - sq;
        const deltaStr = delta === 0 ? '0' : (delta > 0 ? `+${delta}` : `${delta}`);
        sevRows.push([sev, String(sq), String(sc), deltaStr]);
      }
      nodes.push(smallTable(sevRows, [120, 80, 80, 80]));
    }

    // Unmatched SQ Issues
    if (c.issues?.unmatchedSqIssues?.length > 0) {
      nodes.push({ text: `Unmatched SQ Issues — in SonarQube but NOT in SonarCloud (${c.issues.unmatched})`, style: 'subheading' });
      const unmatchedRows = [[h('Rule'), h('File'), h('Line'), h('Type'), h('Severity'), h('Message')]];
      for (const m of c.issues.unmatchedSqIssues.slice(0, 100)) {
        unmatchedRows.push([m.rule, truncate(m.file, 30), String(m.line), m.type, m.severity, truncate(m.message, 40)]);
      }
      if (c.issues.unmatched > 100) unmatchedRows.push([{ text: `... and ${c.issues.unmatched - 100} more`, colSpan: 6, italics: true }, '', '', '', '', '']);
      nodes.push(smallTable(unmatchedRows, [70, 100, 30, 60, 55, '*']));
    }

    // SC-Only Issues
    if (c.issues?.scOnlyIssues?.length > 0) {
      nodes.push({ text: `SC-Only Issues — in SonarCloud but NOT in SonarQube (${c.issues.scOnlyIssues.length})`, style: 'subheading' });
      const scOnlyRows = [[h('Rule'), h('File'), h('Line'), h('Type'), h('Severity'), h('Message')]];
      for (const m of c.issues.scOnlyIssues.slice(0, 100)) {
        scOnlyRows.push([m.rule, truncate(m.file, 30), String(m.line), m.type, m.severity, truncate(m.message, 40)]);
      }
      if (c.issues.scOnlyIssues.length > 100) scOnlyRows.push([{ text: `... and ${c.issues.scOnlyIssues.length - 100} more`, colSpan: 6, italics: true }, '', '', '', '', '']);
      nodes.push(smallTable(scOnlyRows, [70, 100, 30, 60, 55, '*']));
    }

    // Issue Status Mismatches
    if (c.issues?.statusMismatches?.length > 0) {
      nodes.push({ text: `Issue Status Mismatches (${c.issues.statusMismatches.length})`, style: 'subheading' });
      const statusRows = [[h('Rule'), h('File'), h('Line'), h('SQ Status'), h('SC Status')]];
      for (const m of c.issues.statusMismatches.slice(0, 100)) {
        statusRows.push([m.rule, truncate(m.file, 30), String(m.line), `${m.sqStatus}${m.sqResolution ? '/' + m.sqResolution : ''}`, `${m.scStatus}${m.scResolution ? '/' + m.scResolution : ''}`]);
      }
      if (c.issues.statusMismatches.length > 100) statusRows.push([{ text: `... and ${c.issues.statusMismatches.length - 100} more`, colSpan: 5, italics: true }, '', '', '', '']);
      nodes.push(smallTable(statusRows, [80, '*', 30, 80, 80]));
    }

    // Issue Status History Mismatches
    if (c.issues?.statusHistoryMismatches?.length > 0) {
      nodes.push({ text: `Issue Status History Mismatches (${c.issues.statusHistoryMismatches.length})`, style: 'subheading' });
      const histRows = [[h('Rule'), h('File'), h('Line'), h('SQ Transitions'), h('SC Transitions'), h('Missing')]];
      for (const m of c.issues.statusHistoryMismatches.slice(0, 100)) {
        histRows.push([m.rule, truncate(m.file, 25), String(m.line), m.sqTransitions.join(' → '), m.scTransitions.join(' → ') || 'none', m.missingTransitions.join(', ')]);
      }
      if (c.issues.statusHistoryMismatches.length > 100) histRows.push([{ text: `... and ${c.issues.statusHistoryMismatches.length - 100} more`, colSpan: 6, italics: true }, '', '', '', '', '']);
      nodes.push(smallTable(histRows, [65, 80, 25, '*', '*', 70]));
    }

    // Issue Assignment Mismatches
    if (c.issues?.assignmentMismatches?.length > 0) {
      nodes.push({ text: `Issue Assignment Mismatches (${c.issues.assignmentMismatches.length})`, style: 'subheading' });
      const assignRows = [[h('Rule'), h('File'), h('SQ Assignee'), h('SC Assignee')]];
      for (const m of c.issues.assignmentMismatches.slice(0, 100)) {
        assignRows.push([m.rule, truncate(m.file, 35), m.sqAssignee || 'none', m.scAssignee || 'none']);
      }
      if (c.issues.assignmentMismatches.length > 100) assignRows.push([{ text: `... and ${c.issues.assignmentMismatches.length - 100} more`, colSpan: 4, italics: true }, '', '', '']);
      nodes.push(smallTable(assignRows, [80, '*', 100, 100]));
    }

    // Issue Comment Mismatches
    if (c.issues?.commentMismatches?.length > 0) {
      nodes.push({ text: `Issue Comment Mismatches (${c.issues.commentMismatches.length})`, style: 'subheading' });
      const commentRows = [[h('Rule'), h('File'), h('SQ Comments'), h('SC Migrated')]];
      for (const m of c.issues.commentMismatches.slice(0, 100)) {
        commentRows.push([m.rule, truncate(m.file, 35), String(m.sqCommentCount), String(m.scMigratedCommentCount)]);
      }
      if (c.issues.commentMismatches.length > 100) commentRows.push([{ text: `... and ${c.issues.commentMismatches.length - 100} more`, colSpan: 4, italics: true }, '', '', '']);
      nodes.push(smallTable(commentRows, [80, '*', 80, 80]));
    }

    // Issue Tag Mismatches
    if (c.issues?.tagMismatches?.length > 0) {
      nodes.push({ text: `Issue Tag Mismatches (${c.issues.tagMismatches.length})`, style: 'subheading' });
      const tagRows = [[h('Rule'), h('File'), h('SQ Tags'), h('SC Tags')]];
      for (const m of c.issues.tagMismatches.slice(0, 100)) {
        tagRows.push([m.rule, truncate(m.file, 30), m.sqTags.join(', '), m.scTags.join(', ')]);
      }
      if (c.issues.tagMismatches.length > 100) tagRows.push([{ text: `... and ${c.issues.tagMismatches.length - 100} more`, colSpan: 4, italics: true }, '', '', '']);
      nodes.push(smallTable(tagRows, [80, 100, '*', '*']));
    }

    // Unsyncable Type Changes (detail)
    if (c.issues?.unsyncable?.typeChangeDetails?.length > 0) {
      nodes.push({ text: `Unsyncable Issue Type Changes (${c.issues.unsyncable.typeChanges})`, style: 'subheading' });
      const typeChRows = [[h('Rule'), h('File'), h('SQ Type'), h('SC Type')]];
      for (const m of c.issues.unsyncable.typeChangeDetails.slice(0, 50)) {
        typeChRows.push([m.rule, truncate(m.file, 35), m.sqType, m.scType]);
      }
      if (c.issues.unsyncable.typeChanges > 50) typeChRows.push([{ text: `... and ${c.issues.unsyncable.typeChanges - 50} more`, colSpan: 4, italics: true }, '', '', '']);
      nodes.push(smallTable(typeChRows, [80, '*', 80, 80]));
    }

    // Unsyncable Severity Changes (detail)
    if (c.issues?.unsyncable?.severityChangeDetails?.length > 0) {
      nodes.push({ text: `Unsyncable Issue Severity Changes (${c.issues.unsyncable.severityChanges})`, style: 'subheading' });
      const sevChRows = [[h('Rule'), h('File'), h('SQ Severity'), h('SC Severity')]];
      for (const m of c.issues.unsyncable.severityChangeDetails.slice(0, 50)) {
        sevChRows.push([m.rule, truncate(m.file, 35), m.sqSeverity, m.scSeverity]);
      }
      if (c.issues.unsyncable.severityChanges > 50) sevChRows.push([{ text: `... and ${c.issues.unsyncable.severityChanges - 50} more`, colSpan: 4, italics: true }, '', '', '']);
      nodes.push(smallTable(sevChRows, [80, '*', 80, 80]));
    }

    // ── MEASURE DETAILS ──

    if (c.measures?.mismatches?.length > 0) {
      nodes.push({ text: `Measure Mismatches (${c.measures.mismatches.length})`, style: 'subheading' });
      const measRows = [[h('Metric'), h('SQ Value'), h('SC Value'), h('Delta')]];
      for (const m of c.measures.mismatches) {
        const sqNum = parseFloat(m.sqValue);
        const scNum = parseFloat(m.scValue);
        let deltaStr = 'N/A';
        if (!isNaN(sqNum) && !isNaN(scNum)) {
          const delta = scNum - sqNum;
          deltaStr = delta === 0 ? '0' : (delta > 0 ? `+${delta}` : `${delta}`);
        }
        measRows.push([m.metric, String(m.sqValue), String(m.scValue), deltaStr]);
      }
      nodes.push(smallTable(measRows, ['*', 80, 80, 80]));
    }

    if (c.measures?.sqOnly?.length > 0) {
      nodes.push({ text: `Measures Only in SonarQube (${c.measures.sqOnly.length})`, style: 'subheading' });
      const sqOnlyRows = [[h('Metric'), h('SQ Value')]];
      for (const m of c.measures.sqOnly) {
        sqOnlyRows.push([m.metric, String(m.sqValue)]);
      }
      nodes.push(smallTable(sqOnlyRows, ['*', 100]));
    }

    if (c.measures?.scOnly?.length > 0) {
      nodes.push({ text: `Measures Only in SonarCloud (${c.measures.scOnly.length})`, style: 'subheading' });
      const scOnlyRows = [[h('Metric'), h('SC Value')]];
      for (const m of c.measures.scOnly) {
        scOnlyRows.push([m.metric, String(m.scValue)]);
      }
      nodes.push(smallTable(scOnlyRows, ['*', 100]));
    }

    // ── HOTSPOT DETAILS ──

    // Unmatched SQ Hotspots
    if (c.hotspots?.unmatchedSqHotspots?.length > 0) {
      nodes.push({ text: `Unmatched SQ Hotspots — in SonarQube but NOT in SonarCloud (${c.hotspots.unmatched})`, style: 'subheading' });
      const unmatchedHsRows = [[h('Rule'), h('File'), h('Line'), h('Status'), h('Message')]];
      for (const m of c.hotspots.unmatchedSqHotspots.slice(0, 100)) {
        unmatchedHsRows.push([m.rule, truncate(m.file, 30), String(m.line), m.status, truncate(m.message, 50)]);
      }
      if (c.hotspots.unmatched > 100) unmatchedHsRows.push([{ text: `... and ${c.hotspots.unmatched - 100} more`, colSpan: 5, italics: true }, '', '', '', '']);
      nodes.push(smallTable(unmatchedHsRows, [80, 100, 30, 60, '*']));
    }

    // SC-Only Hotspots
    if (c.hotspots?.scOnlyHotspots?.length > 0) {
      nodes.push({ text: `SC-Only Hotspots — in SonarCloud but NOT in SonarQube (${c.hotspots.scOnlyHotspots.length})`, style: 'subheading' });
      const scOnlyHsRows = [[h('Rule'), h('File'), h('Line'), h('Status'), h('Message')]];
      for (const m of c.hotspots.scOnlyHotspots.slice(0, 100)) {
        scOnlyHsRows.push([m.rule, truncate(m.file, 30), String(m.line), m.status, truncate(m.message, 50)]);
      }
      if (c.hotspots.scOnlyHotspots.length > 100) scOnlyHsRows.push([{ text: `... and ${c.hotspots.scOnlyHotspots.length - 100} more`, colSpan: 5, italics: true }, '', '', '', '']);
      nodes.push(smallTable(scOnlyHsRows, [80, 100, 30, 60, '*']));
    }

    // Hotspot Status Mismatches
    if (c.hotspots?.statusMismatches?.length > 0) {
      nodes.push({ text: `Hotspot Status Mismatches (${c.hotspots.statusMismatches.length})`, style: 'subheading' });
      const hsStatusRows = [[h('Rule'), h('File'), h('Line'), h('SQ Status'), h('SC Status')]];
      for (const m of c.hotspots.statusMismatches.slice(0, 100)) {
        hsStatusRows.push([m.rule, truncate(m.file, 30), String(m.line), `${m.sqStatus}${m.sqResolution ? '/' + m.sqResolution : ''}`, `${m.scStatus}${m.scResolution ? '/' + m.scResolution : ''}`]);
      }
      if (c.hotspots.statusMismatches.length > 100) hsStatusRows.push([{ text: `... and ${c.hotspots.statusMismatches.length - 100} more`, colSpan: 5, italics: true }, '', '', '', '']);
      nodes.push(smallTable(hsStatusRows, [80, '*', 30, 80, 80]));
    }

    // Hotspot Comment Mismatches
    if (c.hotspots?.commentMismatches?.length > 0) {
      nodes.push({ text: `Hotspot Comment Mismatches (${c.hotspots.commentMismatches.length})`, style: 'subheading' });
      const hsCommentRows = [[h('Rule'), h('File'), h('SQ Comments'), h('SC Migrated')]];
      for (const m of c.hotspots.commentMismatches.slice(0, 100)) {
        hsCommentRows.push([m.rule, truncate(m.file, 35), String(m.sqCommentCount), String(m.scMigratedCommentCount)]);
      }
      if (c.hotspots.commentMismatches.length > 100) hsCommentRows.push([{ text: `... and ${c.hotspots.commentMismatches.length - 100} more`, colSpan: 4, italics: true }, '', '', '']);
      nodes.push(smallTable(hsCommentRows, [80, '*', 80, 80]));
    }

    // Unsyncable Hotspot Assignments (detail)
    if (c.hotspots?.unsyncable?.assignmentDetails?.length > 0) {
      nodes.push({ text: `Unsyncable Hotspot Assignment Diffs (${c.hotspots.unsyncable.assignments})`, style: 'subheading' });
      const hsAssignRows = [[h('Rule'), h('File'), h('SQ Assignee'), h('SC Assignee')]];
      for (const m of c.hotspots.unsyncable.assignmentDetails.slice(0, 50)) {
        hsAssignRows.push([m.rule, truncate(m.file, 35), m.sqAssignee || 'none', m.scAssignee || 'none']);
      }
      if (c.hotspots.unsyncable.assignments > 50) hsAssignRows.push([{ text: `... and ${c.hotspots.unsyncable.assignments - 50} more`, colSpan: 4, italics: true }, '', '', '']);
      nodes.push(smallTable(hsAssignRows, [80, '*', 100, 100]));
    }

    // ── BRANCH DETAILS ──

    if (c.branches?.missing?.length > 0) {
      nodes.push({ text: `Missing Branches (${c.branches.missing.length})`, style: 'subheading' });
      const branchList = c.branches.missing.map(b => ({ text: `• ${b}`, fontSize: 8 }));
      nodes.push({ ul: branchList, margin: [0, 0, 0, 5] });
    }

    // ── SETTINGS DETAILS ──

    if (c.settings?.mismatches?.length > 0) {
      nodes.push({ text: `Settings Mismatches (${c.settings.mismatches.length})`, style: 'subheading' });
      const settingsRows = [[h('Key'), h('SQ Value'), h('SC Value')]];
      for (const m of c.settings.mismatches) {
        settingsRows.push([m.key, truncate(String(m.sqValue ?? 'N/A'), 40), truncate(String(m.scValue ?? 'N/A'), 40)]);
      }
      nodes.push(smallTable(settingsRows, ['*', 120, 120]));
    }

    if (c.settings?.sqOnly?.length > 0) {
      nodes.push({ text: `Settings Only in SonarQube (${c.settings.sqOnly.length})`, style: 'subheading' });
      const sqSettingsRows = [[h('Key'), h('Value')]];
      for (const s of c.settings.sqOnly) {
        sqSettingsRows.push([s.key, truncate(String(s.value), 50)]);
      }
      nodes.push(smallTable(sqSettingsRows, ['*', 150]));
    }

    // ── PERMISSION DETAILS ──

    if (c.permissions?.mismatches?.length > 0) {
      nodes.push({ text: `Permission Mismatches (${c.permissions.mismatches.length} groups)`, style: 'subheading' });
      const permRows = [[h('Group'), h('Missing Permissions')]];
      for (const m of c.permissions.mismatches) {
        permRows.push([m.group || m.groupName, (m.missingPermissions || []).join(', ')]);
      }
      nodes.push(smallTable(permRows, [120, '*']));
    }

    // Add spacing between projects
    nodes.push({ text: '', margin: [0, 0, 0, 10] });
  }

  return nodes;
}

/** Create a table header cell */
function h(text) {
  return { text, style: 'tableHeader' };
}

/** Truncate text to maxLen characters */
function truncate(text, maxLen) {
  if (!text) return '';
  return text.length > maxLen ? text.slice(0, maxLen - 1) + '…' : text;
}

/** Create a small detail table node for the PDF */
function smallTable(rows, widths) {
  return {
    table: { headerRows: 1, widths, body: rows },
    layout: 'lightHorizontalLines',
    fontSize: 7,
    margin: [0, 0, 0, 5],
  };
}

function statusCell(status) {
  const styleMap = { pass: 'statusPass', fail: 'statusFail', skipped: 'statusSkip', error: 'statusWarn' };
  return { text: (status || '').toUpperCase(), style: styleMap[status] || 'tableCell' };
}
