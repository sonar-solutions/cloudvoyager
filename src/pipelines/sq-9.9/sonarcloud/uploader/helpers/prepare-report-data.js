import AdmZip from 'adm-zip';
import logger from '../../../../../shared/utils/logger.js';
import { addCoreFilesToZip } from './add-core-files-to-zip.js';
import { addOptionalFilesToZip } from './add-optional-files-to-zip.js';

// -------- Prepare Report Data as Scanner Report Zip --------

export function prepareReportData(encodedReport, _metadata) {
  logger.debug('Preparing report data as scanner report zip...');

  const zip = new AdmZip();
  addCoreFilesToZip(zip, encodedReport);
  addOptionalFilesToZip(zip, encodedReport);

  const reportBuffer = zip.toBuffer();
  logger.info(`Scanner report zip created: ${reportBuffer.length} bytes`);
  return reportBuffer;
}
