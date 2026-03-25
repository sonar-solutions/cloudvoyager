// -------- Assign Issue --------

import logger from '../../../../../../shared/utils/logger.js';

export async function assignIssue(client, issue, assignee) {
  logger.debug(`Assigning issue ${issue} to ${assignee || '(unassign)'}`);
  await client.post('/api/issues/assign', null, { params: { issue, assignee } });
}
