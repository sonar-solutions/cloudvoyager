// -------- Format Rule Diff Tables --------

/** Format the onlyInSQ and onlyInSC rule lists as markdown tables. */
export function formatRuleDiffTables(onlyInSQ, onlyInSC) {
  const lines = [];

  if (onlyInSQ.length > 0) {
    lines.push(`## Rules Only in SonarQube (${onlyInSQ.length}) — not available in SonarCloud\n`);
    lines.push('| Rule ID | Name | Language | Type | Severity |');
    lines.push('|---------|------|----------|------|----------|');
    for (const r of onlyInSQ) {
      lines.push(`| \`${r.key}\` | ${r.name} | ${r.lang} | ${r.type} | ${r.severity} |`);
    }
    lines.push('');
  }

  if (onlyInSC.length > 0) {
    lines.push(`## Rules Only in SonarCloud (${onlyInSC.length}) — not available in SonarQube\n`);
    lines.push('| Rule ID | Name | Language | Type | Severity |');
    lines.push('|---------|------|----------|------|----------|');
    for (const r of onlyInSC) {
      lines.push(`| \`${r.key}\` | ${r.name} | ${r.lang} | ${r.type} | ${r.severity} |`);
    }
    lines.push('');
  }

  if (onlyInSQ.length === 0 && onlyInSC.length === 0) {
    lines.push('## All rules match perfectly — no differences found.\n');
  }

  return lines;
}
