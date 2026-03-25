import logger from '../../../../../shared/utils/logger.js';

// -------- Add Optional Files --------

/** Add changesets, duplications, external issues, ad-hoc rules, and context-props. */
export function addOptionalFiles(zip, encodedReport) {
  if (encodedReport.changesets && encodedReport.changesets.size > 0) {
    let count = 0;
    encodedReport.changesets.forEach((buf, ref) => { zip.addFile(`changesets-${ref}.pb`, Buffer.from(buf)); count++; });
    logger.debug(`Added ${count} changeset files`);
  }

  if (encodedReport.duplications && encodedReport.duplications.size > 0) {
    let count = 0;
    encodedReport.duplications.forEach((buf, ref) => { zip.addFile(`duplications-${ref}.pb`, Buffer.from(buf)); count++; });
    logger.debug(`Added ${count} duplication files`);
  }

  if (encodedReport.externalIssues && encodedReport.externalIssues.size > 0) {
    let count = 0;
    encodedReport.externalIssues.forEach((buf, ref) => { zip.addFile(`external-issues-${ref}.pb`, Buffer.from(buf)); count++; });
    logger.debug(`Added ${count} external issue files`);
  }

  if (encodedReport.adHocRules && encodedReport.adHocRules.length > 0) {
    zip.addFile('adhocrules.pb', Buffer.from(encodedReport.adHocRules));
    logger.debug(`Added adhocrules.pb (${encodedReport.adHocRules.length} bytes)`);
  }

  zip.addFile('context-props.pb', Buffer.alloc(0));
  logger.debug('Added context-props.pb (empty)');
}
