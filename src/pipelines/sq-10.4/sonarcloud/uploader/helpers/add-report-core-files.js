import logger from '../../../../../shared/utils/logger.js';

// -------- Main Logic --------

/**
 * Add core protobuf files to the report zip (metadata, components, issues, measures).
 *
 * @param {object} zip - AdmZip instance
 * @param {object} encodedReport - Encoded protobuf report
 */
export function addReportCoreFiles(zip, encodedReport) {
  // Metadata
  zip.addFile('metadata.pb', Buffer.from(encodedReport.metadata));
  logger.debug('Added metadata.pb to report');

  // Components (component-{ref}.pb)
  encodedReport.components.forEach((buf, index) => {
    zip.addFile(`component-${index + 1}.pb`, Buffer.from(buf));
  });
  logger.debug(`Added ${encodedReport.components.length} component files`);

  // Issues (issues-{ref}.pb)
  let issueFileCount = 0;
  encodedReport.issues.forEach((buf, ref) => {
    zip.addFile(`issues-${ref}.pb`, Buffer.from(buf));
    issueFileCount++;
  });
  logger.debug(`Added ${issueFileCount} issue files`);

  // Measures (measures-{ref}.pb)
  let measureFileCount = 0;
  encodedReport.measures.forEach((buf, ref) => {
    zip.addFile(`measures-${ref}.pb`, Buffer.from(buf));
    measureFileCount++;
  });
  logger.debug(`Added ${measureFileCount} measure files`);
}
