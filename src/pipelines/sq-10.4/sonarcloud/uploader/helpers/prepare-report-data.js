import AdmZip from 'adm-zip';
import logger from '../../../../../shared/utils/logger.js';
import { addReportCoreFiles } from './add-report-core-files.js';
import { addReportOptionalFiles } from './add-report-optional-files.js';

// -------- Main Logic --------

/**
 * Prepare report data for upload — creates a zip archive matching SonarScanner format.
 *
 * @param {object} encodedReport - Encoded protobuf report
 * @param {object} _metadata - Analysis metadata (unused, reserved)
 * @returns {Buffer} Zip buffer ready for upload
 */
export function prepareReportData(encodedReport, _metadata) {
  logger.debug('Preparing report data as scanner report zip...');
  const zip = new AdmZip();

  addReportCoreFiles(zip, encodedReport);
  addReportOptionalFiles(zip, encodedReport);

  // Add context-props.pb - empty file (matches real scanner behavior)
  zip.addFile('context-props.pb', Buffer.alloc(0));
  logger.debug('Added context-props.pb (empty)');

  const reportBuffer = zip.toBuffer();
  logger.info(`Scanner report zip created: ${reportBuffer.length} bytes`);
  return reportBuffer;
}
