/**
 * Detail section builders for per-project PDF report sections.
 * Builds the detail tables for issues, measures, hotspots, branches, settings, permissions.
 */

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

/**
 * Build all detail section PDF nodes for a single project's checks.
 * @param {object} c - The project's checks object
 * @param {object[]} nodes - Array to push PDF nodes into
 */
export function buildDetailSections(c, nodes) {
  buildIssueDetails(c, nodes);
  buildMeasureDetails(c, nodes);
  buildHotspotDetails(c, nodes);
  buildBranchDetails(c, nodes);
  buildSettingsDetails(c, nodes);
  buildPermissionDetails(c, nodes);
}

function buildIssueDetails(c, nodes) {
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
}

function buildMeasureDetails(c, nodes) {
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
}

function buildHotspotDetails(c, nodes) {
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
}

function buildBranchDetails(c, nodes) {
  if (c.branches?.missing?.length > 0) {
    nodes.push({ text: `Missing Branches (${c.branches.missing.length})`, style: 'subheading' });
    const branchList = c.branches.missing.map(b => ({ text: `• ${b}`, fontSize: 8 }));
    nodes.push({ ul: branchList, margin: [0, 0, 0, 5] });
  }
}

function buildSettingsDetails(c, nodes) {
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
}

function buildPermissionDetails(c, nodes) {
  if (c.permissions?.mismatches?.length > 0) {
    nodes.push({ text: `Permission Mismatches (${c.permissions.mismatches.length} groups)`, style: 'subheading' });
    const permRows = [[h('Group'), h('Missing Permissions')]];
    for (const m of c.permissions.mismatches) {
      permRows.push([m.group || m.groupName, (m.missingPermissions || []).join(', ')]);
    }
    nodes.push(smallTable(permRows, [120, '*']));
  }
}
