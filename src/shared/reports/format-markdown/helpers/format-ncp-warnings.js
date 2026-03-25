// -------- Format New Code Period Warnings --------
import { getNewCodePeriodSkippedProjects } from '../../shared.js';

export function formatNewCodePeriodWarnings(results) {
  const ncpSkipped = getNewCodePeriodSkippedProjects(results);
  if (ncpSkipped.length === 0) return null;
  const lines = [
    '## New Code Period Not Set\n',
    `> **${ncpSkipped.length} project(s)** use unsupported new code period types (e.g. \`REFERENCE_BRANCH\`) that cannot be migrated to SonarCloud. Please configure these manually.\n`,
    '| Project | Reason |',
    '|---------|--------|',
  ];
  for (const { projectKey, detail } of ncpSkipped) {
    lines.push(`| \`${projectKey}\` | ${detail} |`);
  }
  lines.push('');
  return lines.join('\n');
}
