import { generateOrgMappings } from '../../pipeline/org-migration.js';
import { extractUniqueAssignees, enrichAssigneeDetails } from '../../sonarqube/extractors/users.js';
import logger from '../../../../shared/utils/logger.js';

// -------- Main Logic --------

/**
 * Generate org mappings, collecting assignee data in dry-run mode.
 */
export async function generateMappings(sqClient, allProjects, extractedData, sonarcloudOrgs, outputDir, dryRun) {
  logger.info('=== Step 3: Generating organization mappings ===');
  let extraMappingData = {};

  if (dryRun) {
    logger.info('Collecting unique issue assignees across all projects...');
    const assigneeCounts = await extractUniqueAssignees(sqClient, allProjects.map(p => p.key));
    let assigneeDetails = new Map();
    if (assigneeCounts.size > 0) {
      logger.info('Enriching assignee details (display names, emails)...');
      assigneeDetails = await enrichAssigneeDetails(sqClient, [...assigneeCounts.keys()]);
    }
    extraMappingData = { assigneeCounts, assigneeDetails };
  }

  return generateOrgMappings(allProjects, extractedData, sonarcloudOrgs, outputDir, extraMappingData);
}
