import logger from '../../utils/logger.js';

/**
 * Migrate quality gates from SonarQube to SonarCloud
 * @param {Array} extractedGates - Quality gates extracted from SonarQube
 * @param {import('../api-client.js').SonarCloudClient} client - SonarCloud client
 * @returns {Promise<Map<string, string>>} Mapping of SQ gate name -> SC gate ID
 */
export async function migrateQualityGates(extractedGates, client) {
  const gateMapping = new Map();

  // Skip built-in gates (SonarCloud has its own)
  const customGates = extractedGates.filter(g => !g.isBuiltIn);
  logger.info(`Migrating ${customGates.length} custom quality gates (skipping ${extractedGates.length - customGates.length} built-in)`);

  for (const gate of customGates) {
    try {
      // Create the gate
      const created = await client.createQualityGate(gate.name);
      const scGateId = created.id;
      gateMapping.set(gate.name, String(scGateId));

      // Create conditions
      for (const condition of gate.conditions) {
        try {
          await client.createQualityGateCondition(scGateId, condition.metric, condition.op, condition.error);
        } catch (error) {
          logger.warn(`Failed to create condition ${condition.metric} on gate ${gate.name}: ${error.message}`);
        }
      }

      // Set as default if applicable
      if (gate.isDefault) {
        try {
          await client.setDefaultQualityGate(scGateId);
        } catch (error) {
          logger.warn(`Failed to set gate ${gate.name} as default: ${error.message}`);
        }
      }

      // Set permissions
      for (const group of (gate.permissions.groups || [])) {
        if (group.selected) {
          try {
            await client.addGroupPermission(group.name, 'gateadmin');
          } catch (error) {
            logger.debug(`Failed to set gate permission for group ${group.name}: ${error.message}`);
          }
        }
      }

      logger.info(`Migrated quality gate: ${gate.name} (${gate.conditions.length} conditions)`);
    } catch (error) {
      logger.error(`Failed to migrate quality gate ${gate.name}: ${error.message}`);
    }
  }

  return gateMapping;
}

/**
 * Assign quality gates to projects
 * @param {Map<string, string>} gateMapping - SQ gate name -> SC gate ID
 * @param {Array} projectGateAssignments - Array of { projectKey, gateName }
 * @param {import('../api-client.js').SonarCloudClient} client
 */
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
