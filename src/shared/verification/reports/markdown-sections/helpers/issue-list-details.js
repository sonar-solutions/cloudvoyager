// -------- Issue List Detail Sections --------

export { formatHistoryMismatches } from './issue-list-details/format-history-mismatches.js';

export function formatUnmatchedSqIssues(c, lines) {
  if (!c.issues?.unmatchedSqIssues?.length) return;
  lines.push(`<details><summary>Unmatched SQ Issues — in SonarQube but NOT in SonarCloud (${c.issues.unmatched})</summary>\n`);
  lines.push(`| Rule | File | Line | Type | Severity | Message |`);
  lines.push(`|------|------|------|------|----------|---------|`);
  for (const m of c.issues.unmatchedSqIssues.slice(0, 200)) {
    lines.push(`| ${m.rule} | ${m.file} | ${m.line} | ${m.type} | ${m.severity} | ${m.message} |`);
  }
  if (c.issues.unmatched > 200) lines.push(`\n*... and ${c.issues.unmatched - 200} more*`);
  lines.push('\n</details>\n');
}

export function formatScOnlyIssues(c, lines) {
  if (!c.issues?.scOnlyIssues?.length) return;
  lines.push(`<details><summary>SC-Only Issues — in SonarCloud but NOT in SonarQube (${c.issues.scOnlyIssues.length})</summary>\n`);
  lines.push(`| Rule | File | Line | Type | Severity | Message |`);
  lines.push(`|------|------|------|------|----------|---------|`);
  for (const m of c.issues.scOnlyIssues.slice(0, 200)) {
    lines.push(`| ${m.rule} | ${m.file} | ${m.line} | ${m.type} | ${m.severity} | ${m.message} |`);
  }
  if (c.issues.scOnlyIssues.length > 200) lines.push(`\n*... and more*`);
  lines.push('\n</details>\n');
}

export function formatCreationDateMismatches(c, lines) {
  if (!c.issues?.creationDateMismatches?.length) return;
  lines.push(`<details><summary>Issue Creation Date Mismatches (${c.issues.creationDateMismatches.length})</summary>\n`);
  lines.push(`| Rule | File | Line | SQ Creation Date | SC Creation Date |`);
  lines.push(`|------|------|------|------------------|------------------|`);
  for (const m of c.issues.creationDateMismatches.slice(0, 200)) {
    lines.push(`| ${m.rule} | ${m.file} | ${m.line} | ${m.sqCreationDate} | ${m.scCreationDate} |`);
  }
  if (c.issues.creationDateMismatches.length > 200) lines.push(`\n*... and ${c.issues.creationDateMismatches.length - 200} more*`);
  lines.push('\n</details>\n');
}

export function formatStatusMismatches(c, lines) {
  if (!c.issues?.statusMismatches?.length) return;
  lines.push(`<details><summary>Issue Status Mismatches (${c.issues.statusMismatches.length})</summary>\n`);
  lines.push(`| Rule | File | Line | SQ Status | SC Status |`);
  lines.push(`|------|------|------|-----------|-----------|`);
  for (const m of c.issues.statusMismatches.slice(0, 200)) {
    lines.push(`| ${m.rule} | ${m.file} | ${m.line} | ${m.sqStatus}${m.sqResolution ? '/' + m.sqResolution : ''} | ${m.scStatus}${m.scResolution ? '/' + m.scResolution : ''} |`);
  }
  if (c.issues.statusMismatches.length > 200) lines.push(`\n*... and ${c.issues.statusMismatches.length - 200} more*`);
  lines.push('\n</details>\n');
}
