// -------- Log Interrupted Projects --------

import logger from '../../../utils/logger.js';

/**
 * Log projects that were interrupted during a previous run.
 * @param {object} organizations - Organizations map from journal
 */
export function logInterruptedProjects(organizations) {
  for (const [orgKey, org] of Object.entries(organizations)) {
    if (org.status !== 'in_progress') continue;
    for (const [projKey, proj] of Object.entries(org.projects || {})) {
      if (proj.status === 'in_progress') {
        logger.info(
          `Project '${projKey}' in org '${orgKey}' was interrupted — will re-execute from last completed step`
        );
      }
    }
  }
}
