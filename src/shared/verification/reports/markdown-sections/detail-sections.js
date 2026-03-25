/**
 * Detail section formatters for per-project markdown report sections.
 * Builds the expandable detail tables for issues, measures, hotspots, branches, settings, permissions.
 */

/**
 * Format all detail sections for a single project's checks.
 * @param {object} c - The project's checks object
 * @param {string[]} lines - Array to push formatted lines into
 */
export function formatDetailSections(c, lines) {
  formatIssueDetails(c, lines);
  formatMeasureDetails(c, lines);
  formatHotspotDetails(c, lines);
  formatBranchDetails(c, lines);
  formatSettingsDetails(c, lines);
  formatPermissionDetails(c, lines);
}

function formatIssueDetails(c, lines) {
  // Issue Type Breakdown diff
  if (c.issues && (Object.keys(c.issues.typeBreakdown?.sq || {}).length > 0 || Object.keys(c.issues.typeBreakdown?.sc || {}).length > 0)) {
    const allTypes = [...new Set([...Object.keys(c.issues.typeBreakdown.sq || {}), ...Object.keys(c.issues.typeBreakdown.sc || {})])].sort();
    lines.push(`<details><summary>Issue Type Breakdown (SQ vs SC)</summary>\n`);
    lines.push(`| Type | SQ Count | SC Count | Delta |`);
    lines.push(`|------|----------|----------|-------|`);
    for (const type of allTypes) {
      const sq = c.issues.typeBreakdown.sq[type] || 0;
      const sc = c.issues.typeBreakdown.sc[type] || 0;
      const delta = sc - sq;
      const deltaStr = delta === 0 ? '0' : (delta > 0 ? `+${delta}` : `${delta}`);
      lines.push(`| ${type} | ${sq} | ${sc} | ${deltaStr} |`);
    }
    lines.push('\n</details>\n');
  }

  // Issue Severity Breakdown diff
  if (c.issues && (Object.keys(c.issues.severityBreakdown?.sq || {}).length > 0 || Object.keys(c.issues.severityBreakdown?.sc || {}).length > 0)) {
    const allSeverities = [...new Set([...Object.keys(c.issues.severityBreakdown.sq || {}), ...Object.keys(c.issues.severityBreakdown.sc || {})])].sort();
    lines.push(`<details><summary>Issue Severity Breakdown (SQ vs SC)</summary>\n`);
    lines.push(`| Severity | SQ Count | SC Count | Delta |`);
    lines.push(`|----------|----------|----------|-------|`);
    for (const sev of allSeverities) {
      const sq = c.issues.severityBreakdown.sq[sev] || 0;
      const sc = c.issues.severityBreakdown.sc[sev] || 0;
      const delta = sc - sq;
      const deltaStr = delta === 0 ? '0' : (delta > 0 ? `+${delta}` : `${delta}`);
      lines.push(`| ${sev} | ${sq} | ${sc} | ${deltaStr} |`);
    }
    lines.push('\n</details>\n');
  }

  // Unmatched SQ Issues (in SQ but not in SC)
  if (c.issues?.unmatchedSqIssues?.length > 0) {
    lines.push(`<details><summary>Unmatched SQ Issues — in SonarQube but NOT in SonarCloud (${c.issues.unmatched})</summary>\n`);
    lines.push(`| Rule | File | Line | Type | Severity | Message |`);
    lines.push(`|------|------|------|------|----------|---------|`);
    for (const m of c.issues.unmatchedSqIssues.slice(0, 200)) {
      lines.push(`| ${m.rule} | ${m.file} | ${m.line} | ${m.type} | ${m.severity} | ${m.message} |`);
    }
    if (c.issues.unmatched > 200) lines.push(`\n*... and ${c.issues.unmatched - 200} more*`);
    lines.push('\n</details>\n');
  }

  // SC-Only Issues (in SC but not in SQ)
  if (c.issues?.scOnlyIssues?.length > 0) {
    lines.push(`<details><summary>SC-Only Issues — in SonarCloud but NOT in SonarQube (${c.issues.scOnlyIssues.length})</summary>\n`);
    lines.push(`| Rule | File | Line | Type | Severity | Message |`);
    lines.push(`|------|------|------|------|----------|---------|`);
    for (const m of c.issues.scOnlyIssues.slice(0, 200)) {
      lines.push(`| ${m.rule} | ${m.file} | ${m.line} | ${m.type} | ${m.severity} | ${m.message} |`);
    }
    if (c.issues.scOnlyIssues.length > 200) lines.push(`\n*... and more*`);
    lines.push('\n</details>\n');
  }

  // Issue Status Mismatches
  if (c.issues?.statusMismatches?.length > 0) {
    lines.push(`<details><summary>Issue Status Mismatches (${c.issues.statusMismatches.length})</summary>\n`);
    lines.push(`| Rule | File | Line | SQ Status | SC Status |`);
    lines.push(`|------|------|------|-----------|-----------|`);
    for (const m of c.issues.statusMismatches.slice(0, 200)) {
      lines.push(`| ${m.rule} | ${m.file} | ${m.line} | ${m.sqStatus}${m.sqResolution ? '/' + m.sqResolution : ''} | ${m.scStatus}${m.scResolution ? '/' + m.scResolution : ''} |`);
    }
    if (c.issues.statusMismatches.length > 200) lines.push(`\n*... and ${c.issues.statusMismatches.length - 200} more*`);
    lines.push('\n</details>\n');
  }

  // Issue Status History Mismatches
  if (c.issues?.statusHistoryMismatches?.length > 0) {
    lines.push(`<details><summary>Issue Status History Mismatches (${c.issues.statusHistoryMismatches.length})</summary>\n`);
    lines.push(`| Rule | File | Line | SQ Transitions | SC Transitions | Missing |`);
    lines.push(`|------|------|------|----------------|----------------|---------|`);
    for (const m of c.issues.statusHistoryMismatches.slice(0, 200)) {
      lines.push(`| ${m.rule} | ${m.file} | ${m.line} | ${m.sqTransitions.join(' → ')} | ${m.scTransitions.join(' → ') || 'none'} | ${m.missingTransitions.join(', ')} |`);
    }
    if (c.issues.statusHistoryMismatches.length > 200) lines.push(`\n*... and ${c.issues.statusHistoryMismatches.length - 200} more*`);
    lines.push('\n</details>\n');
  }

  // Issue Assignment Mismatches
  if (c.issues?.assignmentMismatches?.length > 0) {
    lines.push(`<details><summary>Issue Assignment Mismatches (${c.issues.assignmentMismatches.length})</summary>\n`);
    lines.push(`| Rule | File | SQ Assignee | SC Assignee |`);
    lines.push(`|------|------|-------------|-------------|`);
    for (const m of c.issues.assignmentMismatches.slice(0, 200)) {
      lines.push(`| ${m.rule} | ${m.file} | ${m.sqAssignee || 'none'} | ${m.scAssignee || 'none'} |`);
    }
    if (c.issues.assignmentMismatches.length > 200) lines.push(`\n*... and ${c.issues.assignmentMismatches.length - 200} more*`);
    lines.push('\n</details>\n');
  }

  // Issue Comment Mismatches
  if (c.issues?.commentMismatches?.length > 0) {
    lines.push(`<details><summary>Issue Comment Mismatches (${c.issues.commentMismatches.length})</summary>\n`);
    lines.push(`| Rule | File | SQ Comments | SC Migrated Comments |`);
    lines.push(`|------|------|-------------|---------------------|`);
    for (const m of c.issues.commentMismatches.slice(0, 200)) {
      lines.push(`| ${m.rule} | ${m.file} | ${m.sqCommentCount} | ${m.scMigratedCommentCount} |`);
    }
    if (c.issues.commentMismatches.length > 200) lines.push(`\n*... and ${c.issues.commentMismatches.length - 200} more*`);
    lines.push('\n</details>\n');
  }

  // Issue Tag Mismatches
  if (c.issues?.tagMismatches?.length > 0) {
    lines.push(`<details><summary>Issue Tag Mismatches (${c.issues.tagMismatches.length})</summary>\n`);
    lines.push(`| Rule | File | SQ Tags | SC Tags |`);
    lines.push(`|------|------|---------|---------|`);
    for (const m of c.issues.tagMismatches.slice(0, 200)) {
      lines.push(`| ${m.rule} | ${m.file} | ${m.sqTags.join(', ')} | ${m.scTags.join(', ')} |`);
    }
    if (c.issues.tagMismatches.length > 200) lines.push(`\n*... and ${c.issues.tagMismatches.length - 200} more*`);
    lines.push('\n</details>\n');
  }

  // Unsyncable Type Changes (detail)
  if (c.issues?.unsyncable?.typeChangeDetails?.length > 0) {
    lines.push(`<details><summary>Unsyncable Issue Type Changes (${c.issues.unsyncable.typeChanges})</summary>\n`);
    lines.push(`| Rule | File | SQ Type | SC Type |`);
    lines.push(`|------|------|---------|---------|`);
    for (const m of c.issues.unsyncable.typeChangeDetails.slice(0, 100)) {
      lines.push(`| ${m.rule} | ${m.file} | ${m.sqType} | ${m.scType} |`);
    }
    if (c.issues.unsyncable.typeChanges > 100) lines.push(`\n*... and ${c.issues.unsyncable.typeChanges - 100} more*`);
    lines.push('\n</details>\n');
  }

  // Unsyncable Severity Changes (detail)
  if (c.issues?.unsyncable?.severityChangeDetails?.length > 0) {
    lines.push(`<details><summary>Unsyncable Issue Severity Changes (${c.issues.unsyncable.severityChanges})</summary>\n`);
    lines.push(`| Rule | File | SQ Severity | SC Severity |`);
    lines.push(`|------|------|-------------|-------------|`);
    for (const m of c.issues.unsyncable.severityChangeDetails.slice(0, 100)) {
      lines.push(`| ${m.rule} | ${m.file} | ${m.sqSeverity} | ${m.scSeverity} |`);
    }
    if (c.issues.unsyncable.severityChanges > 100) lines.push(`\n*... and ${c.issues.unsyncable.severityChanges - 100} more*`);
    lines.push('\n</details>\n');
  }
}

function formatMeasureDetails(c, lines) {
  // Measure Mismatches diff
  if (c.measures?.mismatches?.length > 0) {
    lines.push(`<details><summary>Measure Mismatches (${c.measures.mismatches.length})</summary>\n`);
    lines.push(`| Metric | SQ Value | SC Value | Delta |`);
    lines.push(`|--------|----------|----------|-------|`);
    for (const m of c.measures.mismatches) {
      const sqNum = parseFloat(m.sqValue);
      const scNum = parseFloat(m.scValue);
      let deltaStr = 'N/A';
      if (!isNaN(sqNum) && !isNaN(scNum)) {
        const delta = scNum - sqNum;
        deltaStr = delta === 0 ? '0' : (delta > 0 ? `+${delta}` : `${delta}`);
      }
      lines.push(`| ${m.metric} | ${m.sqValue} | ${m.scValue} | ${deltaStr} |`);
    }
    lines.push('\n</details>\n');
  }

  // Measures only in SQ
  if (c.measures?.sqOnly?.length > 0) {
    lines.push(`<details><summary>Measures Only in SonarQube (${c.measures.sqOnly.length})</summary>\n`);
    lines.push(`| Metric | SQ Value |`);
    lines.push(`|--------|----------|`);
    for (const m of c.measures.sqOnly) {
      lines.push(`| ${m.metric} | ${m.sqValue} |`);
    }
    lines.push('\n</details>\n');
  }

  // Measures only in SC
  if (c.measures?.scOnly?.length > 0) {
    lines.push(`<details><summary>Measures Only in SonarCloud (${c.measures.scOnly.length})</summary>\n`);
    lines.push(`| Metric | SC Value |`);
    lines.push(`|--------|----------|`);
    for (const m of c.measures.scOnly) {
      lines.push(`| ${m.metric} | ${m.scValue} |`);
    }
    lines.push('\n</details>\n');
  }
}

function formatHotspotDetails(c, lines) {
  // Unmatched SQ Hotspots
  if (c.hotspots?.unmatchedSqHotspots?.length > 0) {
    lines.push(`<details><summary>Unmatched SQ Hotspots — in SonarQube but NOT in SonarCloud (${c.hotspots.unmatched})</summary>\n`);
    lines.push(`| Rule | File | Line | Status | Message |`);
    lines.push(`|------|------|------|--------|---------|`);
    for (const m of c.hotspots.unmatchedSqHotspots.slice(0, 200)) {
      lines.push(`| ${m.rule} | ${m.file} | ${m.line} | ${m.status} | ${m.message} |`);
    }
    if (c.hotspots.unmatched > 200) lines.push(`\n*... and ${c.hotspots.unmatched - 200} more*`);
    lines.push('\n</details>\n');
  }

  // SC-Only Hotspots
  if (c.hotspots?.scOnlyHotspots?.length > 0) {
    lines.push(`<details><summary>SC-Only Hotspots — in SonarCloud but NOT in SonarQube (${c.hotspots.scOnlyHotspots.length})</summary>\n`);
    lines.push(`| Rule | File | Line | Status | Message |`);
    lines.push(`|------|------|------|--------|---------|`);
    for (const m of c.hotspots.scOnlyHotspots.slice(0, 200)) {
      lines.push(`| ${m.rule} | ${m.file} | ${m.line} | ${m.status} | ${m.message} |`);
    }
    if (c.hotspots.scOnlyHotspots.length > 200) lines.push(`\n*... and more*`);
    lines.push('\n</details>\n');
  }

  // Hotspot Status Mismatches
  if (c.hotspots?.statusMismatches?.length > 0) {
    lines.push(`<details><summary>Hotspot Status Mismatches (${c.hotspots.statusMismatches.length})</summary>\n`);
    lines.push(`| Rule | File | Line | SQ Status | SC Status |`);
    lines.push(`|------|------|------|-----------|-----------|`);
    for (const m of c.hotspots.statusMismatches.slice(0, 200)) {
      lines.push(`| ${m.rule} | ${m.file} | ${m.line} | ${m.sqStatus}${m.sqResolution ? '/' + m.sqResolution : ''} | ${m.scStatus}${m.scResolution ? '/' + m.scResolution : ''} |`);
    }
    if (c.hotspots.statusMismatches.length > 200) lines.push(`\n*... and ${c.hotspots.statusMismatches.length - 200} more*`);
    lines.push('\n</details>\n');
  }

  // Hotspot Comment Mismatches
  if (c.hotspots?.commentMismatches?.length > 0) {
    lines.push(`<details><summary>Hotspot Comment Mismatches (${c.hotspots.commentMismatches.length})</summary>\n`);
    lines.push(`| Rule | File | SQ Comments | SC Migrated Comments |`);
    lines.push(`|------|------|-------------|---------------------|`);
    for (const m of c.hotspots.commentMismatches.slice(0, 200)) {
      lines.push(`| ${m.rule} | ${m.file} | ${m.sqCommentCount} | ${m.scMigratedCommentCount} |`);
    }
    if (c.hotspots.commentMismatches.length > 200) lines.push(`\n*... and ${c.hotspots.commentMismatches.length - 200} more*`);
    lines.push('\n</details>\n');
  }

  // Unsyncable Hotspot Assignments (detail)
  if (c.hotspots?.unsyncable?.assignmentDetails?.length > 0) {
    lines.push(`<details><summary>Unsyncable Hotspot Assignment Diffs (${c.hotspots.unsyncable.assignments})</summary>\n`);
    lines.push(`| Rule | File | SQ Assignee | SC Assignee |`);
    lines.push(`|------|------|-------------|-------------|`);
    for (const m of c.hotspots.unsyncable.assignmentDetails.slice(0, 100)) {
      lines.push(`| ${m.rule} | ${m.file} | ${m.sqAssignee || 'none'} | ${m.scAssignee || 'none'} |`);
    }
    if (c.hotspots.unsyncable.assignments > 100) lines.push(`\n*... and ${c.hotspots.unsyncable.assignments - 100} more*`);
    lines.push('\n</details>\n');
  }
}

function formatBranchDetails(c, lines) {
  if (c.branches?.missing?.length > 0) {
    lines.push(`<details><summary>Missing Branches (${c.branches.missing.length})</summary>\n`);
    for (const b of c.branches.missing) {
      lines.push(`- ${b}`);
    }
    lines.push('\n</details>\n');
  }
}

function formatSettingsDetails(c, lines) {
  if (c.settings?.mismatches?.length > 0) {
    lines.push(`<details><summary>Settings Mismatches (${c.settings.mismatches.length})</summary>\n`);
    lines.push(`| Key | SQ Value | SC Value |`);
    lines.push(`|-----|----------|----------|`);
    for (const m of c.settings.mismatches) {
      lines.push(`| ${m.key} | ${m.sqValue ?? 'N/A'} | ${m.scValue ?? 'N/A'} |`);
    }
    lines.push('\n</details>\n');
  }

  if (c.settings?.sqOnly?.length > 0) {
    lines.push(`<details><summary>Settings Only in SonarQube (${c.settings.sqOnly.length})</summary>\n`);
    for (const s of c.settings.sqOnly) {
      lines.push(`- \`${s.key}\` = ${s.value}`);
    }
    lines.push('\n</details>\n');
  }
}

function formatPermissionDetails(c, lines) {
  if (c.permissions?.mismatches?.length > 0) {
    lines.push(`<details><summary>Permission Mismatches (${c.permissions.mismatches.length} groups)</summary>\n`);
    for (const m of c.permissions.mismatches) {
      lines.push(`- **${m.group || m.groupName}**: missing \`${(m.missingPermissions || []).join('`, `')}\``);
    }
    lines.push('\n</details>\n');
  }
}
