// -------- Filter Template Permission Rows --------
import { isIncluded } from '../../csv-reader.js';

export function filterTemplatePermissions(rows) {
  const permRows = rows.filter(r => r['Permission Key']);
  const permGroupMap = new Map();

  for (const pr of permRows) {
    if (!isIncluded(pr['Include'])) continue;
    const key = pr['Permission Key'];
    if (!permGroupMap.has(key)) permGroupMap.set(key, []);
    permGroupMap.get(key).push(pr['Group Name']);
  }

  const newPermissions = [];
  for (const [key, groups] of permGroupMap) {
    newPermissions.push({ key, groupsCount: groups.length, groups });
  }
  return newPermissions;
}
