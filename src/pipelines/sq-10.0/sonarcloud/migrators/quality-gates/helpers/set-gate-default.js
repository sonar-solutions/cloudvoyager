// -------- Set Gate Default --------

import logger from '../../../../../../shared/utils/logger.js';

export async function setGateDefault(scGateId, gate, client) {
  if (!gate.isDefault) return;

  try {
    await client.setDefaultQualityGate(scGateId);
  } catch (error) {
    logger.warn(`Failed to set gate ${gate.name} as default: ${error.message}`);
  }
}
