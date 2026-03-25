import logger from '../../../../../shared/utils/logger.js';

// -------- Log External Issue Stats --------

/** Log summary statistics for external issue detection. */
export function logExternalIssueStats(externalIssuesByComponent, adHocRules, detectedEngines, skippedIssues, enrichedCount) {
  const totalExternal = [...externalIssuesByComponent.values()].reduce((sum, arr) => sum + arr.length, 0);

  if (skippedIssues > 0) {
    logger.warn(`Skipped ${skippedIssues} external issues (components without source code)`);
  }
  if (detectedEngines.size > 0) {
    logger.info(`Auto-detected external engines: ${[...detectedEngines].join(', ')}`);
  }
  if (enrichedCount > 0) {
    logger.info(`Enriched ${enrichedCount} external issues with SonarCloud Clean Code data`);
  }
  logger.info(`Built ${totalExternal} external issue messages across ${externalIssuesByComponent.size} components, ${adHocRules.size} ad-hoc rules`);
}
