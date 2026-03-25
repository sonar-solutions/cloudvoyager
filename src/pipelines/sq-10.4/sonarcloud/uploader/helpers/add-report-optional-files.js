import logger from '../../../../../shared/utils/logger.js';

// -------- Main Logic --------

/**
 * Add optional files to the report zip (sources, rules, changesets, duplications, external issues, ad-hoc rules).
 *
 * @param {object} zip - AdmZip instance
 * @param {object} encodedReport - Encoded protobuf report
 */
export function addReportOptionalFiles(zip, encodedReport) {
  if (encodedReport.sourceFilesText?.length > 0) {
    encodedReport.sourceFilesText.forEach((sf) => zip.addFile(`source-${sf.componentRef}.txt`, Buffer.from(sf.text, 'utf-8')));
    logger.debug(`Added ${encodedReport.sourceFilesText.length} source text files`);
  }

  if (encodedReport.activeRules?.length > 0) {
    zip.addFile('activerules.pb', Buffer.from(encodedReport.activeRules));
    logger.debug(`Added activerules.pb (${encodedReport.activeRules.length} bytes)`);
  }

  if (encodedReport.changesets?.size > 0) {
    let count = 0;
    encodedReport.changesets.forEach((buf, ref) => { zip.addFile(`changesets-${ref}.pb`, Buffer.from(buf)); count++; });
    logger.debug(`Added ${count} changeset files`);
  }

  if (encodedReport.duplications?.size > 0) {
    let count = 0;
    encodedReport.duplications.forEach((buf, ref) => { zip.addFile(`duplications-${ref}.pb`, Buffer.from(buf)); count++; });
    logger.debug(`Added ${count} duplication files`);
  }

  if (encodedReport.externalIssues?.size > 0) {
    let count = 0;
    encodedReport.externalIssues.forEach((buf, ref) => { zip.addFile(`external-issues-${ref}.pb`, Buffer.from(buf)); count++; });
    logger.debug(`Added ${count} external issue files`);
  }

  if (encodedReport.adHocRules?.length > 0) {
    zip.addFile('adhocrules.pb', Buffer.from(encodedReport.adHocRules));
    logger.debug(`Added adhocrules.pb (${encodedReport.adHocRules.length} bytes)`);
  }
}
