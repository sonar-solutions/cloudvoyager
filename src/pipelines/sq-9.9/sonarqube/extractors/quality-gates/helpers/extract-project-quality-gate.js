import logger from '../../../../../../shared/utils/logger.js';

// -------- Extract Quality Gate Assignment for a Project --------

export async function extractProjectQualityGate(client, projectKey = null) {
  try {
    const gate = await client.getQualityGate();
    return gate;
  } catch (error) {
    logger.warn(`Failed to get quality gate for project: ${error.message}`);
    return null;
  }
}
