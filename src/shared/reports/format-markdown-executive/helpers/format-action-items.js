// -------- Format Action Items --------
import { getNewCodePeriodSkippedProjects } from '../../shared.js';

export function formatActionItems(results, stats) {
  const keyWarnings = results.projectKeyWarnings || [];
  const ncpSkipped = getNewCodePeriodSkippedProjects(results);
  const items = [];
  if (keyWarnings.length > 0) items.push(`- [ ] Update CI/CD pipelines for renamed project keys (${keyWarnings.length} project(s))`);
  if (ncpSkipped.length > 0) items.push(`- [ ] Manually configure new code periods in SonarCloud (${ncpSkipped.length} project(s))`);
  if (stats.failed > 0) items.push(`- [ ] Investigate and retry failed project migrations (${stats.failed} project(s))`);
  if (stats.partial > 0) items.push(`- [ ] Review partially migrated projects and fix failed steps (${stats.partial} project(s))`);
  const assignmentFailedCount = results.issueSyncStats.assignmentFailed || 0;
  if (assignmentFailedCount > 0) items.push(`- [ ] Manually assign issues where automatic assignment failed (${assignmentFailedCount} issue(s))`);
  items.push('- [ ] Review quality profile rule gaps in `quality-profiles/quality-profile-diff.json`');
  items.push('- [ ] Verify project permissions in SonarCloud dashboard');
  return ['## Action Items\n', ...items, ''].join('\n');
}
