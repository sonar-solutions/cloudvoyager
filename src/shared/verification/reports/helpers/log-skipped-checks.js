// -------- Log Skipped Checks --------

import logger from '../../../utils/logger.js';

/**
 * Log details of skipped checks to the console.
 */
export function logSkippedChecks(results) {
  logger.info('--- Skipped Checks ---');

  for (const org of results.orgResults) {
    for (const [name, check] of Object.entries(org.checks || {})) {
      if (check?.status === 'skipped') {
        logger.info(`  ${name} (org: ${org.orgKey}): ${check.details || check.error || 'No reason provided'}`);
      }
    }
  }

  for (const project of results.projectResults) {
    for (const [name, check] of Object.entries(project.checks || {})) {
      if (check?.status === 'skipped') {
        logger.info(`  ${name} (project: ${project.sqProjectKey}): ${check.details || check.error || 'No reason provided'}`);
      }
    }
  }

  if (results.portfolios?.status === 'skipped') {
    logger.info(`  Portfolios: ${results.portfolios.details || 'No reason provided'}`);
  }

  logger.info('');
}
