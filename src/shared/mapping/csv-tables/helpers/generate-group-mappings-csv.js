// -------- Generate Group Mappings CSV --------
import { toCsvRow } from './csv-utils.js';

export function generateGroupMappingsCsv(data) {
  const { resourceMappings } = data;
  const rows = [toCsvRow(['Include', 'Group Name', 'Description', 'Members Count', 'Is Default', 'Target Organization'])];
  if (resourceMappings?.groupsByOrg) {
    for (const [orgKey, groups] of resourceMappings.groupsByOrg) {
      for (const group of groups) {
        rows.push(toCsvRow(['yes', group.name, group.description || '', group.membersCount || 0, group.default || false, orgKey]));
      }
    }
  }
  return rows.join('\n') + '\n';
}
