// -------- Apply User Mappings CSV Filter --------
import { isIncluded } from '../../csv-reader.js';
import logger from '../../../utils/logger.js';

export function applyUserMappingsCsv(csvData) {
  const mappings = new Map();
  let mappedCount = 0;
  let excludedCount = 0;

  for (const row of csvData.rows) {
    const sqLogin = row['SonarQube Login'];
    if (!sqLogin) continue;
    const include = isIncluded(row['Include']);
    const scLogin = (row['SonarCloud Login'] || '').trim();
    if (!include) {
      mappings.set(sqLogin, { scLogin: null, include: false });
      excludedCount++;
    } else if (scLogin) {
      mappings.set(sqLogin, { scLogin, include: true });
      mappedCount++;
    }
  }

  if (mappedCount > 0) logger.info(`CSV override: ${mappedCount} user(s) mapped to SonarCloud logins`);
  if (excludedCount > 0) logger.info(`CSV override: ${excludedCount} user(s) excluded from assignment`);
  return mappings.size > 0 ? mappings : null;
}
