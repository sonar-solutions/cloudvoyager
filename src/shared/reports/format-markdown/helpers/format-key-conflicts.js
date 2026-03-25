// -------- Format Key Conflicts --------

export function formatKeyConflicts(results) {
  const keyWarnings = results.projectKeyWarnings || [];
  if (keyWarnings.length === 0) return null;
  const lines = [
    '## Project Key Conflicts\n',
    `> **${keyWarnings.length} project(s)** could not use the original SonarQube key because the key is already taken by another organization on SonarCloud. The migration tool falls back to a prefixed key (\`{org}_{key}\`).\n`,
    '| SonarQube Key | SonarCloud Key | Taken By |',
    '|---------------|----------------|----------|',
  ];
  for (const w of keyWarnings) {
    lines.push(`| \`${w.sqKey}\` | \`${w.scKey}\` | ${w.owner} |`);
  }
  lines.push('');
  return lines.join('\n');
}
