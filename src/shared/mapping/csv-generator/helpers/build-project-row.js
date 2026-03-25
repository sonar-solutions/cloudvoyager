// -------- Build Project CSV Row(s) --------
import { toCsvRow } from '../../csv-tables.js';

export function buildProjectRow(project, assignment, binding, meta, branches) {
  const rows = [];
  const base = [
    meta.name || project.name || project.key,
    assignment.org.key,
    binding?.alm || 'none',
    binding?.repository || '',
    binding?.monorepo || false,
    meta.visibility || 'public',
    meta.lastAnalysisDate || ''
  ];

  if (branches.length > 0) {
    const sorted = [...branches].sort((a, b) => {
      if (a.isMain && !b.isMain) return -1;
      if (!a.isMain && b.isMain) return 1;
      return a.name.localeCompare(b.name);
    });
    for (const branch of sorted) {
      rows.push(toCsvRow(['yes', project.key, base[0], branch.name, ...base.slice(1)]));
    }
  } else {
    rows.push(toCsvRow(['yes', project.key, base[0], '', ...base.slice(1)]));
  }
  return rows;
}
