// -------- Get Quality Gate Details --------

import logger from '../../../../../../shared/utils/logger.js';

export async function getQualityGateDetails(client, name) {
  logger.debug(`Fetching quality gate details: ${name}`);
  const response = await client.get('/api/qualitygates/show', { params: { name } });
  return response.data;
}
