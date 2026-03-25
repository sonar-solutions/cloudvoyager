import logger from '../../../../../shared/utils/logger.js';

// -------- Add Component, Issue, and Measure Files to Zip --------

export function addComponentFiles(zip, encodedReport) {
  encodedReport.components.forEach((buf, index) => {
    zip.addFile(`component-${index + 1}.pb`, Buffer.from(buf));
  });
  logger.debug(`Added ${encodedReport.components.length} component files`);

  let issueFileCount = 0;
  encodedReport.issues.forEach((buf, ref) => {
    zip.addFile(`issues-${ref}.pb`, Buffer.from(buf));
    issueFileCount++;
  });
  logger.debug(`Added ${issueFileCount} issue files`);

  let measureFileCount = 0;
  encodedReport.measures.forEach((buf, ref) => {
    zip.addFile(`measures-${ref}.pb`, Buffer.from(buf));
    measureFileCount++;
  });
  logger.debug(`Added ${measureFileCount} measure files`);
}
