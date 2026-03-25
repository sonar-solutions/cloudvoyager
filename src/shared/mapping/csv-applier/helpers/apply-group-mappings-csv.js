// -------- Apply Group Mappings CSV Filter --------
import { isIncluded } from '../../csv-reader.js';
import logger from '../../../utils/logger.js';

export function applyGroupMappingsCsv(csvData, groups) {
  if (!groups) return groups;

  const excludedNames = new Set();
  for (const row of csvData.rows) {
    if (!isIncluded(row['Include'])) excludedNames.add(row['Group Name']);
  }
  if (excludedNames.size === 0) return groups;

  logger.info(`CSV override: excluding ${excludedNames.size} group(s): ${[...excludedNames].join(', ')}`);
  return groups.filter(g => !excludedNames.has(g.name));
}
