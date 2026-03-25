import logger from '../../../../shared/utils/logger.js';
import { extractUniqueAssignees, enrichAssigneeDetails } from '../../sonarqube/extractors/users.js';

// -------- Collect Assignee Data --------

export async function collectAssignees(sqClient, allProjects, dryRun) {
  if (!dryRun) return {};
  logger.info('Collecting unique issue assignees across all projects...');
  const projectKeys = allProjects.map(p => p.key);
  const assigneeCounts = await extractUniqueAssignees(sqClient, projectKeys);
  let assigneeDetails = new Map();
  if (assigneeCounts.size > 0) {
    logger.info('Enriching assignee details (display names, emails)...');
    assigneeDetails = await enrichAssigneeDetails(sqClient, [...assigneeCounts.keys()]);
  }
  return { assigneeCounts, assigneeDetails };
}
