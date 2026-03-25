import logger from '../../../../../../shared/utils/logger.js';

// -------- Main Logic --------

// Transition, assign, comment on, and tag issues in SonarCloud.

export async function transitionIssue(client, issue, transition) {
  logger.debug(`Transitioning issue ${issue}: ${transition}`);
  await client.post('/api/issues/do_transition', null, { params: { issue, transition } });
}

export async function assignIssue(client, issue, assignee) {
  logger.debug(`Assigning issue ${issue} to ${assignee || '(unassign)'}`);
  await client.post('/api/issues/assign', null, { params: { issue, assignee } });
}

export async function addIssueComment(client, issue, text) {
  logger.debug(`Adding comment to issue ${issue}`);
  await client.post('/api/issues/add_comment', null, { params: { issue, text } });
}

export async function setIssueTags(client, issue, tags) {
  logger.debug(`Setting tags on issue ${issue}: ${tags.join(', ')}`);
  await client.post('/api/issues/set_tags', null, { params: { issue, tags: tags.join(',') } });
}
