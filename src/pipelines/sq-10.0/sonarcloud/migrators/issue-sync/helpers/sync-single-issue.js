import logger from '../../../../../../shared/utils/logger.js';
import { syncIssueStatus } from './sync-issue-status.js';
import { syncIssueAssignment } from './sync-issue-assignment.js';
import { syncIssueComments } from './sync-issue-comments.js';
import { syncIssueTags } from './sync-issue-tags.js';
import { addSourceLink } from './add-source-link.js';

// -------- Sync Single Issue --------

export async function syncSingleIssue(sqIssue, scIssue, client, sqClient, userMappings, stats) {
  const transitioned = await syncIssueStatus(scIssue, sqIssue, client, sqClient);
  if (transitioned) stats.transitioned++;
  syncIssueAssignment(sqIssue, scIssue, client, userMappings, stats);
  await syncIssueComments(sqIssue, scIssue, client, stats);
  await syncIssueTags(sqIssue, scIssue, client, stats);
  await addSourceLink(sqIssue, scIssue, client, sqClient, stats);
}
