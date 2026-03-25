import { syncIssueStatus } from './sync-issue-status.js';
import { syncIssueAssignment } from './sync-issue-assignment.js';
import { syncIssueMetadata } from './sync-issue-metadata.js';
import logger from '../../../../../../shared/utils/logger.js';

// -------- Main Logic --------

/**
 * Sync all aspects of a single matched issue pair (status, assignment, comments, tags).
 */
export async function syncSingleIssue(sqIssue, scIssue, client, sqClient, userMappings, stats) {
  try {
    const transitioned = await syncIssueStatus(scIssue, sqIssue, client, sqClient);
    if (transitioned) stats.transitioned++;

    await syncIssueAssignment(sqIssue, scIssue, client, userMappings, stats);
    await syncIssueMetadata(sqIssue, scIssue, client, sqClient, stats);
  } catch (error) {
    stats.failed++;
    logger.debug(`Failed to sync issue ${sqIssue.key}: ${error.message}`);
  }
}
