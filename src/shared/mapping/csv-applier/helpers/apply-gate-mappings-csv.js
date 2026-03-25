// -------- Apply Gate Mappings CSV Filter --------
import { isIncluded } from '../../csv-reader.js';
import logger from '../../../utils/logger.js';

export function applyGateMappingsCsv(csvData, qualityGates) {
  if (!qualityGates) return qualityGates;

  const excludedNames = new Set();
  for (const row of csvData.rows) {
    if (!isIncluded(row['Include'])) excludedNames.add(row['Gate Name']);
  }
  if (excludedNames.size === 0) return qualityGates;

  logger.info(`CSV override: excluded ${excludedNames.size} quality gate(s): ${[...excludedNames].join(', ')}`);
  return qualityGates.filter(g => !excludedNames.has(g.name));
}
