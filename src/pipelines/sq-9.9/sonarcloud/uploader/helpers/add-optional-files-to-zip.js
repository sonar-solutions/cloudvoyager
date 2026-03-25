import logger from '../../../../../shared/utils/logger.js';

// -------- Add Optional Files to Zip (sources, rules, changesets, dups, external) --------

export function addOptionalFilesToZip(zip, encodedReport) {
  if (encodedReport.sourceFilesText?.length > 0) {
    encodedReport.sourceFilesText.forEach((sf) => zip.addFile(`source-${sf.componentRef}.txt`, Buffer.from(sf.text, 'utf-8')));
    logger.debug(`Added ${encodedReport.sourceFilesText.length} source text files`);
  }

  if (encodedReport.activeRules?.length > 0) {
    zip.addFile('activerules.pb', Buffer.from(encodedReport.activeRules));
    logger.debug(`Added activerules.pb (${encodedReport.activeRules.length} bytes)`);
  }

  if (encodedReport.changesets?.size > 0) {
    let n = 0;
    encodedReport.changesets.forEach((buf, ref) => { zip.addFile(`changesets-${ref}.pb`, Buffer.from(buf)); n++; });
    logger.debug(`Added ${n} changeset files`);
  }

  if (encodedReport.duplications?.size > 0) {
    let n = 0;
    encodedReport.duplications.forEach((buf, ref) => { zip.addFile(`duplications-${ref}.pb`, Buffer.from(buf)); n++; });
    logger.debug(`Added ${n} duplication files`);
  }

  if (encodedReport.externalIssues?.size > 0) {
    let n = 0;
    encodedReport.externalIssues.forEach((buf, ref) => { zip.addFile(`external-issues-${ref}.pb`, Buffer.from(buf)); n++; });
    logger.debug(`Added ${n} external issue files`);
  }

  if (encodedReport.adHocRules?.length > 0) {
    zip.addFile('adhocrules.pb', Buffer.from(encodedReport.adHocRules));
    logger.debug(`Added adhocrules.pb (${encodedReport.adHocRules.length} bytes)`);
  }

  // context-props.pb - empty file (matches real scanner behavior)
  zip.addFile('context-props.pb', Buffer.alloc(0));
  logger.debug('Added context-props.pb (empty)');
}
