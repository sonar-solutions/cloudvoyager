import logger from '../../../../../shared/utils/logger.js';

// -------- Log External Issue Detection Statistics --------

export function logExternalIssueStats(byComponent, adHocRules, engines, skipped, enriched) {
  const total = [...byComponent.values()].reduce((sum, arr) => sum + arr.length, 0);
  if (skipped > 0) logger.warn(`Skipped ${skipped} external issues (components without source code)`);
  if (engines.size > 0) logger.info(`Auto-detected external engines: ${[...engines].join(', ')}`);
  if (enriched > 0) logger.info(`Enriched ${enriched} external issues with SonarCloud Clean Code data`);
  logger.info(`Built ${total} external issue messages across ${byComponent.size} components, ${adHocRules.size} ad-hoc rules`);
}
