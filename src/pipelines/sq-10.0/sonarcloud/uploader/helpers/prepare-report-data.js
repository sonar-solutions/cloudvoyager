import AdmZip from 'adm-zip';
import logger from '../../../../../shared/utils/logger.js';
import { addComponentFiles } from './add-component-files.js';
import { addOptionalFiles } from './add-optional-files.js';

// -------- Prepare Report Data as Scanner Zip --------

export function prepareReportData(encodedReport, _metadata) {
  logger.debug('Preparing report data as scanner report zip...');
  const zip = new AdmZip();

  zip.addFile('metadata.pb', Buffer.from(encodedReport.metadata));
  logger.debug('Added metadata.pb to report');

  addComponentFiles(zip, encodedReport);
  addOptionalFiles(zip, encodedReport);

  zip.addFile('context-props.pb', Buffer.alloc(0));
  logger.debug('Added context-props.pb (empty)');

  const reportBuffer = zip.toBuffer();
  logger.info(`Scanner report zip created: ${reportBuffer.length} bytes`);
  return reportBuffer;
}
