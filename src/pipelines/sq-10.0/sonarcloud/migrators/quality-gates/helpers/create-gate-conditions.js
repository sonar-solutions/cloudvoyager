// -------- Create Gate Conditions --------

import logger from '../../../../../../shared/utils/logger.js';

export async function createGateConditions(scGateId, gate, client) {
  for (const condition of gate.conditions) {
    try {
      await client.createQualityGateCondition(scGateId, condition.metric, condition.op, condition.error);
    } catch (error) {
      logger.warn(`Failed to create condition ${condition.metric} on gate ${gate.name}: ${error.message}`);
    }
  }
}
