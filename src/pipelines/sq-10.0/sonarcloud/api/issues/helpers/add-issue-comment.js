// -------- Add Issue Comment --------

import logger from '../../../../../../shared/utils/logger.js';

export async function addIssueComment(client, issue, text) {
  logger.debug(`Adding comment to issue ${issue}`);
  await client.post('/api/issues/add_comment', null, { params: { issue, text } });
}
