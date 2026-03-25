// -------- Build Per-Project Branch Include Map --------
import { isIncluded } from '../../csv-reader.js';

export function buildProjectBranchIncludes(rows) {
  const rowsByProject = new Map();
  for (const row of rows) {
    const pk = row['Project Key'];
    if (!rowsByProject.has(pk)) rowsByProject.set(pk, []);
    rowsByProject.get(pk).push(row);
  }

  const excludedKeys = new Set();
  const projectBranchIncludes = new Map();

  for (const [projectKey, projRows] of rowsByProject) {
    const included = new Set();
    const excluded = new Set();
    for (const row of projRows) {
      const branch = row['Branch'] || '';
      if (isIncluded(row['Include'])) { if (branch) included.add(branch); }
      else { if (branch) excluded.add(branch); }
    }
    if (included.size === 0) excludedKeys.add(projectKey);
    else if (excluded.size > 0) projectBranchIncludes.set(projectKey, included);
  }

  return { excludedKeys, projectBranchIncludes };
}
