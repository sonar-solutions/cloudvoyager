// -------- Log Project Measures --------

import logger from '../../../utils/logger.js';

/**
 * Log measure-specific details for a project to the console.
 */
export function logProjectMeasures(meas) {
  const parts = [`${meas.compared} compared`];
  if (meas.mismatches?.length > 0) parts.push(`${meas.mismatches.length} mismatches`);
  if (meas.sqOnly?.length > 0) parts.push(`${meas.sqOnly.length} SQ-only`);
  if (meas.scOnly?.length > 0) parts.push(`${meas.scOnly.length} SC-only`);
  logger.info(`         Measures: ${parts.join(', ')}`);

  if (meas.mismatches?.length > 0) {
    for (const m of meas.mismatches) {
      logger.info(`           ${m.metric}: SQ=${m.sqValue} SC=${m.scValue}`);
    }
  }
}
