import logger from '../../../../../shared/utils/logger.js';

// -------- Add Core Files to Zip (metadata, components, issues, measures) --------

export function addCoreFilesToZip(zip, encodedReport) {
  // metadata.pb (single message, NOT length-delimited)
  zip.addFile('metadata.pb', Buffer.from(encodedReport.metadata));
  logger.debug('Added metadata.pb to report');

  // component files (component-{ref}.pb) - one per component
  encodedReport.components.forEach((buf, index) => {
    zip.addFile(`component-${index + 1}.pb`, Buffer.from(buf));
  });
  logger.debug(`Added ${encodedReport.components.length} component files`);

  // issues files (issues-{ref}.pb)
  let issueFileCount = 0;
  encodedReport.issues.forEach((buf, componentRef) => {
    zip.addFile(`issues-${componentRef}.pb`, Buffer.from(buf));
    issueFileCount++;
  });
  logger.debug(`Added ${issueFileCount} issue files`);

  // measures files (measures-{ref}.pb)
  let measureFileCount = 0;
  encodedReport.measures.forEach((buf, componentRef) => {
    zip.addFile(`measures-${componentRef}.pb`, Buffer.from(buf));
    measureFileCount++;
  });
  logger.debug(`Added ${measureFileCount} measure files`);
}
