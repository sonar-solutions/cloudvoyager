import logger from '../../../../../../../shared/utils/logger.js';

// -------- Process Core Results --------

/** Process settled core migration results and accumulate stats. */
export function processCoreResults(coreResults, results) {
  for (const r of coreResults) {
    if (r.status === 'fulfilled' && r.value) {
      if (r.value.linesOfCode > 0) {
        results.totalLinesOfCode += r.value.linesOfCode;
        results.projectLinesOfCode.push({ projectKey: r.value.projectKey, linesOfCode: r.value.linesOfCode });
      }
    } else if (r.status === 'rejected') {
      logger.error(`Project core migration failed: ${r.reason?.message || r.reason}`);
    }
  }
}
