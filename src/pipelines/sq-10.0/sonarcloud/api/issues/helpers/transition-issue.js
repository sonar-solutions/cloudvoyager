// -------- Transition Issue --------

import logger from '../../../../../../shared/utils/logger.js';

export async function transitionIssue(client, issue, transition) {
  logger.debug(`Transitioning issue ${issue}: ${transition}`);
  await client.post('/api/issues/do_transition', null, { params: { issue, transition } });
}
