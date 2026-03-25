// -------- Format Warnings and Risks --------
import { getNewCodePeriodSkippedProjects } from '../../shared.js';

export function formatWarningsAndRisks(results, stats) {
  const keyWarnings = results.projectKeyWarnings || [];
  const ncpSkipped = getNewCodePeriodSkippedProjects(results);
  const assignmentFailed = results.issueSyncStats.assignmentFailed || 0;
  if (keyWarnings.length === 0 && ncpSkipped.length === 0 && stats.failed === 0 && assignmentFailed === 0) {
    return '## Warnings & Risks\n\nNo warnings or risks identified.\n';
  }
  const lines = ['## Warnings & Risks\n'];
  if (keyWarnings.length > 0) {
    lines.push('### Project Key Conflicts\n');
    lines.push(`**${keyWarnings.length} project(s)** required a renamed key on SonarCloud due to global key conflicts. This may affect CI/CD pipeline configurations that reference the original project key.\n`);
  }
  if (ncpSkipped.length > 0) {
    lines.push('### New Code Period Configuration\n');
    lines.push(`**${ncpSkipped.length} project(s)** have unsupported new code period types (e.g. \`REFERENCE_BRANCH\`) and require manual configuration in SonarCloud.\n`);
  }
  if (stats.failed > 0) {
    lines.push('### Failed Projects\n');
    lines.push(`**${stats.failed} project(s)** failed to migrate entirely. Review the detailed migration report for root cause analysis.\n`);
  }
  if (stats.partial > 0) {
    lines.push('### Partially Migrated Projects\n');
    lines.push(`**${stats.partial} project(s)** had one or more steps fail. These projects may need manual intervention to complete migration.\n`);
  }
  if (assignmentFailed > 0) {
    lines.push('### Failed Issue Assignments\n');
    lines.push(`**${assignmentFailed} issue(s)** could not be assigned because the SonarQube assignee login does not match a valid SonarCloud user. These issues need manual assignment.\n`);
  }
  return lines.join('\n');
}
