// -------- Quality Gates Migration --------

import logger from '../../../../../shared/utils/logger.js';
import { createGateWithConfig } from './helpers/create-gate-with-config.js';
import { assignQualityGateToProject } from './helpers/assign-quality-gate-to-project.js';

export async function migrateQualityGates(extractedGates, client) {
  const gateMapping = new Map();
  const customGates = extractedGates.filter(g => !g.isBuiltIn);
  logger.info(`Migrating ${customGates.length} custom quality gates (skipping ${extractedGates.length - customGates.length} built-in)`);

  for (const gate of customGates) {
    try {
      const scGateId = await createGateWithConfig(gate, client);
      gateMapping.set(gate.name, String(scGateId));
      logger.info(`Migrated quality gate: ${gate.name} (${gate.conditions.length} conditions)`);
    } catch (error) {
      logger.error(`Failed to migrate quality gate ${gate.name}: ${error.message}`);
    }
  }

  return gateMapping;
}

export async function assignQualityGatesToProjects(gateMapping, projectGateAssignments, client) {
  for (const { projectKey, gateName } of projectGateAssignments) {
    await assignQualityGateToProject(gateMapping, projectKey, gateName, client);
  }
}
