import logger from '../../../../../../shared/utils/logger.js';

// -------- Main Logic --------

// Extract quality gate assignment for a specific project.
export async function extractProjectQualityGate(client, projectKey = null) {
  try {
    return await client.getQualityGate();
  } catch (error) {
    logger.warn(`Failed to get quality gate for project: ${error.message}`);
    return null;
  }
}
