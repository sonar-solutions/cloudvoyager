import AdmZip from 'adm-zip';
import logger from '../../../shared/utils/logger.js';

/**
 * Prepare report data for upload - creates a zip archive matching SonarScanner format.
 *
 * @param {object} encodedReport - Encoded protobuf report
 * @param {object} _metadata - Analysis metadata (unused, reserved for future use)
 * @returns {Buffer} Zip buffer ready for upload
 */
export function prepareReportData(encodedReport, _metadata) {
  logger.debug('Preparing report data as scanner report zip...');

  const zip = new AdmZip();

  // Add metadata.pb (single message, NOT length-delimited)
  zip.addFile('metadata.pb', Buffer.from(encodedReport.metadata));
  logger.debug('Added metadata.pb to report');

  // Add component files (component-{ref}.pb) - one file per component
  encodedReport.components.forEach((componentBuffer, index) => {
    const ref = index + 1;
    zip.addFile(`component-${ref}.pb`, Buffer.from(componentBuffer));
  });
  logger.debug(`Added ${encodedReport.components.length} component files`);

  // Add issues files (issues-{ref}.pb) - each is a Buffer of length-delimited Issue messages
  let issueFileCount = 0;
  encodedReport.issues.forEach((issueBuffer, componentRef) => {
    zip.addFile(`issues-${componentRef}.pb`, Buffer.from(issueBuffer));
    issueFileCount++;
  });
  logger.debug(`Added ${issueFileCount} issue files`);

  // Add measures files (measures-{ref}.pb) - each is a Buffer of length-delimited Measure messages
  let measureFileCount = 0;
  encodedReport.measures.forEach((measureBuffer, componentRef) => {
    zip.addFile(`measures-${componentRef}.pb`, Buffer.from(measureBuffer));
    measureFileCount++;
  });
  logger.debug(`Added ${measureFileCount} measure files`);

  // Add source files as plain text (source-{ref}.txt)
  if (encodedReport.sourceFilesText && encodedReport.sourceFilesText.length > 0) {
    encodedReport.sourceFilesText.forEach((sourceFile) => {
      const ref = sourceFile.componentRef;
      zip.addFile(`source-${ref}.txt`, Buffer.from(sourceFile.text, 'utf-8'));
    });
    logger.debug(`Added ${encodedReport.sourceFilesText.length} source text files`);
  }

  // Add active rules file (activerules.pb) - single Buffer of length-delimited ActiveRule messages
  if (encodedReport.activeRules && encodedReport.activeRules.length > 0) {
    zip.addFile('activerules.pb', Buffer.from(encodedReport.activeRules));
    logger.debug(`Added activerules.pb (${encodedReport.activeRules.length} bytes)`);
  }

  // Add changeset files (changesets-{ref}.pb) - single Changesets message each
  let changesetFileCount = 0;
  if (encodedReport.changesets && encodedReport.changesets.size > 0) {
    encodedReport.changesets.forEach((changesetBuffer, componentRef) => {
      zip.addFile(`changesets-${componentRef}.pb`, Buffer.from(changesetBuffer));
      changesetFileCount++;
    });
    logger.debug(`Added ${changesetFileCount} changeset files`);
  }

  // Add duplication files (duplications-{ref}.pb)
  if (encodedReport.duplications && encodedReport.duplications.size > 0) {
    let dupFileCount = 0;
    encodedReport.duplications.forEach((buffer, componentRef) => {
      zip.addFile(`duplications-${componentRef}.pb`, Buffer.from(buffer));
      dupFileCount++;
    });
    logger.debug(`Added ${dupFileCount} duplication files`);
  }

  // Add external issues files (external-issues-{ref}.pb)
  if (encodedReport.externalIssues && encodedReport.externalIssues.size > 0) {
    let extIssueFileCount = 0;
    encodedReport.externalIssues.forEach((buffer, componentRef) => {
      zip.addFile(`external-issues-${componentRef}.pb`, Buffer.from(buffer));
      extIssueFileCount++;
    });
    logger.debug(`Added ${extIssueFileCount} external issue files`);
  }

  // Add ad-hoc rules file (adhocrules.pb)
  if (encodedReport.adHocRules && encodedReport.adHocRules.length > 0) {
    zip.addFile('adhocrules.pb', Buffer.from(encodedReport.adHocRules));
    logger.debug(`Added adhocrules.pb (${encodedReport.adHocRules.length} bytes)`);
  }

  // Add context-props.pb - empty file (matches real scanner behavior)
  zip.addFile('context-props.pb', Buffer.alloc(0));
  logger.debug('Added context-props.pb (empty)');

  // Return the zip as a buffer
  const reportBuffer = zip.toBuffer();
  logger.info(`Scanner report zip created: ${reportBuffer.length} bytes`);

  return reportBuffer;
}
