// -------- Format Key Conflicts --------

export function formatKeyConflicts(lines, results, subsep) {
  const keyWarnings = results.projectKeyWarnings || [];
  if (keyWarnings.length === 0) return;
  lines.push(
    'PROJECT KEY CONFLICTS', subsep,
    `  ${keyWarnings.length} project(s) could not use the original SonarQube key because`,
    '  the key is already taken by another organization on SonarCloud.',
    '  The migration tool uses the original SonarQube project key by default.',
    '  When a conflict is detected, it falls back to a prefixed key ({org}_{key}).', '',
  );
  for (const w of keyWarnings) {
    lines.push(`  [WARN] "${w.sqKey}" -> "${w.scKey}" (taken by org "${w.owner}")`);
  }
  lines.push('');
}
