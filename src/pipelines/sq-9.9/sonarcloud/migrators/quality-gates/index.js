import logger from '../../../../../shared/utils/logger.js';
import { createGateWithConfig } from './helpers/create-gate-with-config.js';
import { mapConcurrent } from '../../../../../shared/utils/concurrency/helpers/map-concurrent.js';

// -------- Migrate Quality Gates --------

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

export { assignQualityGatesToProjects } from './helpers/assign-quality-gates-to-projects.js';
