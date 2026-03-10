import { statusStyle, statusText } from './pdf-helpers.js';

export function buildServerSteps(results) {
  if (results.serverSteps.length === 0) return [];
  const body = [
    [
      { text: 'Step', style: 'tableHeader' },
      { text: 'Status', style: 'tableHeader' },
      { text: 'Detail', style: 'tableHeader' },
    ],
  ];
  for (const step of results.serverSteps) {
    body.push([
      { text: step.step, style: 'tableCell' },
      { text: statusText(step.status), style: statusStyle(step.status) },
      { text: step.detail || step.error || '', style: 'tableCell' },
    ]);
  }
  return [
    { text: 'Server-Wide Steps', style: 'heading' },
    { table: { headerRows: 1, widths: ['*', 50, '*'], body }, layout: 'lightHorizontalLines' },
  ];
}

export function buildOrgResults(results) {
  if (!results.orgResults || results.orgResults.length === 0) return [];
  const nodes = [];
  for (const org of results.orgResults) {
    nodes.push({ text: `Organization: ${org.key} (${org.projectCount} projects)`, style: 'heading' });
    if (org.steps && org.steps.length > 0) {
      const body = [
        [
          { text: 'Step', style: 'tableHeader' },
          { text: 'Status', style: 'tableHeader' },
          { text: 'Detail', style: 'tableHeader' },
        ],
      ];
      for (const step of org.steps) {
        body.push([
          { text: step.step, style: 'tableCell' },
          { text: statusText(step.status), style: statusStyle(step.status) },
          { text: step.detail || step.error || '', style: 'tableCell' },
        ]);
      }
      nodes.push({ table: { headerRows: 1, widths: ['*', 50, '*'], body }, layout: 'lightHorizontalLines' });
    }
  }
  return nodes;
}

export function buildProblemProjects(results) {
  const problemProjects = results.projects.filter(p => p.status !== 'success');
  if (problemProjects.length === 0) return [];
  const nodes = [{ text: 'Failed / Partial Projects', style: 'heading' }];
  for (const project of problemProjects) {
    const label = project.status === 'failed' ? 'FAIL' : 'PARTIAL';
    nodes.push({ text: `[${label}] ${project.projectKey} -> ${project.scProjectKey}`, style: 'subheading' });
    const body = [
      [
        { text: 'Step', style: 'tableHeader' },
        { text: 'Status', style: 'tableHeader' },
        { text: 'Detail', style: 'tableHeader' },
      ],
    ];
    for (const step of project.steps) {
      body.push([
        { text: step.step, style: 'tableCell' },
        { text: statusText(step.status), style: statusStyle(step.status) },
        { text: step.error || step.detail || '', style: 'tableCell' },
      ]);
    }
    nodes.push({ table: { headerRows: 1, widths: ['*', 50, '*'], body }, layout: 'lightHorizontalLines' });
  }
  return nodes;
}

export function buildFailedAssignments(results) {
  const failures = results.issueSyncStats.failedAssignments || [];
  if (failures.length === 0) return [];
  const body = [
    [
      { text: 'Issue Key', style: 'tableHeader' },
      { text: 'SQ Assignee', style: 'tableHeader' },
      { text: 'Error', style: 'tableHeader' },
    ],
  ];
  for (const f of failures) {
    body.push([
      { text: f.issueKey, style: 'tableCell' },
      { text: f.assignee, style: 'tableCell' },
      { text: f.error, style: 'tableCell', fontSize: 8 },
    ]);
  }
  return [
    { text: 'Failed Issue Assignments', style: 'heading' },
    { text: `${failures.length} issue(s) could not be assigned because the SonarQube assignee login does not match a valid SonarCloud user.`, style: 'small', margin: [0, 0, 0, 5] },
    { table: { headerRows: 1, widths: ['*', 100, '*'], body }, layout: 'lightHorizontalLines' },
  ];
}

export function buildAllProjects(results) {
  if (results.projects.length === 0) return [];
  const body = [
    [
      { text: '#', style: 'tableHeader' },
      { text: 'Project Key', style: 'tableHeader' },
      { text: 'LOC', style: 'tableHeader' },
      { text: 'Status', style: 'tableHeader' },
      { text: 'Failed Steps', style: 'tableHeader' },
    ],
  ];
  results.projects.forEach((project, i) => {
    const failedSteps = project.steps.filter(s => s.status === 'failed');
    const loc = project.linesOfCode > 0 ? Number(project.linesOfCode).toLocaleString('en-US') : '—';
    body.push([
      { text: String(i + 1), style: 'tableCell' },
      { text: project.projectKey, style: 'tableCell' },
      { text: loc, style: 'tableCell' },
      { text: statusText(project.status), style: statusStyle(project.status) },
      { text: failedSteps.map(s => s.step).join(', '), style: 'tableCell' },
    ]);
  });
  return [
    { text: 'All Projects', style: 'heading', pageBreak: results.projects.length > 20 ? 'before' : undefined },
    { table: { headerRows: 1, widths: [25, '*', 55, 55, '*'], body }, layout: 'lightHorizontalLines' },
  ];
}
