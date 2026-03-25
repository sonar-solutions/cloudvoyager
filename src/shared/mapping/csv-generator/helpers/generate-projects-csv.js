// -------- Generate Projects CSV --------
import { toCsvRow } from '../../csv-tables.js';
import { buildProjectRow } from './build-project-row.js';

export function generateProjectsCsv(data) {
  const { orgAssignments, projectBindings, projectMetadata, projectBranches } = data;
  const rows = [toCsvRow([
    'Include', 'Project Key', 'Project Name', 'Branch', 'Target Organization', 'ALM Platform',
    'Repository', 'Monorepo', 'Visibility', 'Last Analysis'
  ])];
  for (const assignment of orgAssignments) {
    for (const project of assignment.projects) {
      const binding = projectBindings?.get(project.key);
      const meta = projectMetadata?.get(project.key) || project;
      const branches = projectBranches?.get(project.key) || [];
      const projRows = buildProjectRow(project, assignment, binding, meta, branches);
      rows.push(...projRows);
    }
  }
  return rows.join('\n') + '\n';
}
