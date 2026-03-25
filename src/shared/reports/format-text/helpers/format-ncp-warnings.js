// -------- Format New Code Period Warnings --------
import { getNewCodePeriodSkippedProjects } from '../../shared.js';

export function formatNewCodePeriodWarnings(lines, results, subsep) {
  const ncpSkipped = getNewCodePeriodSkippedProjects(results);
  if (ncpSkipped.length === 0) return;
  lines.push(
    'NEW CODE PERIOD NOT SET', subsep,
    `  ${ncpSkipped.length} project(s) use unsupported new code period types (e.g. REFERENCE_BRANCH)`,
    '  that cannot be migrated to SonarCloud. The new code period for these projects',
    '  was NOT set — please configure it manually in SonarCloud.', '',
  );
  for (const { projectKey, detail } of ncpSkipped) {
    lines.push(`  [SKIP] ${projectKey}: ${detail}`);
  }
  lines.push('');
}
