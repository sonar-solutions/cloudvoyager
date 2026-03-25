import logger from '../../../../../shared/utils/logger.js';
import { SonarCloudAPIError } from '../../../../../shared/utils/errors.js';

// -------- Validate Report Before Upload --------

export function validateReport(encodedReport) {
  logger.debug('Validating report before upload...');
  if (!encodedReport.metadata) throw new SonarCloudAPIError('Report missing metadata');
  if (!encodedReport.components || encodedReport.components.length === 0) throw new SonarCloudAPIError('Report missing components');
  logger.debug('Report validation passed');
  return true;
}
