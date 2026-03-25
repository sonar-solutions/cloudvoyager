// -------- Assign Quality Gate To Project --------

import logger from '../../../../../../shared/utils/logger.js';

export async function assignQualityGateToProject(gateMapping, projectKey, gateName, client) {
  const scGateId = gateMapping.get(gateName);
  if (!scGateId) {
    logger.debug(`No SC gate mapping for SQ gate "${gateName}", skipping project ${projectKey}`);
    return;
  }

  try {
    await client.assignQualityGateToProject(scGateId, projectKey);
    logger.debug(`Assigned gate to project ${projectKey}`);
  } catch (error) {
    logger.warn(`Failed to assign gate to project ${projectKey}: ${error.message}`);
  }
}
