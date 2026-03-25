import logger from '../../../../../../shared/utils/logger.js';

// -------- Sync Issue Assignment --------

/** Sync assignment from SQ issue to SC issue, applying user mappings if available. */
export async function syncIssueAssignment(sqIssue, scIssue, client, userMappings, stats) {
  if (!sqIssue.assignee || sqIssue.assignee === scIssue.assignee) return;

  const mapping = userMappings?.get(sqIssue.assignee);
  if (mapping && !mapping.include) {
    stats.assignmentSkipped++;
    logger.debug(`Skipping assignment for "${sqIssue.assignee}" (excluded in user-mappings.csv)`);
    return;
  }

  const targetAssignee = mapping?.scLogin || sqIssue.assignee;
  if (mapping?.scLogin) {
    stats.assignmentMapped++;
    logger.debug(`Mapping assignee "${sqIssue.assignee}" -> "${targetAssignee}"`);
  }

  try {
    await client.assignIssue(scIssue.key, targetAssignee);
    stats.assigned++;
  } catch (error) {
    stats.assignmentFailed++;
    stats.failedAssignments.push({
      issueKey: scIssue.key, assignee: targetAssignee,
      sqAssignee: sqIssue.assignee, error: error.message,
    });
    logger.warn(`Failed to assign issue ${scIssue.key} to "${targetAssignee}": ${error.message}`);
  }
}
