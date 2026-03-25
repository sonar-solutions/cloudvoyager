import AdmZip from 'adm-zip';
import logger from '../../../../shared/utils/logger.js';
import { addCoreFiles } from './helpers/add-core-files.js';
import { addExtendedFiles } from './helpers/add-extended-files.js';

// -------- Prepare Report Data --------

export function prepareReportData(encodedReport, _metadata) {
  logger.debug('Preparing report data as scanner report zip...');

  const zip = new AdmZip();
  addCoreFiles(zip, encodedReport);
  addExtendedFiles(zip, encodedReport);

  const reportBuffer = zip.toBuffer();
  logger.info(`Scanner report zip created: ${reportBuffer.length} bytes`);
  return reportBuffer;
}
