// -------- Branch, Settings, Permission Details --------

/**
 * Format branch detail sections.
 */
export function formatBranchDetails(c, lines) {
  if (!c.branches?.missing?.length) return;
  lines.push(`<details><summary>Missing Branches (${c.branches.missing.length})</summary>\n`);
  for (const b of c.branches.missing) lines.push(`- ${b}`);
  lines.push('\n</details>\n');
}

/**
 * Format settings detail sections.
 */
export function formatSettingsDetails(c, lines) {
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
    for (const s of c.settings.sqOnly) lines.push(`- \`${s.key}\` = ${s.value}`);
    lines.push('\n</details>\n');
  }
}

/**
 * Format permission detail sections.
 */
export function formatPermissionDetails(c, lines) {
  if (!c.permissions?.mismatches?.length) return;
  lines.push(`<details><summary>Permission Mismatches (${c.permissions.mismatches.length} groups)</summary>\n`);
  for (const m of c.permissions.mismatches) {
    lines.push(`- **${m.group || m.groupName}**: missing \`${(m.missingPermissions || []).join('`, `')}\``);
  }
  lines.push('\n</details>\n');
}
