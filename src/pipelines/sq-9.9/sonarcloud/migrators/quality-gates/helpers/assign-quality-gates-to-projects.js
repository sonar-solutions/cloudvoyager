import logger from '../../../../../../shared/utils/logger.js';

// -------- Assign Quality Gates to Projects --------

export async function assignQualityGatesToProjects(gateMapping, projectGateAssignments, client) {
  for (const { projectKey, gateName } of projectGateAssignments) {
    const scGateId = gateMapping.get(gateName);
    if (!scGateId) {
      logger.debug(`No SC gate mapping for SQ gate "${gateName}", skipping project ${projectKey}`);
      continue;
    }

    try {
      await client.assignQualityGateToProject(scGateId, projectKey);
      logger.debug(`Assigned gate to project ${projectKey}`);
    } catch (error) {
      logger.warn(`Failed to assign gate to project ${projectKey}: ${error.message}`);
    }
  }
}
