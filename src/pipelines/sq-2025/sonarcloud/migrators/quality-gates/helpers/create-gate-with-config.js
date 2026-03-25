import logger from '../../../../../../shared/utils/logger.js';

// -------- Create Gate With Config --------

/** Create a quality gate and apply conditions, defaults, permissions. */
export async function createGateWithConfig(gate, client) {
  const created = await client.createQualityGate(gate.name);
  const scGateId = created.id;

  for (const condition of gate.conditions) {
    try {
      await client.createQualityGateCondition(scGateId, condition.metric, condition.op, condition.error);
    } catch (error) {
      logger.warn(`Failed to create condition ${condition.metric} on gate ${gate.name}: ${error.message}`);
    }
  }

  if (gate.isDefault) {
    try { await client.setDefaultQualityGate(scGateId); }
    catch (error) { logger.warn(`Failed to set gate ${gate.name} as default: ${error.message}`); }
  }

  for (const group of (gate.permissions.groups || [])) {
    if (!group.selected) continue;
    try { await client.addGroupPermission(group.name, 'gateadmin'); }
    catch (error) { logger.debug(`Failed to set gate permission for group ${group.name}: ${error.message}`); }
  }

  return scGateId;
}
