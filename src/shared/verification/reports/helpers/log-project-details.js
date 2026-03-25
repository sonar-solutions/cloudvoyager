// -------- Log Project Details --------

import logger from '../../../utils/logger.js';
import { logProjectIssues } from './log-project-issues.js';
import { logProjectHotspots } from './log-project-hotspots.js';
import { logProjectMeasures } from './log-project-measures.js';

/**
 * Log per-project verification results to the console.
 */
export function logProjectDetails(results) {
  if (results.projectResults.length === 0) return;

  logger.info('');
  logger.info('--- Per-Project Results ---');

  for (const project of results.projectResults) {
    const checks = Object.values(project.checks || {});
    const fails = checks.filter(c => c.status === 'fail').length;
    const passes = checks.filter(c => c.status === 'pass').length;
    const errored = checks.filter(c => c.status === 'error').length;
    const icon = fails === 0 && errored === 0 ? 'PASS' : 'FAIL';
    logger.info(`  ${icon}  ${project.sqProjectKey} -> ${project.scProjectKey}  (${passes} pass, ${fails} fail, ${errored} error)`);

    if (project.checks.issues) logProjectIssues(project.checks.issues);
    if (project.checks.hotspots) logProjectHotspots(project.checks.hotspots);
    if (project.checks.measures) logProjectMeasures(project.checks.measures);
  }
}
