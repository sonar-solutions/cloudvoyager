// -------- Apply Global Permissions CSV Filter --------
import { isIncluded } from '../../csv-reader.js';
import logger from '../../../utils/logger.js';

export function applyGlobalPermissionsCsv(csvData, globalPermissions) {
  if (!globalPermissions) return globalPermissions;

  const excludedTuples = new Set();
  for (const row of csvData.rows) {
    if (!isIncluded(row['Include'])) excludedTuples.add(`${row['Group Name']}::${row['Permission']}`);
  }
  if (excludedTuples.size === 0) return globalPermissions;

  logger.info(`CSV override: excluding ${excludedTuples.size} global permission assignment(s)`);
  const result = [];
  for (const group of globalPermissions) {
    const filteredPerms = group.permissions.filter(p => !excludedTuples.has(`${group.name}::${p}`));
    if (filteredPerms.length > 0) result.push({ ...group, permissions: filteredPerms });
  }
  return result;
}
