// -------- Set Issue Tags --------

import logger from '../../../../../../shared/utils/logger.js';

export async function setIssueTags(client, issue, tags) {
  logger.debug(`Setting tags on issue ${issue}: ${tags.join(', ')}`);
  await client.post('/api/issues/set_tags', null, { params: { issue, tags: tags.join(',') } });
}
