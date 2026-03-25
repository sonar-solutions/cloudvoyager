import logger from '../../../../../shared/utils/logger.js';

// -------- Add Source and Rule Files --------

/** Add source text files and active rules to the zip. */
export function addSourceAndRuleFiles(zip, encodedReport) {
  if (encodedReport.sourceFilesText && encodedReport.sourceFilesText.length > 0) {
    encodedReport.sourceFilesText.forEach((sourceFile) => {
      zip.addFile(`source-${sourceFile.componentRef}.txt`, Buffer.from(sourceFile.text, 'utf-8'));
    });
    logger.debug(`Added ${encodedReport.sourceFilesText.length} source text files`);
  }

  if (encodedReport.activeRules && encodedReport.activeRules.length > 0) {
    zip.addFile('activerules.pb', Buffer.from(encodedReport.activeRules));
    logger.debug(`Added activerules.pb (${encodedReport.activeRules.length} bytes)`);
  }
}
