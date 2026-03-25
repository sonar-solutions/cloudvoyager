// -------- Apply Profile Mappings CSV Filter --------
import { isIncluded } from '../../csv-reader.js';
import logger from '../../../utils/logger.js';

export function applyProfileMappingsCsv(csvData, qualityProfiles) {
  if (!qualityProfiles) return qualityProfiles;

  const excludedTuples = new Set();
  for (const row of csvData.rows) {
    if (!isIncluded(row['Include'])) excludedTuples.add(`${row['Profile Name']}::${row.Language}`);
  }
  if (excludedTuples.size === 0) return qualityProfiles;

  logger.info(`CSV override: excluding ${excludedTuples.size} quality profile(s)`);
  return qualityProfiles.filter(p => !excludedTuples.has(`${p.name}::${p.language}`));
}
