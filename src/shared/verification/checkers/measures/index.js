// -------- Verify Measures --------

import logger from '../../../utils/logger.js';
import { KEY_METRICS } from './helpers/metric-constants.js';
import { compareMetrics } from './helpers/compare-metrics.js';

/**
 * Verify measures between SonarQube and SonarCloud for a project.
 */
export async function verifyMeasures(sqClient, scClient, scProjectKey) {
  const result = { status: 'pass', compared: 0, mismatches: [], sqOnly: [], scOnly: [] };

  let sqMeasures, scMeasures;
  try { sqMeasures = (await sqClient.getMeasures(null, KEY_METRICS)).measures || []; } catch (e) { logger.warn(`Failed to fetch SQ measures: ${e.message}`); sqMeasures = []; }
  try { scMeasures = (await scClient.getProjectMeasures(scProjectKey, KEY_METRICS)).measures || []; } catch (e) { logger.warn(`Failed to fetch SC measures: ${e.message}`); scMeasures = []; }

  compareMetrics(sqMeasures, scMeasures, result);
  if (result.mismatches.length > 0) result.status = 'fail';

  logger.info(`Measures verification: ${result.compared} compared, ${result.mismatches.length} mismatches`);
  return result;
}
