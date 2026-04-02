import logger from '../../../../../../shared/utils/logger.js';
import { mapConcurrent } from '../../../../../../shared/utils/concurrency/helpers/map-concurrent.js';

// -------- Main Logic --------

// Assign quality gates to projects in SonarCloud.
export async function assignQualityGatesToProjects(gateMapping, projectGateAssignments, client) {
  const validAssignments = projectGateAssignments.filter(({ gateName }) => {
    const scGateId = gateMapping.get(gateName);
    if (!scGateId) { logger.debug(`No SC gate mapping for SQ gate "${gateName}", skipping`); return false; }
    return true;
  });

  await mapConcurrent(validAssignments, async ({ projectKey, gateName }) => {
    try {
      await client.assignQualityGateToProject(gateMapping.get(gateName), projectKey);
      logger.debug(`Assigned gate to project ${projectKey}`);
    } catch (error) {
      logger.warn(`Failed to assign gate to project ${projectKey}: ${error.message}`);
    }
  }, { concurrency: 10, settled: true });
}
