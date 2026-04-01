// -------- Format Profile Section --------

/** Format a single language/profile comparison section as markdown. */
export function formatProfileSection(langKey, diff) {
  const lines = [
    `## ${diff.sonarqubeProfile} → ${diff.sonarcloudProfile} (${langKey})\n`,
    `SonarQube rules: **${diff.sonarqubeRuleCount}** | SonarCloud rules: **${diff.sonarcloudRuleCount}**\n`,
  ];

  if (diff.missingRules.length > 0) {
    lines.push(`### Rules missing from SonarCloud (${diff.missingRules.length}) — issues will disappear\n`);
    lines.push('| Rule Key | Name | Type | Severity |');
    lines.push('|----------|------|------|----------|');
    for (const r of diff.missingRules) {
      lines.push(`| \`${r.key}\` | ${r.name} | ${r.type} | ${r.severity} |`);
    }
    lines.push('');
  }

  if (diff.addedRules.length > 0) {
    lines.push(`### Rules added in SonarCloud (${diff.addedRules.length}) — new issues may appear\n`);
    lines.push('| Rule Key | Name | Type | Severity |');
    lines.push('|----------|------|------|----------|');
    for (const r of diff.addedRules) {
      lines.push(`| \`${r.key}\` | ${r.name} | ${r.type} | ${r.severity} |`);
    }
    lines.push('');
  }

  if (diff.missingRules.length === 0 && diff.addedRules.length === 0) {
    lines.push('✅ Profiles are identical — no rule differences.\n');
  }

  return lines.join('\n');
}
