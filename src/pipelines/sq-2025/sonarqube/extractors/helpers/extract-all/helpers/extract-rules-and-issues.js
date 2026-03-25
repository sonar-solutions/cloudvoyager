import { extractIssues } from '../../../issues.js';
import { extractActiveRules } from '../../../rules.js';
import { extractHotspotsAsIssues } from '../../../hotspots-to-issues.js';
import logger from '../../../../../../../shared/utils/logger.js';

// -------- Extract Rules and Issues --------

/** Steps 4-5b: Extract active rules, issues, and security hotspots. */
export async function extractRulesAndIssues(ext, data) {
  logger.info('Step 4/7: Extracting active rules...');
  data.activeRules = await extractActiveRules(ext.client, data._sourceFilesList);

  logger.info('Step 5/7: Extracting issues...');
  data.issues = await extractIssues(ext.client, ext.state);

  logger.info('Step 5b: Extracting security hotspots...');
  const hotspotIssues = await extractHotspotsAsIssues(ext.client);
  if (hotspotIssues.length > 0) {
    data.issues.push(...hotspotIssues);
    logger.info(`Added ${hotspotIssues.length} hotspots to issue list (total: ${data.issues.length})`);
  }
}
