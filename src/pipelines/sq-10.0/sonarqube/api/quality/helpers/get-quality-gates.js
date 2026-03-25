// -------- Get Quality Gates --------

import logger from '../../../../../../shared/utils/logger.js';

export async function getQualityGates(client) {
  logger.info('Fetching all quality gates');
  const response = await client.get('/api/qualitygates/list');
  return response.data;
}
