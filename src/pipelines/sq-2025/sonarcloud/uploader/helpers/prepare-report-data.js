import AdmZip from 'adm-zip';
import logger from '../../../../../shared/utils/logger.js';
import { addProtobufFiles } from './add-protobuf-files.js';
import { addSourceAndExtFiles } from './add-source-and-ext-files.js';

// -------- Prepare Report Data --------

/**
 * Create a zip archive matching SonarScanner report format.
 * @param {object} encodedReport - Encoded protobuf report
 * @returns {Buffer} Zip buffer ready for upload
 */
export function prepareReportData(encodedReport) {
  logger.debug('Preparing report data as scanner report zip...');

  const zip = new AdmZip();

  // Metadata (single message, NOT length-delimited)
  zip.addFile('metadata.pb', Buffer.from(encodedReport.metadata));
  logger.debug('Added metadata.pb to report');

  addProtobufFiles(zip, encodedReport);
  addSourceAndExtFiles(zip, encodedReport);

  // Context props (empty, matches real scanner behavior)
  zip.addFile('context-props.pb', Buffer.alloc(0));
  logger.debug('Added context-props.pb (empty)');

  const reportBuffer = zip.toBuffer();
  logger.info(`Scanner report zip created: ${reportBuffer.length} bytes`);
  return reportBuffer;
}
