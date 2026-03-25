// -------- Verification Reports --------

import logger from '../../utils/logger.js';
import { logSkippedChecks } from './helpers/log-skipped-checks.js';
import { logProjectDetails } from './helpers/log-project-details.js';
import { logUnsyncableWarning } from './helpers/log-unsyncable-warning.js';

export { writeVerificationReports } from './helpers/write-reports.js';

/**
 * Log verification summary to console.
 */
export function logVerificationSummary(results) {
  const s = results.summary;
  logger.info('');
  logger.info('=== Verification Summary ===');
  logger.info(`Total checks:  ${s.totalChecks}`);
  logger.info(`Passed:        ${s.passed}`);
  logger.info(`Failed:        ${s.failed}`);
  logger.info(`Warnings:      ${s.warnings} (unsyncable items)`);
  logger.info(`Skipped:       ${s.skipped}`);
  logger.info(`Errors:        ${s.errors}`);
  logger.info('');

  if (s.skipped > 0) logSkippedChecks(results);

  if (s.failed === 0 && s.errors === 0) logger.info('Result: ALL CHECKS PASSED');
  else logger.error(`Result: ${s.failed} FAILED, ${s.errors} ERRORS`);

  logProjectDetails(results);
  if (s.warnings > 0) logUnsyncableWarning();
}
