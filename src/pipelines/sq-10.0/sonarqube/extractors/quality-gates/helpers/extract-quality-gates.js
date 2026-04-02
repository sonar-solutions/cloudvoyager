// -------- Extract Quality Gates --------

import logger from '../../../../../../shared/utils/logger.js';
import { mapConcurrent } from '../../../../../../shared/utils/concurrency/index.js';

export async function extractQualityGates(client) {
  const gatesData = await client.getQualityGates();
  const gates = gatesData.qualitygates || [];
  const defaultGate = gates.find(g => g.isDefault);
  logger.info(`Found ${gates.length} quality gates (default: ${defaultGate?.name || 'none'})`);

  const detailed = await mapConcurrent(gates, async (gate) => {
    const details = await client.getQualityGateDetails(gate.name);
    const permissions = await client.getQualityGatePermissions(gate.name);
    return {
      name: gate.name,
      isDefault: gate.isDefault || false,
      isBuiltIn: gate.isBuiltIn || false,
      conditions: (details.conditions || []).map(c => ({
        id: c.id, metric: c.metric, op: c.op, error: c.error
      })),
      permissions
    };
  }, { concurrency: 5 });

  return detailed;
}
