// -------- Build NCP Warnings --------
import { getNewCodePeriodSkippedProjects } from '../../shared.js';

export function buildNcpWarnings(results) {
  const ncpSkipped = getNewCodePeriodSkippedProjects(results);
  if (ncpSkipped.length === 0) return [];
  const body = [
    [{ text: 'Project', style: 'tableHeader' }, { text: 'Reason', style: 'tableHeader' }],
  ];
  for (const { projectKey, detail } of ncpSkipped) {
    body.push([projectKey, { text: detail, fontSize: 8 }]);
  }
  return [
    { text: 'New Code Period Not Set', style: 'heading' },
    { text: `${ncpSkipped.length} project(s) use unsupported new code period types. Please configure these manually in SonarCloud.`, style: 'small', margin: [0, 0, 0, 5] },
    { table: { headerRows: 1, widths: [150, '*'], body }, layout: 'lightHorizontalLines' },
  ];
}
