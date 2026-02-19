import { getNewCodePeriodSkippedProjects } from './shared.js';

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

export function buildActionItems(results, stats) {
  const keyWarnings = results.projectKeyWarnings || [];
  const ncpSkipped = getNewCodePeriodSkippedProjects(results);
  const items = [];
  if (keyWarnings.length > 0) items.push(`Update CI/CD pipelines for renamed project keys (${keyWarnings.length} project(s))`);
  if (ncpSkipped.length > 0) items.push(`Manually configure new code periods in SonarCloud (${ncpSkipped.length} project(s))`);
  if (stats.failed > 0) items.push(`Investigate and retry failed project migrations (${stats.failed} project(s))`);
  if (stats.partial > 0) items.push(`Review partially migrated projects and fix failed steps (${stats.partial} project(s))`);
  items.push('Review quality profile rule gaps in quality-profiles/quality-profile-diff.json');
  items.push('Verify project permissions in SonarCloud dashboard');
  const nodes = [{ text: 'Action Items', style: 'heading' }];
  items.forEach((item, i) => { nodes.push({ text: `${i + 1}. ${item}`, style: 'actionItem' }); });
  return nodes;
}

export function buildFailedProjects(results) {
  const failedProjects = results.projects.filter(p => p.status === 'failed');
  if (failedProjects.length === 0) return [];
  const body = [
    [{ text: 'Project Key', style: 'tableHeader' }, { text: 'Failed Steps', style: 'tableHeader' }],
  ];
  for (const project of failedProjects) {
    const failedSteps = project.steps.filter(s => s.status === 'failed');
    body.push([project.projectKey, failedSteps.map(s => s.step).join(', ')]);
  }
  return [
    { text: 'Failed Projects', style: 'heading' },
    { table: { headerRows: 1, widths: [200, '*'], body }, layout: 'lightHorizontalLines' },
  ];
}
