// -------- Quality Gates Migration --------

import logger from '../../../../../shared/utils/logger.js';
import { createGateWithConfig } from './helpers/create-gate-with-config.js';
import { assignQualityGateToProject } from './helpers/assign-quality-gate-to-project.js';
import { mapConcurrent } from '../../../../../shared/utils/concurrency/helpers/map-concurrent.js';

export async function migrateQualityGates(extractedGates, client) {
  const gateMapping = new Map();
  const customGates = extractedGates.filter(g => !g.isBuiltIn);
  logger.info(`Migrating ${customGates.length} custom quality gates (skipping ${extractedGates.length - customGates.length} built-in)`);

  await mapConcurrent(customGates, async (gate) => {
    try {
      const scGateId = await createGateWithConfig(gate, client);
      gateMapping.set(gate.name, String(scGateId));
      logger.info(`Migrated quality gate: ${gate.name} (${gate.conditions.length} conditions)`);
    } catch (error) {
      logger.error(`Failed to migrate quality gate ${gate.name}: ${error.message}`);
    }
  }, { concurrency: 5, settled: true });

  return gateMapping;
}

export async function assignQualityGatesToProjects(gateMapping, projectGateAssignments, client) {
  const validAssignments = projectGateAssignments.filter(({ gateName }) => {
    const scGateId = gateMapping.get(gateName);
    if (!scGateId) { logger.debug(`No SC gate mapping for SQ gate "${gateName}", skipping`); return false; }
    return true;
  });

  await mapConcurrent(validAssignments, async ({ projectKey, gateName }) => {
    try {
      await assignQualityGateToProject(gateMapping, projectKey, gateName, client);
    } catch (error) {
      logger.warn(`Failed to assign gate to project ${projectKey}: ${error.message}`);
    }
  }, { concurrency: 10, settled: true });
}
