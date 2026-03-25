import logger from '../../../../../shared/utils/logger.js';

// -------- Add Core Protobuf Files to Zip --------

/** Add component, issue, and measure .pb files to zip. */
export function addProtobufFiles(zip, encodedReport) {
  // Components (component-{ref}.pb)
  encodedReport.components.forEach((buf, i) => {
    zip.addFile(`component-${i + 1}.pb`, Buffer.from(buf));
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

  // Active rules (activerules.pb)
  if (encodedReport.activeRules && encodedReport.activeRules.length > 0) {
    zip.addFile('activerules.pb', Buffer.from(encodedReport.activeRules));
    logger.debug(`Added activerules.pb (${encodedReport.activeRules.length} bytes)`);
  }
}
