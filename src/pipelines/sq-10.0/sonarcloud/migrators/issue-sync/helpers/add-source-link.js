import logger from '../../../../../../shared/utils/logger.js';

// -------- Add Source Link Comment --------

export async function addSourceLink(sqIssue, scIssue, client, sqClient, stats) {
  if (!sqClient?.baseURL || !sqClient?.projectKey) return;
  try {
    const sqUrl = `${sqClient.baseURL}/project/issues?id=${encodeURIComponent(sqClient.projectKey)}&issues=${encodeURIComponent(sqIssue.key)}&open=${encodeURIComponent(sqIssue.key)}`;
    await client.addIssueComment(scIssue.key, `[SonarQube Source] Original issue: ${sqUrl}`);
    stats.sourceLinked++;
  } catch (error) {
    logger.debug(`Failed to add source link comment to issue ${scIssue.key}: ${error.message}`);
  }
}
