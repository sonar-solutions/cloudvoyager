import logger from '../../../../shared/utils/logger.js';
import { SonarQubeClient } from '../../sonarqube/api-client.js';
import { extractUniqueAssignees, enrichAssigneeDetails } from '../../sonarqube/extractors/users.js';

// -------- Collect Assignee Data --------

/** Collect unique issue assignees and enrich their details for dry-run. */
export async function collectAssigneeData(sonarqubeConfig, allProjects) {
  logger.info('Collecting unique issue assignees across all projects...');
  const sqClient = new SonarQubeClient({ url: sonarqubeConfig.url, token: sonarqubeConfig.token });
  const assigneeCounts = await extractUniqueAssignees(sqClient, allProjects.map(p => p.key));

  let assigneeDetails = new Map();
  if (assigneeCounts.size > 0) {
    logger.info('Enriching assignee details...');
    assigneeDetails = await enrichAssigneeDetails(sqClient, [...assigneeCounts.keys()]);
  }

  return { assigneeCounts, assigneeDetails };
}
