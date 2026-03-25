// -------- Format Overall Status --------

export function formatOverallStatus(stats, overallStatus) {
  const successRate = stats.total > 0
    ? ((stats.succeeded / stats.total) * 100).toFixed(1) : '0.0';
  const lines = [`## Overall Status: ${overallStatus}\n`];
  if (stats.total === 0) {
    lines.push('No projects were migrated.\n');
  } else if (stats.failed === 0 && stats.partial === 0) {
    lines.push(`Migration of **${stats.total} project(s)** completed with a **${successRate}% success rate**.\n`);
  } else {
    lines.push(`Migration of **${stats.total} project(s)** completed with **${stats.succeeded} fully migrated** (${successRate}% success rate).\n`);
    if (stats.partial > 0) lines.push(`- ${stats.partial} project(s) partially migrated (some steps failed)`);
    if (stats.failed > 0) lines.push(`- ${stats.failed} project(s) failed entirely`);
    lines.push('');
  }
  return lines.join('\n');
}
