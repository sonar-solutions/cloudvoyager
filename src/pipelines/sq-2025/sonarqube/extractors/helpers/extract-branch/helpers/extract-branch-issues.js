import { extractIssues } from '../../../issues.js';
import { extractHotspotsAsIssues } from '../../../hotspots-to-issues.js';
import logger from '../../../../../../../shared/utils/logger.js';

// -------- Extract Branch Issues --------

/** Extract issues and hotspots for a branch. */
export async function extractBranchIssues(ext, branch) {
  logger.info(`  [${branch}] Extracting issues...`);
  const issues = await extractIssues(ext.client, ext.state, branch);

  logger.info(`  [${branch}] Extracting security hotspots...`);
  const hotspotIssues = await extractHotspotsAsIssues(ext.client, branch);
  if (hotspotIssues.length > 0) {
    issues.push(...hotspotIssues);
    logger.info(`  [${branch}] Added ${hotspotIssues.length} hotspots (total: ${issues.length})`);
  }
  return issues;
}
