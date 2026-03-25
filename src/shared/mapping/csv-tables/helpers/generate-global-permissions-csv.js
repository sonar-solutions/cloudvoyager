// -------- Generate Global Permissions CSV --------
import { toCsvRow } from './csv-utils.js';

export function generateGlobalPermissionsCsv(data) {
  const { extractedData } = data;
  const rows = [toCsvRow(['Include', 'Group Name', 'Permission'])];
  const globalPermissions = extractedData?.globalPermissions || [];
  for (const group of globalPermissions) {
    if (group.permissions) {
      for (const permission of group.permissions) {
        rows.push(toCsvRow(['yes', group.name, permission]));
      }
    }
  }
  return rows.join('\n') + '\n';
}
