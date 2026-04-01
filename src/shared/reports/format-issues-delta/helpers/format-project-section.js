// -------- Format Project Section --------

/** Format a single project's issues delta as a markdown section. */
export function formatProjectSection(project) {
  const lines = [
    `## ${project.sqProjectKey} → ${project.scProjectKey}\n`,
    `SonarQube issues: **${project.sqIssueCount}** | SonarCloud issues: **${project.scIssueCount}**\n`,
  ];

  if (project.onlyInSQ.length > 0) {
    lines.push(`### Disappeared (${project.onlyInSQ.length}) — in SonarQube, not in SonarCloud\n`);
    lines.push('| Rule | File:Line | Severity | Message |');
    lines.push('|------|-----------|----------|---------|');
    for (const i of project.onlyInSQ) {
      const file = i.component?.split(':').pop() || '';
      const msg = (i.message || '').substring(0, 80);
      lines.push(`| \`${i.rule}\` | ${file}:${i.line ?? '—'} | ${i.severity} | ${msg} |`);
    }
    lines.push('');
  }

  if (project.onlyInSC.length > 0) {
    lines.push(`### Appeared (${project.onlyInSC.length}) — in SonarCloud, not in SonarQube\n`);
    lines.push('| Rule | File:Line | Severity | Message |');
    lines.push('|------|-----------|----------|---------|');
    for (const i of project.onlyInSC) {
      const file = i.component?.split(':').pop() || '';
      const msg = (i.message || '').substring(0, 80);
      lines.push(`| \`${i.rule}\` | ${file}:${i.line ?? '—'} | ${i.severity} | ${msg} |`);
    }
    lines.push('');
  }

  if (Object.keys(project.byRule).length > 0) {
    lines.push('### Per-Rule Breakdown\n');
    lines.push('| Rule | Disappeared | Appeared |');
    lines.push('|------|-------------|----------|');
    for (const [rule, counts] of Object.entries(project.byRule)) {
      lines.push(`| \`${rule}\` | ${counts.disappeared} | ${counts.appeared} |`);
    }
    lines.push('');
  }

  if (project.onlyInSQ.length === 0 && project.onlyInSC.length === 0) {
    lines.push('✅ Issues match perfectly — no differences found.\n');
  }

  return lines.join('\n');
}
