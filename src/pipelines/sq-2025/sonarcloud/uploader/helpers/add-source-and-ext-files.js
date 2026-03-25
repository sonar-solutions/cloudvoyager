import logger from '../../../../../shared/utils/logger.js';

// -------- Add Source, Changeset, Duplication, and External Files to Zip --------

/** Add source text, changeset, duplication, external issue, and ad-hoc rule files. */
export function addSourceAndExtFiles(zip, encodedReport) {
  // Source text files (source-{ref}.txt)
  if (encodedReport.sourceFilesText && encodedReport.sourceFilesText.length > 0) {
    encodedReport.sourceFilesText.forEach((sf) => {
      zip.addFile(`source-${sf.componentRef}.txt`, Buffer.from(sf.text, 'utf-8'));
    });
    logger.debug(`Added ${encodedReport.sourceFilesText.length} source text files`);
  }

  // Changesets (changesets-{ref}.pb)
  if (encodedReport.changesets && encodedReport.changesets.size > 0) {
    let count = 0;
    encodedReport.changesets.forEach((buf, ref) => {
      zip.addFile(`changesets-${ref}.pb`, Buffer.from(buf));
      count++;
    });
    logger.debug(`Added ${count} changeset files`);
  }

  // Duplications (duplications-{ref}.pb)
  if (encodedReport.duplications && encodedReport.duplications.size > 0) {
    let count = 0;
    encodedReport.duplications.forEach((buf, ref) => {
      zip.addFile(`duplications-${ref}.pb`, Buffer.from(buf));
      count++;
    });
    logger.debug(`Added ${count} duplication files`);
  }

  // External issues (external-issues-{ref}.pb)
  if (encodedReport.externalIssues && encodedReport.externalIssues.size > 0) {
    let count = 0;
    encodedReport.externalIssues.forEach((buf, ref) => {
      zip.addFile(`external-issues-${ref}.pb`, Buffer.from(buf));
      count++;
    });
    logger.debug(`Added ${count} external issue files`);
  }

  // Ad-hoc rules (adhocrules.pb)
  if (encodedReport.adHocRules && encodedReport.adHocRules.length > 0) {
    zip.addFile('adhocrules.pb', Buffer.from(encodedReport.adHocRules));
    logger.debug(`Added adhocrules.pb (${encodedReport.adHocRules.length} bytes)`);
  }
}
