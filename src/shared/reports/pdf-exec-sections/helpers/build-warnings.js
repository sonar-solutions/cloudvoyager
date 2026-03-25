// -------- Build Warnings --------
import { getNewCodePeriodSkippedProjects } from '../../shared.js';

export function buildWarnings(results, stats) {
  const keyWarnings = results.projectKeyWarnings || [];
  const ncpSkipped = getNewCodePeriodSkippedProjects(results);
  if (keyWarnings.length === 0 && ncpSkipped.length === 0 && stats.failed === 0 && stats.partial === 0) {
    return [
      { text: 'Warnings & Risks', style: 'heading' },
      { text: 'No warnings or risks identified.', style: 'bodyText' },
    ];
  }
  const nodes = [{ text: 'Warnings & Risks', style: 'heading' }];
  if (keyWarnings.length > 0) {
    nodes.push({ text: 'Project Key Conflicts', style: 'subheading' });
    nodes.push({ text: `${keyWarnings.length} project(s) required a renamed key on SonarCloud due to global key conflicts. This may affect CI/CD pipeline configurations.`, style: 'bodyText' });
  }
  if (ncpSkipped.length > 0) {
    nodes.push({ text: 'New Code Period Configuration', style: 'subheading' });
    nodes.push({ text: `${ncpSkipped.length} project(s) have unsupported new code period types and require manual configuration in SonarCloud.`, style: 'bodyText' });
  }
  if (stats.failed > 0) {
    nodes.push({ text: 'Failed Projects', style: 'subheading' });
    nodes.push({ text: `${stats.failed} project(s) failed to migrate entirely. Review the detailed migration report for root cause analysis.`, style: 'bodyText' });
  }
  if (stats.partial > 0) {
    nodes.push({ text: 'Partially Migrated Projects', style: 'subheading' });
    nodes.push({ text: `${stats.partial} project(s) had one or more steps fail. These may need manual intervention.`, style: 'bodyText' });
  }
  return nodes;
}
