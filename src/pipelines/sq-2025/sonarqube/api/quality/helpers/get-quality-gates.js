import logger from '../../../../../../shared/utils/logger.js';

// -------- Get Quality Gates --------

export async function getQualityGates(client) {
  logger.info('Fetching all quality gates');
  const response = await client.get('/api/qualitygates/list');
  return response.data;
}
