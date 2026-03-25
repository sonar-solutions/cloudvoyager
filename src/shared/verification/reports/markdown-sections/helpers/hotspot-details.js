// -------- Hotspot Detail Sections --------

/**
 * Format hotspot-related detail sections.
 * @param {object} c - Project checks object
 * @param {string[]} lines - Array to push lines into
 */
export function formatHotspotDetails(c, lines) {
  formatUnmatchedSqHotspots(c, lines);
  formatScOnlyHotspots(c, lines);
  formatHotspotStatusMismatches(c, lines);
  formatHotspotCommentMismatches(c, lines);
  formatUnsyncableAssignments(c, lines);
}

function formatUnmatchedSqHotspots(c, lines) {
  if (!c.hotspots?.unmatchedSqHotspots?.length) return;
  lines.push(`<details><summary>Unmatched SQ Hotspots — in SonarQube but NOT in SonarCloud (${c.hotspots.unmatched})</summary>\n`);
  lines.push(`| Rule | File | Line | Status | Message |`);
  lines.push(`|------|------|------|--------|---------|`);
  for (const m of c.hotspots.unmatchedSqHotspots.slice(0, 200)) {
    lines.push(`| ${m.rule} | ${m.file} | ${m.line} | ${m.status} | ${m.message} |`);
  }
  if (c.hotspots.unmatched > 200) lines.push(`\n*... and ${c.hotspots.unmatched - 200} more*`);
  lines.push('\n</details>\n');
}

function formatScOnlyHotspots(c, lines) {
  if (!c.hotspots?.scOnlyHotspots?.length) return;
  lines.push(`<details><summary>SC-Only Hotspots — in SonarCloud but NOT in SonarQube (${c.hotspots.scOnlyHotspots.length})</summary>\n`);
  lines.push(`| Rule | File | Line | Status | Message |`);
  lines.push(`|------|------|------|--------|---------|`);
  for (const m of c.hotspots.scOnlyHotspots.slice(0, 200)) {
    lines.push(`| ${m.rule} | ${m.file} | ${m.line} | ${m.status} | ${m.message} |`);
  }
  if (c.hotspots.scOnlyHotspots.length > 200) lines.push(`\n*... and more*`);
  lines.push('\n</details>\n');
}

function formatHotspotStatusMismatches(c, lines) {
  if (!c.hotspots?.statusMismatches?.length) return;
  lines.push(`<details><summary>Hotspot Status Mismatches (${c.hotspots.statusMismatches.length})</summary>\n`);
  lines.push(`| Rule | File | Line | SQ Status | SC Status |`);
  lines.push(`|------|------|------|-----------|-----------|`);
  for (const m of c.hotspots.statusMismatches.slice(0, 200)) {
    lines.push(`| ${m.rule} | ${m.file} | ${m.line} | ${m.sqStatus}${m.sqResolution ? '/' + m.sqResolution : ''} | ${m.scStatus}${m.scResolution ? '/' + m.scResolution : ''} |`);
  }
  if (c.hotspots.statusMismatches.length > 200) lines.push(`\n*... and ${c.hotspots.statusMismatches.length - 200} more*`);
  lines.push('\n</details>\n');
}
