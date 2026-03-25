import logger from '../../../../../shared/utils/logger.js';

// -------- Add Core Files --------

/** Add metadata, components, issues, and measures to the zip. */
export function addCoreFiles(zip, encodedReport) {
  zip.addFile('metadata.pb', Buffer.from(encodedReport.metadata));
  logger.debug('Added metadata.pb to report');

  encodedReport.components.forEach((componentBuffer, index) => {
    zip.addFile(`component-${index + 1}.pb`, Buffer.from(componentBuffer));
  });
  logger.debug(`Added ${encodedReport.components.length} component files`);

  let issueFileCount = 0;
  encodedReport.issues.forEach((issueBuffer, componentRef) => {
    zip.addFile(`issues-${componentRef}.pb`, Buffer.from(issueBuffer));
    issueFileCount++;
  });
  logger.debug(`Added ${issueFileCount} issue files`);

  let measureFileCount = 0;
  encodedReport.measures.forEach((measureBuffer, componentRef) => {
    zip.addFile(`measures-${componentRef}.pb`, Buffer.from(measureBuffer));
    measureFileCount++;
  });
  logger.debug(`Added ${measureFileCount} measure files`);
}
