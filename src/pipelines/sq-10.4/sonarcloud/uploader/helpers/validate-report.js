import { SonarCloudAPIError } from '../../../../../shared/utils/errors.js';
import logger from '../../../../../shared/utils/logger.js';

// -------- Main Logic --------

/**
 * Validate report before upload.
 *
 * @param {object} encodedReport - Encoded protobuf report
 * @returns {boolean} true if valid
 * @throws {SonarCloudAPIError} if validation fails
 */
export function validateReport(encodedReport) {
  logger.debug('Validating report before upload...');

  if (!encodedReport.metadata) throw new SonarCloudAPIError('Report missing metadata');
  if (!encodedReport.components || encodedReport.components.length === 0) throw new SonarCloudAPIError('Report missing components');

  logger.debug('Report validation passed');
  return true;
}
