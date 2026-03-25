// -------- Generate Organizations CSV --------
import { toCsvRow } from '../../csv-tables.js';

export function generateOrganizationsCsv(data) {
  const { orgAssignments } = data;
  const rows = [toCsvRow(['Include', 'Target Organization', 'Binding Group', 'ALM Platform', 'Projects Count'])];
  for (const assignment of orgAssignments) {
    if (assignment.bindingGroups.length > 0) {
      for (const group of assignment.bindingGroups) {
        rows.push(toCsvRow(['yes', assignment.org.key, group.identifier, group.alm, group.projects.length]));
      }
    }
    const boundKeys = new Set(assignment.bindingGroups.flatMap(g => g.projects.map(p => p.key)));
    const unbound = assignment.projects.filter(p => !boundKeys.has(p.key));
    if (unbound.length > 0) {
      rows.push(toCsvRow(['yes', assignment.org.key, '(no binding)', 'none', unbound.length]));
    }
  }
  return rows.join('\n') + '\n';
}
