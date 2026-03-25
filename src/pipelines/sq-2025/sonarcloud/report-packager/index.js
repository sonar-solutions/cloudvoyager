import AdmZip from 'adm-zip';
import { addCoreFiles } from './helpers/add-core-files.js';
import { addSourceAndRuleFiles } from './helpers/add-source-and-rule-files.js';
import { addOptionalFiles } from './helpers/add-optional-files.js';
import logger from '../../../../shared/utils/logger.js';

// -------- Report Packager --------

/** Prepare report data as a scanner report zip archive. */
export function prepareReportData(encodedReport, _metadata) {
  logger.debug('Preparing report data as scanner report zip...');

  const zip = new AdmZip();
  addCoreFiles(zip, encodedReport);
  addSourceAndRuleFiles(zip, encodedReport);
  addOptionalFiles(zip, encodedReport);

  const reportBuffer = zip.toBuffer();
  logger.info(`Scanner report zip created: ${reportBuffer.length} bytes`);
  return reportBuffer;
}
